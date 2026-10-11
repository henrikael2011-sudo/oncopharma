import { Controller, Get, Param, Headers, Req, UseGuards, ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';

const STAFF = ['pharmacist','physician','nurse','clinical_manager'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller()
@UseGuards(AuthGuard)
export class ClinicalController {
  constructor(private readonly db: DatabaseService) {}
  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const memberships = await this.db.query<{organization_id:string; role:string; active:boolean}>(
      `SELECT organization_id, role, active FROM memberships WHERE oidc_issuer = $1 AND oidc_sub = $2 AND active = true`,
      [req.principal.issuer, req.principal.sub]);
    return { subject: req.principal.sub, mfa: req.principal.mfa, memberships };
  }
  @Get('patients/:patientId/record')
  async record(@Req() req: AuthenticatedRequest, @Param('patientId') patientId: string, @Headers('x-organization-id') organizationId?: string) {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SYNTHETIC_API !== 'true')
      throw new ServiceUnavailableException('Prontuário sintético desabilitado');
    if (!organizationId || !uuid.test(organizationId) || !uuid.test(patientId)) throw new BadRequestException('Identificador inválido');
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório');
    const memberships = await this.db.query<{role:string}>(
      `SELECT role FROM memberships WHERE oidc_issuer=$1 AND oidc_sub=$2 AND organization_id=$3 AND active=true`,
      [req.principal.issuer,req.principal.sub,organizationId]);
    if (!memberships.some(m=>STAFF.includes(m.role))) throw new ForbiddenException('Sem vínculo profissional');
    return this.db.withTenant(organizationId,async client=>{
      const p=await client.query(`SELECT p.id,p.external_reference FROM patients p
        INNER JOIN care_assignments a ON a.patient_id=p.id AND a.organization_id=p.organization_id
        WHERE p.id=$1 AND p.organization_id=$2 AND p.synthetic=true AND a.oidc_issuer=$3 AND a.oidc_sub=$4 AND a.active=true`,
        [patientId,organizationId,req.principal.issuer,req.principal.sub]);
      if (!p.rowCount) throw new ForbiddenException('Paciente não atribuído');
      const cycles=await client.query(`SELECT c.id,c.cycle_number,c.planned_on,c.status,pr.code AS protocol_code,pr.label AS protocol_label,pr.revision,pr.approved
        FROM treatment_cycles c JOIN oncology_protocols pr ON pr.id=c.protocol_id AND pr.organization_id=c.organization_id
        WHERE c.patient_id=$1 AND c.organization_id=$2 ORDER BY c.cycle_number DESC LIMIT 30`,[patientId,organizationId]);
      const observations=await client.query(`SELECT id,category,title,value_text,observed_at,source_type,source_reference
        FROM clinical_observations WHERE patient_id=$1 AND organization_id=$2 ORDER BY observed_at DESC LIMIT 100`,[patientId,organizationId]);
      const structured: Record<string, unknown[]> = {};
      const structuredQueries: Record<string,string> = {
        allergies: 'SELECT id,substance,reaction,status,recorded_at,source_reference FROM clinical_allergies WHERE organization_id=$2 AND patient_id=$1 ORDER BY recorded_at DESC LIMIT 40',
        measurements: 'SELECT id,kind,value,unit,measured_at,source_reference FROM clinical_measurements WHERE organization_id=$2 AND patient_id=$1 ORDER BY measured_at DESC LIMIT 50',
        labs: 'SELECT id,analyte_code,analyte_label,result_value,unit,reference_low,reference_high,collected_at,source_reference FROM clinical_labs WHERE organization_id=$2 AND patient_id=$1 ORDER BY collected_at DESC LIMIT 100',
        medicationOrders: 'SELECT id,medication,dose_value,dose_unit,route,frequency_text,status,ordered_at,source_reference FROM clinical_medication_orders WHERE organization_id=$2 AND patient_id=$1 ORDER BY ordered_at DESC LIMIT 100',
        medicationAdministrations: 'SELECT id,order_id,medication,dose_value,dose_unit,status,administered_at,source_reference FROM clinical_medication_administrations WHERE organization_id=$2 AND patient_id=$1 ORDER BY administered_at DESC LIMIT 100',
        pharmacyAssessments: 'SELECT id,title,summary,review_status,authored_at,source_reference FROM pharmacy_assessments WHERE organization_id=$2 AND patient_id=$1 ORDER BY authored_at DESC LIMIT 100'
      };
      for (const [key, sql] of Object.entries(structuredQueries)) {
        structured[key] = (await client.query(sql,[patientId,organizationId])).rows;
      }
      await client.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata)
        VALUES($1,$2,$3,'patient.record.read','patient',jsonb_build_object('patient_id',$4::text))`,
        [organizationId,req.principal.issuer,req.principal.sub,patientId]);
      return {patient:p.rows[0],cycles:cycles.rows,observations:observations.rows,structured,syntheticOnly:true,clinicalOperationsEnabled:false};
    });
  }
  @Get('patients')
  async patients(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') organizationId?: string) {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SYNTHETIC_API !== 'true')
      throw new ServiceUnavailableException('Consulta clínica desabilitada até homologação');
    if (!organizationId || !uuid.test(organizationId)) throw new BadRequestException('Organização inválida');
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório para acesso profissional');
    const memberships = await this.db.query<{role:string}>(
      `SELECT role FROM memberships WHERE oidc_issuer=$1 AND oidc_sub=$2 AND organization_id=$3 AND active=true`,
      [req.principal.issuer, req.principal.sub, organizationId]);
    if (!memberships.some(m => STAFF.includes(m.role))) throw new ForbiddenException('Sem vínculo profissional ativo nesta instituição');
    return this.db.withTenant(organizationId, async client => {
      // Restrição contextual: somente pacientes sintéticos atribuídos ao profissional.
      const result = await client.query(
        `SELECT p.id, p.external_reference, p.synthetic, p.created_at
         FROM patients p INNER JOIN care_assignments a ON a.patient_id=p.id
         WHERE p.organization_id=$1 AND p.synthetic=true AND a.oidc_issuer=$2 AND a.oidc_sub=$3 AND a.active=true
         ORDER BY p.created_at ASC LIMIT 25`, [organizationId, req.principal.issuer, req.principal.sub]);
      await client.query(
        `INSERT INTO audit_events (organization_id, actor_issuer, actor_sub, action, resource_type, metadata)
         VALUES ($1,$2,$3,'patient.list','patient',jsonb_build_object('result_count',$4::int))`,
         [organizationId, req.principal.issuer, req.principal.sub, result.rowCount]);
      return { patients: result.rows, syntheticOnly: true, clinicalOperationsEnabled: false };
    });
  }
}
