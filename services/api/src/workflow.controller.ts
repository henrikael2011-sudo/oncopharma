import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAFF = ['pharmacist', 'physician', 'nurse', 'clinical_manager'];
function syntheticOnly() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SYNTHETIC_API !== 'true')
    throw new ServiceUnavailableException('Fluxo M10 disponível somente em DEV sintético');
}
function tenant(id?: string) { if (!id || !UUID.test(id)) throw new BadRequestException('Organização inválida'); return id; }
function patient(id: string) { if (!UUID.test(id)) throw new BadRequestException('Paciente inválido'); return id; }
function textValue(value: unknown, max: number, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new BadRequestException(`${field} inválido`);
  return value.trim();
}
@Controller('workflow')
@UseGuards(AuthGuard)
export class WorkflowController {
  constructor(private readonly db: DatabaseService) {}
  private async checkStaff(req: AuthenticatedRequest, org: string, patientId: string) {
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório');
    // M14.5 (consolidado; forma adotada da proposta Codex): vínculo e atribuição na MESMA transação com contexto de tenant.
    // care_assignments tem FORCE RLS; fora do contexto retornava zero linhas e todo profissional atribuído era negado.
    return this.db.withTenant(org, async client => {
      const rows = (await client.query<{role:string}>(`SELECT role FROM memberships WHERE organization_id=$1 AND oidc_issuer=$2 AND oidc_sub=$3 AND active=true`,[org,req.principal.issuer,req.principal.sub])).rows;
      if (!rows.some(x=>STAFF.includes(x.role))) throw new ForbiddenException('Profissional sem vínculo');
      const assignments = (await client.query<{patient_id:string}>(`SELECT patient_id FROM care_assignments WHERE organization_id=$1 AND patient_id=$2 AND oidc_issuer=$3 AND oidc_sub=$4 AND active=true`,[org,patientId,req.principal.issuer,req.principal.sub])).rows;
      if (!assignments.length) throw new ForbiddenException('Paciente não atribuído');
    });
  }
  @Post('care/patients/:patientId/symptoms')
  async symptom(@Req() req: AuthenticatedRequest,@Param('patientId') patientId:string,@Headers('x-organization-id') orgHeader:string,@Body() body:Record<string,unknown>) {
    syntheticOnly(); const org=tenant(orgHeader); patient(patientId);
    const symptomCode=textValue(body?.symptomCode,64,'Código');
    if (!['nausea','neuropathy','fever','other'].includes(symptomCode)) throw new BadRequestException('Sintoma não permitido');
    const description=textValue(body?.description,1000,'Descrição');
    const requestId=textValue(body?.requestId,100,'Idempotência');
    if (!UUID.test(requestId)) throw new BadRequestException('requestId deve ser UUID');
    return this.db.withTenant(org,async client=>{
      const link=await client.query(`SELECT 1 FROM patient_portal_links l JOIN patients p ON p.id=l.patient_id AND p.organization_id=l.organization_id WHERE l.organization_id=$1 AND l.patient_id=$2 AND l.oidc_issuer=$3 AND l.oidc_sub=$4 AND l.active=true AND p.synthetic=true`,[org,patientId,req.principal.issuer,req.principal.sub]);
      if (!link.rowCount) throw new ForbiddenException('Conta não vinculada ao paciente');
      const existing=await client.query(`SELECT id,triage_status FROM patient_symptom_reports WHERE organization_id=$1 AND source_reference=$2`,[org,requestId]);
      if (existing.rowCount) return { reportId:existing.rows[0].id,triageStatus:existing.rows[0].triage_status,duplicate:true,syntheticOnly:true };
      // Regra conservadora de demonstração, não é triagem clínica validada.
      const urgent=symptomCode==='fever'; const level=urgent?'urgent_review':'needs_review';
      const reportId=randomUUID(); const alertId=randomUUID();
      await client.query(`INSERT INTO patient_symptom_reports(id,organization_id,patient_id,symptom_code,description,source,source_reference,triage_status) VALUES($1,$2,$3,$4,$5,'care-portal',$6,$7)`,[reportId,org,patientId,symptomCode,description,requestId,urgent?'urgent_review':'pending']);
      await client.query(`INSERT INTO clinical_alerts(id,organization_id,patient_id,source_report_id,code,level,status,rule_version,explanation) VALUES($1,$2,$3,$4,$5,$6,'open','demo-m10-v1',$7)`,[alertId,org,patientId,reportId,`symptom.${symptomCode}`,level,'Regra demonstrativa: exige avaliação profissional. Não representa diagnóstico ou conduta.']);
      await client.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,'symptom.created','symptom_report',jsonb_build_object('report_id',$4::text,'patient_id',$5::text))`,[org,req.principal.issuer,req.principal.sub,reportId,patientId]);
      return {reportId,alertId,triageStatus:urgent?'urgent_review':'pending',syntheticOnly:true,clinicalAdvice:false};
    });
  }
  @Get('clinical/patients/:patientId/alerts')
  async alerts(@Req() req:AuthenticatedRequest,@Param('patientId') patientId:string,@Headers('x-organization-id') orgHeader:string){
    syntheticOnly(); const org=tenant(orgHeader); patient(patientId); await this.checkStaff(req,org,patientId);
    return this.db.withTenant(org,async client=>{
      const result=await client.query(`SELECT a.id,a.code,a.level,a.status,a.rule_version,a.explanation,a.created_at,r.description,r.symptom_code FROM clinical_alerts a LEFT JOIN patient_symptom_reports r ON r.id=a.source_report_id WHERE a.organization_id=$1 AND a.patient_id=$2 ORDER BY a.created_at DESC LIMIT 50`,[org,patientId]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,'alert.list','patient',jsonb_build_object('patient_id',$4::text))`,[org,req.principal.issuer,req.principal.sub,patientId]);
      return {alerts:result.rows,syntheticOnly:true};
    });
  }
  @Post('clinical/patients/:patientId/interventions')
  async intervention(@Req() req:AuthenticatedRequest,@Param('patientId') patientId:string,@Headers('x-organization-id') orgHeader:string,@Body() body:Record<string,unknown>){
    syntheticOnly(); const org=tenant(orgHeader); patient(patientId); await this.checkStaff(req,org,patientId);
    const alertId=textValue(body?.alertId,36,'Alerta'); if(!UUID.test(alertId)) throw new BadRequestException('Alerta inválido');
    const note=textValue(body?.note,2000,'Nota'); const decision=textValue(body?.decision,30,'Decisão');
    if(!['pending','accepted','declined','referred'].includes(decision)) throw new BadRequestException('Decisão inválida');
    return this.db.withTenant(org,async client=>{
      const alert=await client.query(`SELECT id FROM clinical_alerts WHERE id=$1 AND organization_id=$2 AND patient_id=$3 FOR UPDATE`,[alertId,org,patientId]);
      if(!alert.rowCount) throw new ForbiddenException('Alerta não localizado');
      const id=randomUUID();
      await client.query(`INSERT INTO clinical_interventions(id,organization_id,patient_id,alert_id,type,note,decision,actor_issuer,actor_sub) VALUES($1,$2,$3,$4,'clinical_review',$5,$6,$7,$8)`,[id,org,patientId,alertId,note,decision,req.principal.issuer,req.principal.sub]);
      await client.query(`UPDATE clinical_alerts SET status='acknowledged' WHERE id=$1 AND organization_id=$2 AND status='open'`,[alertId,org]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,'intervention.created','clinical_intervention',jsonb_build_object('intervention_id',$4::text,'alert_id',$5::text))`,[org,req.principal.issuer,req.principal.sub,id,alertId]);
      return {interventionId:id,guidanceDelivered:false,syntheticOnly:true};
    });
  }
}
