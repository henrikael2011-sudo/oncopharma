// M15.2 — API do ONCOPHARMA Care (paciente). R3: o paciente é SEMPRE derivado da identidade autenticada
// (patient_portal_links: organização + issuer + sujeito); nenhuma rota aceita identificador de paciente do cliente.
// Conteúdo exibido ao paciente: somente dados do próprio vínculo, orientações `approved`, sem dose e sem conduta.
import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Put, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { syntheticApiEnabled } from './synthetic-mode';
import { assessSymptom, SYMPTOMS, CONSENT_TERMS_VERSION, parseSymptomAnswers } from './care-rules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function syntheticOnly() { if (!syntheticApiEnabled()) throw new ServiceUnavailableException('Care disponível somente em ambiente não produtivo com dados sintéticos'); }
function tenant(id?: string) { if (!id || !UUID.test(id)) throw new BadRequestException('Organização inválida'); return id; }
const CYCLE_LABEL: Record<string, string> = { planned: 'Agendado', under_review: 'Em preparação pela equipe', completed: 'Realizado', cancelled: 'Cancelado' };
const REPORT_LABEL: Record<string, string> = { pending: 'Recebido pela equipe', urgent_review: 'Recebido — prioridade', reviewed: 'Avaliado pela equipe' };

export type CareSubject = { patientId: string; actor: 'patient' };

@Controller('care')
@UseGuards(AuthGuard)
export class CareController {
  constructor(private readonly db: DatabaseService) {}

  /** R3: resolve o paciente do vínculo ativo da identidade. Zero ou mais de um vínculo => 403 (nunca escolhe). */
  static async subject(client: PoolClient, org: string, req: AuthenticatedRequest): Promise<CareSubject> {
    const r = await client.query<{ patient_id: string }>(
      `SELECT l.patient_id FROM patient_portal_links l JOIN patients p ON p.id=l.patient_id AND p.organization_id=l.organization_id
        WHERE l.organization_id=$1 AND l.oidc_issuer=$2 AND l.oidc_sub=$3 AND l.active=true AND p.synthetic=true`, [org, req.principal.issuer, req.principal.sub]);
    if (r.rowCount !== 1) throw new ForbiddenException('Conta sem vínculo de paciente ativo');
    return { patientId: r.rows[0].patient_id, actor: 'patient' };
  }
  private audit(client: PoolClient, org: string, req: AuthenticatedRequest, action: string, patientId: string, extra: Record<string, string> = {}) {
    return client.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,$4,'patient',$5::jsonb)`,
      [org, req.principal.issuer, req.principal.sub, action, JSON.stringify({ patient_id: patientId, channel: 'care', ...extra })]);
  }
  private run<T>(req: AuthenticatedRequest, orgHeader: string, work: (c: PoolClient, s: CareSubject, org: string) => Promise<T>) {
    syntheticOnly(); const org = tenant(orgHeader);
    return this.db.withTenant(org, async (c) => work(c, await CareController.subject(c, org, req), org));
  }

  @Get('me')
  me(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      const p = (await c.query(`SELECT font_scale,high_contrast,consent_terms_version,consent_accepted_at FROM patient_care_preferences WHERE organization_id=$1 AND patient_id=$2`, [org, s.patientId])).rows[0];
      const claims = req.principal.claims as Record<string, unknown>;
      return { actor: s.actor, displayName: typeof claims.given_name === 'string' ? claims.given_name.slice(0, 60) : null,
        consent: { required: CONSENT_TERMS_VERSION, accepted: p?.consent_terms_version === CONSENT_TERMS_VERSION, acceptedAt: p?.consent_accepted_at ?? null },
        preferences: { fontScale: p?.font_scale ?? 'normal', highContrast: p?.high_contrast ?? false } };
    });
  }

  @Put('me/consent')
  consent(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    if (body?.termsVersion !== CONSENT_TERMS_VERSION || body?.accept !== true) throw new BadRequestException('Aceite inválido');
    return this.run(req, org, async (c, s) => {
      await c.query(`INSERT INTO patient_care_preferences(organization_id,patient_id,consent_terms_version,consent_accepted_at) VALUES($1,$2,$3,now())
        ON CONFLICT (organization_id,patient_id) DO UPDATE SET consent_terms_version=EXCLUDED.consent_terms_version,consent_accepted_at=EXCLUDED.consent_accepted_at,updated_at=now()`, [org, s.patientId, CONSENT_TERMS_VERSION]);
      await this.audit(c, org, req, 'care.consent.accepted', s.patientId, { terms: CONSENT_TERMS_VERSION });
      return { accepted: true, termsVersion: CONSENT_TERMS_VERSION };
    });
  }

  @Put('me/preferences')
  preferences(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const fontScale = body?.fontScale, highContrast = body?.highContrast;
    if (!['normal', 'large', 'xlarge'].includes(String(fontScale)) || typeof highContrast !== 'boolean') throw new BadRequestException('Preferências inválidas');
    return this.run(req, org, async (c, s) => {
      await c.query(`INSERT INTO patient_care_preferences(organization_id,patient_id,font_scale,high_contrast) VALUES($1,$2,$3,$4)
        ON CONFLICT (organization_id,patient_id) DO UPDATE SET font_scale=EXCLUDED.font_scale,high_contrast=EXCLUDED.high_contrast,updated_at=now()`, [org, s.patientId, fontScale, highContrast]);
      await this.audit(c, org, req, 'care.preferences.updated', s.patientId);
      return { fontScale, highContrast };
    });
  }

  @Get('me/home')
  home(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      const next = (await c.query(`SELECT cycle_number,planned_on::text AS planned_on,status FROM treatment_cycles WHERE organization_id=$1 AND patient_id=$2 AND status IN ('planned','under_review') ORDER BY planned_on NULLS LAST LIMIT 1`, [org, s.patientId])).rows[0];
      const meds = (await c.query(`SELECT medication,frequency_text FROM clinical_medication_orders WHERE organization_id=$1 AND patient_id=$2 AND status='active' AND route IN ('VO','oral','SC-casa') ORDER BY medication`, [org, s.patientId])).rows;
      const guidance = (await c.query(`SELECT id,body,approved_at FROM patient_guidance WHERE organization_id=$1 AND patient_id=$2 AND status IN ('approved','delivered') AND approved_by IS NOT NULL ORDER BY approved_at DESC LIMIT 5`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.home.read', s.patientId);
      return { nextCycle: next ? { number: next.cycle_number, date: next.planned_on, status: CYCLE_LABEL[next.status] } : null,
        reminders: [...(next ? [{ kind: 'cycle', text: `Próxima sessão: ciclo ${next.cycle_number}` , date: next.planned_on }] : []), ...meds.map((m) => ({ kind: 'medication', text: `${m.medication}: ${m.frequency_text ?? 'conforme orientação da equipe'}` }))],
        guidance: guidance.map((g) => ({ id: g.id, text: g.body, approvedAt: g.approved_at })) };
    });
  }

  @Get('me/journey')
  journey(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      const cycles = (await c.query(`SELECT cycle_number,planned_on::text AS planned_on,status FROM treatment_cycles WHERE organization_id=$1 AND patient_id=$2 AND status<>'cancelled' ORDER BY cycle_number`, [org, s.patientId])).rows;
      const reports = (await c.query(`SELECT id,symptom_code,triage_status,reported_at FROM patient_symptom_reports WHERE organization_id=$1 AND patient_id=$2 ORDER BY reported_at DESC LIMIT 20`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.journey.read', s.patientId);
      return { cycles: cycles.map((x) => ({ number: x.cycle_number, date: x.planned_on, status: CYCLE_LABEL[x.status] })),
        reports: reports.map((r) => ({ id: r.id, symptom: SYMPTOMS[r.symptom_code as keyof typeof SYMPTOMS] ?? 'Outro', status: REPORT_LABEL[r.triage_status] ?? 'Recebido pela equipe', at: r.reported_at })) };
    });
  }

  @Get('me/medications')
  medications(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      // Sem dose/via ao paciente (Plano v3: Care não exibe dose nem sugere ajuste); somente nome e horário em linguagem simples.
      const rows = (await c.query(`SELECT o.id,o.medication,o.frequency_text,o.route,(SELECT a.status FROM patient_adherence_reports a WHERE a.organization_id=o.organization_id AND a.order_id=o.id AND a.reported_on=current_date ORDER BY a.created_at DESC LIMIT 1) AS today
        FROM clinical_medication_orders o WHERE o.organization_id=$1 AND o.patient_id=$2 AND o.status='active' ORDER BY o.medication`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.medications.read', s.patientId);
      return { medications: rows.map((m) => ({ id: m.id, name: m.medication, schedule: m.frequency_text ?? 'Conforme orientação da equipe', atHome: ['VO', 'oral', 'SC-casa'].includes(m.route), today: m.today ?? null })) };
    });
  }

  @Post('me/medications/:orderId/adherence')
  adherence(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    if (!UUID.test(orderId)) throw new BadRequestException('Medicamento inválido');
    const status = String(body?.status), requestId = String(body?.requestId);
    if (!['taken', 'missed', 'partial'].includes(status) || !UUID.test(requestId)) throw new BadRequestException('Relato de uso inválido');
    return this.run(req, org, async (c, s) => {
      const o = await c.query(`SELECT 1 FROM clinical_medication_orders WHERE id=$1 AND organization_id=$2 AND patient_id=$3 AND status='active'`, [orderId, org, s.patientId]);
      if (!o.rowCount) throw new ForbiddenException('Medicamento não localizado');
      const dup = await c.query(`SELECT id FROM patient_adherence_reports WHERE organization_id=$1 AND source_reference=$2`, [org, requestId]);
      if (dup.rowCount) return { id: dup.rows[0].id, duplicate: true };
      const id = randomUUID();
      await c.query(`INSERT INTO patient_adherence_reports(id,organization_id,patient_id,order_id,status,source_reference,actor_issuer,actor_sub) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, org, s.patientId, orderId, status, requestId, req.principal.issuer, req.principal.sub]);
      await this.audit(c, org, req, 'care.adherence.reported', s.patientId, { order_id: orderId, status });
      return { id, status };
    });
  }

  @Post('me/symptoms')
  symptom(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const answers = parseSymptomAnswers(body); // lança BadRequest com mensagem pt-BR
    return this.run(req, org, async (c, s) => {
      const existing = await c.query(`SELECT id,triage_status FROM patient_symptom_reports WHERE organization_id=$1 AND source_reference=$2`, [org, answers.requestId]);
      const a = assessSymptom(answers);
      if (existing.rowCount) return { reportId: existing.rows[0].id, duplicate: true, urgent: existing.rows[0].triage_status === 'urgent_review', message: a.patientMessage };
      const reportId = randomUUID(), alertId = randomUUID();
      await c.query(`INSERT INTO patient_symptom_reports(id,organization_id,patient_id,symptom_code,description,source,source_reference,triage_status,details,actor_issuer,actor_sub) VALUES($1,$2,$3,$4,$5,'care-portal',$6,$7,$8::jsonb,$9,$10)`,
        [reportId, org, s.patientId, answers.symptomCode, answers.description || SYMPTOMS[answers.symptomCode], answers.requestId, a.urgent ? 'urgent_review' : 'pending', JSON.stringify(a.details), req.principal.issuer, req.principal.sub]);
      await c.query(`INSERT INTO clinical_alerts(id,organization_id,patient_id,source_report_id,code,level,status,rule_version,explanation) VALUES($1,$2,$3,$4,$5,$6,'open',$7,$8)`,
        [alertId, org, s.patientId, reportId, `symptom.${answers.symptomCode}`, a.urgent ? 'urgent_review' : 'needs_review', a.ruleVersion, a.explanation]);
      await this.audit(c, org, req, 'symptom.created', s.patientId, { report_id: reportId, urgent: String(a.urgent) });
      return { reportId, urgent: a.urgent, message: a.patientMessage, clinicalAdvice: false };
    });
  }

  @Get('me/help')
  help(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c) => {
      const contacts = (await c.query(`SELECT label,phone,hours FROM organization_help_contacts WHERE organization_id=$1 ORDER BY sort_order,label`, [org])).rows;
      return { emergency: 'Em caso de emergência, ligue 192 (SAMU) ou procure o pronto-atendimento mais próximo.', contacts, contactsConfigured: contacts.length > 0 };
    });
  }
}
