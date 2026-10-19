// D-012 / P-SAM-1..4: API isolada. JWT/MFA -> contexto transacional -> RLS + guardas no banco.
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers, Param, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { syntheticApiEnabled } from './synthetic-mode';
import { evidenceRefs, PRIORITY_LABELS, REQUEST_LABELS, REQUEST_ROLES, requestTransition, UUID, type RequestStatus } from './medical-request-rules';

const validId = (v: string) => { if (!UUID.test(v)) throw new BadRequestException('Identificador inválido'); return v; };
const text = (v: unknown, min: number, max: number) => { if (typeof v !== 'string' || v.trim().length < min || v.length > max) throw new BadRequestException(`Informe entre ${min} e ${max} caracteres`); return v.trim(); };
@Controller('clinical')
@UseGuards(AuthGuard)
export class MedicalRequestsController {
  constructor(private readonly db: DatabaseService) {}
  private async run<T>(req: AuthenticatedRequest, org: string, fn: (c: PoolClient, role: string) => Promise<T>) {
    if (!syntheticApiEnabled()) throw new ServiceUnavailableException('Clinical disponível somente em ambiente sintético');
    validId(org ?? '');
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório para acesso profissional');
    try {
      return await this.db.withTenant(org, async (c) => {
        const roles = (await c.query(`SELECT role FROM memberships WHERE organization_id=$1 AND oidc_issuer=$2 AND oidc_sub=$3 AND active`, [org, req.principal.issuer, req.principal.sub])).rows.map((r) => r.role);
        const role = REQUEST_ROLES.find((r) => roles.includes(r));
        if (!role) throw new ForbiddenException('Perfil sem acesso a solicitações médicas');
        await c.query(`SELECT set_config('app.sam_issuer',$1,true),set_config('app.sam_sub',$2,true),set_config('app.sam_mfa','true',true)`, [req.principal.issuer, req.principal.sub]);
        return fn(c, role);
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Não devolver SQL, parâmetros, texto clínico ou detalhes de constraints para o cliente/logs.
      if (code === '23514') {
        const message = (e as Error).message;
        const safe = ['Nome profissional obrigatório no cadastro para registrar eventos', 'Sem médico de plantão configurado para esta unidade ou escala ambígua', 'Critério de prioridade não configurado para esta unidade', 'Alocação mudou; descarte e crie novo rascunho', 'Médico sem vínculo ativo', 'Destinatário deve ser outro profissional médico'];
        throw new ConflictException(safe.includes(message) ? message : 'Solicitação recusada: verifique estado, destinatário e evidências');
      }
      if (['42501', '23503'].includes(code ?? '')) throw new ForbiddenException('Recurso não disponível para este acesso');
      throw e;
    }
  }
  private async linked(c: PoolClient, org: string, patientId: string) {
    if (!(await c.query('SELECT sam_link($1,$2) AS ok', [org, validId(patientId)])).rows[0]?.ok) throw new ForbiddenException('Paciente não atribuído');
  }
  private async row(c: PoolClient, org: string, requestId: string) {
    const r = (await c.query(`SELECT id,patient_id,status,priority,created_at,revision,author_issuer,author_sub,recipient_mode,recipient_issuer,recipient_sub,justification,response,outcome,official_reference,unit,evidence,criteria_snapshot FROM medical_requests WHERE organization_id=$1 AND id=$2 FOR UPDATE`, [org, validId(requestId)])).rows[0];
    if (!r) throw new ForbiddenException('Solicitação indisponível');
    return r;
  }
  private mine(req: AuthenticatedRequest, r: any) { return r.author_issuer === req.principal.issuer && r.author_sub === req.principal.sub; }
  private audit(c: PoolClient, org: string, req: AuthenticatedRequest, role: string, action: string, resource: string, meta: object) {
    return c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [org, req.principal.issuer, req.principal.sub, action, resource, JSON.stringify({ ...meta, actor_role: role, channel: 'clinical' })]);
  }
  @Get('patients/:patientId/medical-request-options')
  options(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    return this.run(req, org, async (c, role) => {
      await this.linked(c, org, patientId);
      const allocation = (await c.query(`SELECT unit FROM patient_allocations WHERE organization_id=$1 AND patient_id=$2 AND superseded_at IS NULL`, [org, patientId])).rows[0];
      const doctors = (await c.query(`SELECT DISTINCT m.oidc_issuer AS issuer,m.oidc_sub AS sub,m.display_name AS label FROM memberships m JOIN care_assignments a ON a.organization_id=m.organization_id AND a.oidc_issuer=m.oidc_issuer AND a.oidc_sub=m.oidc_sub
        WHERE m.organization_id=$1 AND m.role='physician' AND m.active AND a.active AND a.patient_id=$2 AND (m.oidc_issuer<>$3 OR m.oidc_sub<>$4) ORDER BY sub`, [org, patientId, req.principal.issuer, req.principal.sub])).rows;
      const priorities = (await c.query(`SELECT priority,description,sla_minutes FROM request_priority_criteria WHERE organization_id=$1 AND unit=$2 ORDER BY priority`, [org, allocation?.unit ?? ''])).rows;
      const evidence = (await c.query(`SELECT id,'alert' AS type,code AS label,created_at AS at,'alert:'||id AS source FROM clinical_alerts WHERE organization_id=$1 AND patient_id=$2
        UNION ALL SELECT id,'lab',analyte_label,collected_at,source_reference FROM clinical_labs WHERE organization_id=$1 AND patient_id=$2
        UNION ALL SELECT id,'order',medication,ordered_at,source_reference FROM clinical_medication_orders WHERE organization_id=$1 AND patient_id=$2
        UNION ALL SELECT id,'administration',medication,administered_at,source_reference FROM clinical_medication_administrations WHERE organization_id=$1 AND patient_id=$2
        UNION ALL SELECT id,'symptom',symptom_code,reported_at,source_reference FROM patient_symptom_reports WHERE organization_id=$1 AND patient_id=$2 ORDER BY at DESC LIMIT 100`, [org, patientId])).rows;
      await this.audit(c, org, req, role, 'medical_request.options.read', 'patient', { patient_id: patientId });
      return { unit: allocation?.unit ?? null, doctors: doctors.map((d) => ({ ...d, label: d.label ?? 'Nome profissional não cadastrado' })), priorities: priorities.map((p) => ({ ...p, label: PRIORITY_LABELS[p.priority as keyof typeof PRIORITY_LABELS] })), evidence, clinicallyApproved: false };
    });
  }
  @Get('patients/:patientId/medical-requests')
  patientList(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    return this.run(req, org, async (c, role) => {
      await this.linked(c, org, patientId);
      const rows = (await c.query(`SELECT id,status,priority,created_at FROM medical_requests WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 100`, [org, patientId])).rows;
      await this.audit(c, org, req, role, 'medical_request.list.read', 'patient', { patient_id: patientId, count: rows.length });
      return { items: rows };
    });
  }
  @Get('medical-requests/inbox')
  inbox(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, role) => {
      const rows = (await c.query(`SELECT id,status,priority,created_at FROM medical_requests WHERE organization_id=$1 AND recipient_issuer=$2 AND recipient_sub=$3 AND status NOT IN ('draft','discarded') ORDER BY created_at DESC LIMIT 100`, [org, req.principal.issuer, req.principal.sub])).rows;
      await this.audit(c, org, req, role, 'medical_request.inbox.read', 'medical_request', { count: rows.length });
      return { items: rows };
    });
  }
  @Post('patients/:patientId/medical-requests')
  create(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string, @Body() body: Record<string, unknown>) {
    const justification = text(body?.justification, 10, 2000), priority = String(body?.priority ?? '');
    if (!(Object.hasOwn(PRIORITY_LABELS, priority))) throw new BadRequestException('Prioridade inválida');
    let refs; try { refs = evidenceRefs(body?.evidence); } catch (e) { throw new BadRequestException((e as Error).message); }
    const mode = body?.recipientMode;
    if (mode !== 'on_call' && mode !== 'specific') throw new BadRequestException('Destinatário inválido');
    const issuer = mode === 'specific' ? text(body?.recipientIssuer, 3, 500) : null;
    const sub = mode === 'specific' ? text(body?.recipientSub, 1, 200) : null;
    return this.run(req, org, async (c, role) => {
      await this.linked(c, org, patientId);
      const a = (await c.query(`SELECT unit FROM patient_allocations WHERE organization_id=$1 AND patient_id=$2 AND superseded_at IS NULL`, [org, patientId])).rows[0];
      if (!a) throw new ConflictException('Unidade do paciente não configurada');
      const r = (await c.query(`INSERT INTO medical_requests(organization_id,patient_id,author_issuer,author_sub,author_role,unit,recipient_mode,recipient_issuer,recipient_sub,justification,priority,evidence)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING id,status,revision`, [org, patientId, req.principal.issuer, req.principal.sub, role, a.unit, mode, issuer, sub, justification, priority, JSON.stringify(refs)])).rows[0];
      return r;
    });
  }
  @Get('medical-requests/:requestId')
  read(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('requestId') requestId: string) {
    return this.run(req, org, async (c, role) => {
      const r = await this.row(c, org, requestId);
      const author = this.mine(req, r), recipient = (await c.query(`SELECT sam_recipient(r) AS ok FROM medical_requests r WHERE id=$1`, [r.id])).rows[0]?.ok === true;
      const reason = author ? 'author' : r.recipient_mode === 'on_call' ? 'on_call' : 'linked';
      await this.audit(c, org, req, role, 'medical_request.read', 'medical_request', { request_id: r.id, revision: r.revision, access_reason: reason });
      await c.query('SELECT sam_record_read($1,$2)', [org, r.id]);
      const recipientActive = (await c.query('SELECT sam_destination_active(r) AS active FROM medical_requests r WHERE id=$1', [r.id])).rows[0]?.active === true;
      const patient = (await c.query('SELECT display_name AS name,hospital_record AS record FROM patients WHERE organization_id=$1 AND id=$2', [org,r.patient_id])).rows[0];
      const recipientLabel = r.recipient_sub ? (await c.query("SELECT display_name FROM memberships WHERE organization_id=$1 AND oidc_issuer=$2 AND oidc_sub=$3 AND role='physician'", [org,r.recipient_issuer,r.recipient_sub])).rows[0]?.display_name ?? 'Nome profissional não cadastrado' : 'Resolvido no envio';
      const events = (await c.query(`SELECT revision,action,actor_role,actor_name,actor_registration,at,access_reason FROM medical_request_events WHERE request_id=$1 AND organization_id=$2 ORDER BY id`, [r.id, org])).rows;
      return { id:r.id, patient, recipientLabel, recipientActive, status:r.status, priority:r.priority, created_at:r.created_at, revision:r.revision, justification:r.justification, response:r.response, outcome:r.outcome, official_reference:r.official_reference, unit:r.unit, recipient_mode:r.recipient_mode, evidence:r.evidence, criteria_snapshot:r.criteria_snapshot, statusLabel: REQUEST_LABELS[r.status as RequestStatus], mine: author,
        actions: Object.keys(REQUEST_LABELS).filter((s) => requestTransition(r.status, s as RequestStatus, author, recipient)), events, prescriptionChanged: false };
    });
  }
  @Post('medical-requests/:requestId/edit')
  edit(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('requestId') requestId: string, @Body() body: Record<string, unknown>) {
    const justification = text(body?.justification, 10, 2000), priority = String(body?.priority ?? '');
    if (!(Object.hasOwn(PRIORITY_LABELS, priority))) throw new BadRequestException('Prioridade inválida');
    let refs; try { refs = evidenceRefs(body?.evidence); } catch (e) { throw new BadRequestException((e as Error).message); }
    return this.run(req, org, async (c) => {
      const r = await this.row(c, org, requestId); this.revision(r, body);
      if (!this.mine(req, r) || r.status !== 'draft') throw new ForbiddenException('Somente o autor edita o rascunho');
      return (await c.query(`UPDATE medical_requests SET justification=$2,priority=$3,evidence=$4::jsonb WHERE id=$1 RETURNING id,status,revision`, [r.id, justification, priority, JSON.stringify(refs)])).rows[0];
    });
  }
  private revision(r: any, body: Record<string, unknown>) { if (body?.revision !== r.revision) throw new ConflictException('Solicitação mudou. Atualize antes de continuar.'); }
  @Post('medical-requests/:requestId/transition')
  transition(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('requestId') requestId: string, @Body() body: Record<string, unknown>) {
    const to = String(body?.to ?? '') as RequestStatus;
    return this.run(req, org, async (c) => {
      const r = await this.row(c, org, requestId); this.revision(r, body);
      const recipient = (await c.query(`SELECT sam_recipient(r) AS ok FROM medical_requests r WHERE id=$1`, [r.id])).rows[0]?.ok === true;
      if (!requestTransition(r.status, to, this.mine(req, r), recipient)) throw new ForbiddenException('Ação não permitida para este acesso/estado');
      if (to === 'sent' && body?.confirmed !== true) throw new BadRequestException('Confirme a revisão humana antes de enviar');
      let response = r.response, outcome = r.outcome, reference = r.official_reference;
      if (['accepted','adjusted','declined'].includes(to)) response = text(body?.response, 3, 2000);
      if (to === 'completed') { outcome = text(body?.outcome, 3, 2000); reference = text(body?.officialReference, 3, 300); }
      return (await c.query(`UPDATE medical_requests SET status=$2,response=$3,outcome=$4,official_reference=$5 WHERE id=$1 RETURNING id,status,revision`, [r.id, to, response, outcome, reference])).rows[0];
    });
  }
}
