// M15.2 — API do ONCOPHARMA Care (paciente). R3: o paciente é SEMPRE derivado da identidade autenticada
// (patient_portal_links: organização + issuer + sujeito); nenhuma rota aceita identificador de paciente do cliente.
// Conteúdo exibido ao paciente: somente dados do próprio vínculo, orientações `approved`, sem dose e sem conduta.
import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Put, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CAREGIVER_SCOPES, type CaregiverScope, hashInviteCode, newInviteCode, normalizeInviteCode, TERM_OPTIONS } from './caregiver-rules';
import type { PoolClient } from 'pg';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { syntheticApiEnabled } from './synthetic-mode';
import { assessSymptom, SYMPTOMS, CONSENT_TERMS_VERSION, parseSymptomAnswers, reportStatusLabel, parseTemperature, isFever, temperatureAsSymptom, FEVER_THRESHOLD_C, ROUTINE_MESSAGE } from './care-rules';
import { careKey, openText, sealText } from './care-crypto';
import { alertCodeLabel, CHECKIN_ROUTINE, CHECKIN_UNWELL, FEELINGS, type Feeling, MESSAGE_DISCLAIMER, MESSAGE_TOPICS, type MessageTopic, parseCheckin, parseMessage } from './care-contact-rules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function syntheticOnly() { if (!syntheticApiEnabled()) throw new ServiceUnavailableException('Care disponível somente em ambiente não produtivo com dados sintéticos'); }
function tenant(id?: string) { if (!id || !UUID.test(id)) throw new BadRequestException('Organização inválida'); return id; }
const CYCLE_LABEL: Record<string, string> = { planned: 'Agendado', under_review: 'Em preparação pela equipe', completed: 'Realizado', cancelled: 'Cancelado' };

export type CareSubject = { patientId: string; actor: 'patient' | 'caregiver'; scopes: CaregiverScope[]; linkId?: string };

@Controller('care')
@UseGuards(AuthGuard)
export class CareController {
  constructor(private readonly db: DatabaseService) {}

  /** R3/R4: resolve o paciente pela identidade. Paciente: vínculo patient_portal_links. Cuidador: vínculo ativo
   * (não revogado, dentro do prazo) criado por convite do paciente. Zero ou mais de um vínculo => 403 (nunca escolhe). */
  static async subject(client: PoolClient, org: string, req: AuthenticatedRequest): Promise<CareSubject> {
    const r = await client.query<{ patient_id: string }>(
      `SELECT l.patient_id FROM patient_portal_links l JOIN patients p ON p.id=l.patient_id AND p.organization_id=l.organization_id
        WHERE l.organization_id=$1 AND l.oidc_issuer=$2 AND l.oidc_sub=$3 AND l.active=true AND p.synthetic=true`, [org, req.principal.issuer, req.principal.sub]);
    if (r.rowCount === 1) return { patientId: r.rows[0].patient_id, actor: 'patient', scopes: [...CAREGIVER_SCOPES] };
    if (r.rowCount && r.rowCount > 1) throw new ForbiddenException('Conta sem vínculo de paciente ativo');
    const c = await client.query<{ id: string; patient_id: string; scopes: CaregiverScope[] }>(
      `SELECT l.id,l.patient_id,l.scopes FROM caregiver_links l JOIN patients p ON p.id=l.patient_id AND p.organization_id=l.organization_id
        WHERE l.organization_id=$1 AND l.caregiver_issuer=$2 AND l.caregiver_sub=$3 AND l.revoked_at IS NULL AND l.expires_at>now() AND p.synthetic=true`, [org, req.principal.issuer, req.principal.sub]);
    if (c.rowCount !== 1) throw new ForbiddenException('Conta sem vínculo de paciente ativo');
    return { patientId: c.rows[0].patient_id, actor: 'caregiver', scopes: c.rows[0].scopes, linkId: c.rows[0].id };
  }
  /** Escopo concedido pelo paciente (P-R4). Paciente tem todos; cuidador só os ligados. */
  static need(s: CareSubject, scope: CaregiverScope | 'patient') {
    if (s.actor === 'patient') return;
    if (scope === 'patient' || !s.scopes.includes(scope)) throw new ForbiddenException('Sem permissão do paciente para esta informação');
  }
  private async audit(client: PoolClient, org: string, req: AuthenticatedRequest, action: string, s: CareSubject | string, extra: Record<string, string> = {}) {
    const patientId = typeof s === 'string' ? s : s.patientId, role = typeof s === 'string' ? 'patient' : s.actor;
    await client.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,$4,'patient',$5::jsonb)`,
      [org, req.principal.issuer, req.principal.sub, action, JSON.stringify({ patient_id: patientId, channel: 'care', actor_role: role, ...extra })]);
    if (typeof s !== 'string' && s.actor === 'caregiver' && s.linkId)
      await client.query(`INSERT INTO caregiver_access_events(organization_id,patient_id,link_id,action) VALUES($1,$2,$3,$4)`, [org, s.patientId, s.linkId, action.startsWith('care.') ? action : `care.${action}`]);
  }
  private run<T>(req: AuthenticatedRequest, orgHeader: string, work: (c: PoolClient, s: CareSubject, org: string) => Promise<T>) {
    syntheticOnly(); const org = tenant(orgHeader);
    return this.db.withTenant(org, async (c) => work(c, await CareController.subject(c, org, req), org));
  }

  @Get('me')
  me(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      const p = (await c.query(`SELECT font_scale,high_contrast,consent_terms_version,consent_accepted_at,display_name FROM patient_care_preferences WHERE organization_id=$1 AND patient_id=$2`, [org, s.patientId])).rows[0];
      const claims = req.principal.claims as Record<string, unknown>;
      const displayName = typeof claims.given_name === 'string' ? claims.given_name.slice(0, 60) : null;
      if (s.actor === 'caregiver') {
        const l = (await c.query(`SELECT expires_at,consent_accepted_at FROM caregiver_links WHERE id=$1`, [s.linkId])).rows[0];
        await this.audit(c, org, req, 'care.me.read', s);
        return { actor: 'caregiver', displayName, patientName: p?.display_name ?? null, scopes: s.scopes, expiresAt: l.expires_at,
          consent: { required: CONSENT_TERMS_VERSION, accepted: true, acceptedAt: l.consent_accepted_at }, preferences: { fontScale: 'normal', highContrast: false } };
      }
      return { actor: s.actor, displayName, scopes: s.scopes,
        consent: { required: CONSENT_TERMS_VERSION, accepted: p?.consent_terms_version === CONSENT_TERMS_VERSION, acceptedAt: p?.consent_accepted_at ?? null },
        preferences: { fontScale: p?.font_scale ?? 'normal', highContrast: p?.high_contrast ?? false } };
    });
  }

  @Put('me/consent')
  consent(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    if (body?.termsVersion !== CONSENT_TERMS_VERSION || body?.accept !== true) throw new BadRequestException('Aceite inválido');
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient');
      const gn = (req.principal.claims as Record<string, unknown>).given_name, name = typeof gn === 'string' ? gn.slice(0, 60) : null;
      await c.query(`INSERT INTO patient_care_preferences(organization_id,patient_id,consent_terms_version,consent_accepted_at,display_name) VALUES($1,$2,$3,now(),$4)
        ON CONFLICT (organization_id,patient_id) DO UPDATE SET consent_terms_version=EXCLUDED.consent_terms_version,consent_accepted_at=EXCLUDED.consent_accepted_at,display_name=EXCLUDED.display_name,updated_at=now()`, [org, s.patientId, CONSENT_TERMS_VERSION, name]);
      await this.audit(c, org, req, 'care.consent.accepted', s, { terms: CONSENT_TERMS_VERSION });
      return { accepted: true, termsVersion: CONSENT_TERMS_VERSION };
    });
  }

  @Put('me/preferences')
  preferences(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const fontScale = body?.fontScale, highContrast = body?.highContrast;
    if (!['normal', 'large', 'xlarge'].includes(String(fontScale)) || typeof highContrast !== 'boolean') throw new BadRequestException('Preferências inválidas');
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient');
      await c.query(`INSERT INTO patient_care_preferences(organization_id,patient_id,font_scale,high_contrast) VALUES($1,$2,$3,$4)
        ON CONFLICT (organization_id,patient_id) DO UPDATE SET font_scale=EXCLUDED.font_scale,high_contrast=EXCLUDED.high_contrast,updated_at=now()`, [org, s.patientId, fontScale, highContrast]);
      await this.audit(c, org, req, 'care.preferences.updated', s);
      return { fontScale, highContrast };
    });
  }

  @Get('me/home')
  home(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      const canJ = s.actor === 'patient' || s.scopes.includes('ver_jornada'), canM = s.actor === 'patient' || s.scopes.includes('ver_medicamentos');
      const next = !canJ ? undefined : (await c.query(`SELECT cycle_number,planned_on::text AS planned_on,status FROM treatment_cycles WHERE organization_id=$1 AND patient_id=$2 AND status IN ('planned','under_review') ORDER BY planned_on NULLS LAST LIMIT 1`, [org, s.patientId])).rows[0];
      const meds = !canM ? [] : (await c.query(`SELECT medication,frequency_text FROM clinical_medication_orders WHERE organization_id=$1 AND patient_id=$2 AND status='active' AND route IN ('VO','oral','SC-casa') ORDER BY medication`, [org, s.patientId])).rows;
      const guidance = !canJ ? [] : (await c.query(`SELECT id,body,approved_at FROM patient_guidance WHERE organization_id=$1 AND patient_id=$2 AND status IN ('approved','delivered') AND approved_by IS NOT NULL ORDER BY approved_at DESC LIMIT 5`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.home.read', s);
      return { sections: { journey: canJ, medications: canM, symptoms: s.actor === 'patient' || s.scopes.includes('registrar_sintoma') }, nextCycle: next ? { number: next.cycle_number, date: next.planned_on, status: CYCLE_LABEL[next.status] } : null,
        reminders: [...(next ? [{ kind: 'cycle', text: `Próxima sessão: ciclo ${next.cycle_number}` , date: next.planned_on }] : []), ...meds.map((m) => ({ kind: 'medication', text: `${m.medication}: ${m.frequency_text ?? 'conforme orientação da equipe'}` }))],
        guidance: guidance.map((g) => ({ id: g.id, text: g.body, approvedAt: g.approved_at })) };
    });
  }

  @Get('me/journey')
  journey(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'ver_jornada');
      const cycles = (await c.query(`SELECT cycle_number,planned_on::text AS planned_on,status FROM treatment_cycles WHERE organization_id=$1 AND patient_id=$2 AND status<>'cancelled' ORDER BY cycle_number`, [org, s.patientId])).rows;
      const reports = (await c.query(`SELECT r.id,r.symptom_code,r.triage_status,r.reported_at,(SELECT a.status FROM clinical_alerts a WHERE a.organization_id=r.organization_id AND a.source_report_id=r.id ORDER BY a.created_at DESC LIMIT 1) AS alert_status FROM patient_symptom_reports r WHERE r.organization_id=$1 AND r.patient_id=$2 ORDER BY r.reported_at DESC LIMIT 20`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.journey.read', s);
      return { cycles: cycles.map((x) => ({ number: x.cycle_number, date: x.planned_on, status: CYCLE_LABEL[x.status] })),
        reports: reports.map((r) => ({ id: r.id, symptom: SYMPTOMS[r.symptom_code as keyof typeof SYMPTOMS] ?? 'Outro', status: reportStatusLabel(r.alert_status, r.triage_status === 'urgent_review'), at: r.reported_at })) };
    });
  }

  @Get('me/medications')
  medications(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'ver_medicamentos');
      // Sem dose/via ao paciente (Plano v3: Care não exibe dose nem sugere ajuste); somente nome, horários e orientações aprovadas.
      // M22: pedidos vindos de transcrição só aparecem DEPOIS da liberação farmacêutica (status released) e dentro do período.
      const rows = (await c.query(`SELECT o.id,o.medication,o.frequency_text,o.route,t.times,t.instructions_encrypted,t.instructions_iv,t.instructions_tag,
          (SELECT a.status FROM patient_adherence_reports a WHERE a.organization_id=o.organization_id AND a.order_id=o.id AND a.reported_on=current_date AND a.scheduled_time IS NULL ORDER BY a.created_at DESC LIMIT 1) AS today,
          (SELECT json_object_agg(x.scheduled_time,x.status) FROM (SELECT DISTINCT ON (a.scheduled_time) a.scheduled_time,a.status FROM patient_adherence_reports a WHERE a.organization_id=o.organization_id AND a.order_id=o.id AND a.reported_on=current_date AND a.scheduled_time IS NOT NULL ORDER BY a.scheduled_time,a.created_at DESC) x) AS doses
        FROM clinical_medication_orders o
        LEFT JOIN LATERAL (SELECT tr.times,tr.instructions_encrypted,tr.instructions_iv,tr.instructions_tag,tr.start_date,tr.end_date FROM clinical_med_transcriptions tr WHERE tr.organization_id=o.organization_id AND tr.order_id=o.id AND tr.status='released' ORDER BY tr.version DESC LIMIT 1) t ON true
        WHERE o.organization_id=$1 AND o.patient_id=$2 AND o.status='active'
          AND (o.source_reference NOT LIKE 'transcr:%' OR (t.times IS NOT NULL AND t.start_date<=current_date AND (t.end_date IS NULL OR t.end_date>=current_date)))
        ORDER BY (t.times)[1] NULLS LAST, o.medication`, [org, s.patientId])).rows;
      let key: Buffer | null = null; if (rows.some((r) => r.instructions_encrypted)) { try { key = careKey().key; } catch { throw new ServiceUnavailableException('Medicamentos indisponíveis: chave de cifra não configurada'); } }
      await this.audit(c, org, req, 'care.medications.read', s);
      return { medications: rows.map((m) => ({ id: m.id, name: m.medication,
        schedule: m.times ? (m.times as string[]).join(' · ') : (m.frequency_text ?? 'Conforme orientação da equipe'),
        times: m.times ? (m.times as string[]).map((t) => ({ time: t, today: (m.doses ?? {})[t] ?? null })) : null,
        instructions: m.instructions_encrypted && key ? openText({ ciphertext: m.instructions_encrypted, iv: m.instructions_iv, tag: m.instructions_tag }, key) : null,
        atHome: ['VO', 'oral', 'SC-casa', 'topica'].includes(m.route), canReport: s.actor === 'patient', today: m.today ?? null })) };
    });
  }

  @Post('me/medications/:orderId/adherence')
  adherence(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    if (!UUID.test(orderId)) throw new BadRequestException('Medicamento inválido');
    const status = String(body?.status), requestId = String(body?.requestId);
    if (!['taken', 'missed', 'partial'].includes(status) || !UUID.test(requestId)) throw new BadRequestException('Relato de uso inválido');
    const scheduledTime = body?.scheduledTime === undefined ? null : String(body.scheduledTime);
    if (scheduledTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) throw new BadRequestException('Horário inválido');
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient'); // adesão é relato do próprio paciente
      const o = await c.query(`SELECT (SELECT tr.times FROM clinical_med_transcriptions tr WHERE tr.organization_id=o.organization_id AND tr.order_id=o.id AND tr.status='released' ORDER BY tr.version DESC LIMIT 1) AS times FROM clinical_medication_orders o WHERE o.id=$1 AND o.organization_id=$2 AND o.patient_id=$3 AND o.status='active'`, [orderId, org, s.patientId]);
      if (!o.rowCount) throw new ForbiddenException('Medicamento não localizado');
      if (scheduledTime !== null && !((o.rows[0].times as string[] | null) ?? []).includes(scheduledTime)) throw new BadRequestException('Horário não consta na orientação liberada');
      const dup = await c.query(`SELECT id FROM patient_adherence_reports WHERE organization_id=$1 AND source_reference=$2`, [org, requestId]);
      if (dup.rowCount) return { id: dup.rows[0].id, duplicate: true };
      const id = randomUUID();
      await c.query(`INSERT INTO patient_adherence_reports(id,organization_id,patient_id,order_id,status,source_reference,actor_issuer,actor_sub,scheduled_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, org, s.patientId, orderId, status, requestId, req.principal.issuer, req.principal.sub, scheduledTime]);
      await this.audit(c, org, req, 'care.adherence.reported', s, { order_id: orderId, status, ...(scheduledTime ? { scheduled_time: scheduledTime } : {}) });
      return { id, status, scheduledTime };
    });
  }

  @Post('me/symptoms')
  symptom(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const answers = parseSymptomAnswers(body); // lança BadRequest com mensagem pt-BR
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'registrar_sintoma');
      const existing = await c.query(`SELECT id,triage_status FROM patient_symptom_reports WHERE organization_id=$1 AND source_reference=$2`, [org, answers.requestId]);
      const a = assessSymptom(answers);
      if (existing.rowCount) return { reportId: existing.rows[0].id, duplicate: true, urgent: existing.rows[0].triage_status === 'urgent_review', message: a.patientMessage };
      const reportId = randomUUID(), alertId = randomUUID();
      await c.query(`INSERT INTO patient_symptom_reports(id,organization_id,patient_id,symptom_code,description,source,source_reference,triage_status,details,actor_issuer,actor_sub) VALUES($1,$2,$3,$4,$5,'care-portal',$6,$7,$8::jsonb,$9,$10)`,
        [reportId, org, s.patientId, answers.symptomCode, answers.description || SYMPTOMS[answers.symptomCode], answers.requestId, a.urgent ? 'urgent_review' : 'pending', JSON.stringify({ ...a.details, reported_by: s.actor }), req.principal.issuer, req.principal.sub]);
      await c.query(`INSERT INTO clinical_alerts(id,organization_id,patient_id,source_report_id,code,level,status,rule_version,explanation) VALUES($1,$2,$3,$4,$5,$6,'awaiting_review',$7,$8)`,
        [alertId, org, s.patientId, reportId, `symptom.${answers.symptomCode}`, a.urgent ? 'urgent_review' : 'needs_review', a.ruleVersion, a.explanation]);
      await this.audit(c, org, req, 'symptom.created', s, { report_id: reportId, urgent: String(a.urgent) });
      return { reportId, urgent: a.urgent, message: a.patientMessage, clinicalAdvice: false };
    });
  }

  // ---------- M21.2: temperatura (°C). Paciente ou cuidador com registrar_sintoma. Valor cifrado em repouso. ----------
  @Post('me/temperatures')
  temperature(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const t = parseTemperature(body); // lança BadRequest com mensagem pt-BR
    let key: ReturnType<typeof careKey>; try { key = careKey(); } catch { throw new ServiceUnavailableException('Registro de temperatura indisponível: chave de cifra não configurada'); }
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'registrar_sintoma');
      const existing = await c.query(`SELECT id,symptom_report_id FROM patient_temperature_readings WHERE organization_id=$1 AND source_reference=$2`, [org, t.requestId]);
      const fever = isFever(t.celsius);
      const a = fever ? assessSymptom(temperatureAsSymptom(t)) : null;
      if (existing.rowCount) return { readingId: existing.rows[0].id, duplicate: true, urgent: fever, message: a ? a.patientMessage : ROUTINE_MESSAGE, clinicalAdvice: false };
      let reportId: string | null = null;
      if (a) { // mesmo caminho do relato de sintoma com sinal de alerta "febre" (regra care-demo-v1)
        const ans = temperatureAsSymptom(t); reportId = randomUUID();
        await c.query(`INSERT INTO patient_symptom_reports(id,organization_id,patient_id,symptom_code,description,source,source_reference,triage_status,details,actor_issuer,actor_sub) VALUES($1,$2,$3,$4,$5,'care-portal',$6,$7,$8::jsonb,$9,$10)`,
          [reportId, org, s.patientId, ans.symptomCode, ans.description, `temp:${t.requestId}`, 'urgent_review', JSON.stringify({ ...a.details, reported_by: s.actor, source: 'temperature' }), req.principal.issuer, req.principal.sub]);
        await c.query(`INSERT INTO clinical_alerts(id,organization_id,patient_id,source_report_id,code,level,status,rule_version,explanation) VALUES($1,$2,$3,$4,$5,'urgent_review','awaiting_review',$6,$7)`,
          [randomUUID(), org, s.patientId, reportId, 'symptom.fever', a.ruleVersion, a.explanation]);
      }
      const enc = sealText(t.celsius.toFixed(1), key.key);
      const r = await c.query(`INSERT INTO patient_temperature_readings(organization_id,patient_id,value_encrypted,value_iv,value_tag,key_id,measured_at,recorded_by,actor_issuer,actor_sub,source_reference,symptom_report_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [org, s.patientId, enc.ciphertext, enc.iv, enc.tag, key.id, t.measuredAt, s.actor, req.principal.issuer, req.principal.sub, t.requestId, reportId]);
      await this.audit(c, org, req, 'care.temperature.created', s, { reading_id: r.rows[0].id, urgent: String(fever) }); // valor não vai para a auditoria
      return { readingId: r.rows[0].id, reportId, urgent: fever, message: a ? a.patientMessage : ROUTINE_MESSAGE, clinicalAdvice: false };
    });
  }

  @Get('me/temperatures')
  temperatures(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    let key: ReturnType<typeof careKey>; try { key = careKey(); } catch { throw new ServiceUnavailableException('Leitura de temperatura indisponível: chave de cifra não configurada'); }
    return this.run(req, org, async (c, s) => {
      if (s.actor === 'caregiver' && !s.scopes.includes('registrar_sintoma') && !s.scopes.includes('ver_jornada')) CareController.need(s, 'ver_jornada');
      const rows = (await c.query(`SELECT id,value_encrypted,value_iv,value_tag,measured_at,recorded_by FROM patient_temperature_readings WHERE organization_id=$1 AND patient_id=$2 AND measured_at >= now() - interval '7 days' ORDER BY measured_at ASC LIMIT 200`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.temperature.read', s);
      return { thresholdC: FEVER_THRESHOLD_C, readings: rows.map((x) => { const celsius = Number(openText({ ciphertext: x.value_encrypted, iv: x.value_iv, tag: x.value_tag }, key.key)); return { id: x.id, celsius, measuredAt: x.measured_at, recordedBy: x.recorded_by, fever: isFever(celsius) }; }) };
    });
  }

  // ---------- M25: check-in diário (um por dia, editável no mesmo dia). Paciente ou cuidador com registrar_sintoma. ----------
  private checkinView(r: Record<string, any> | undefined, key: Buffer | null, celsius: number | null) {
    if (!r) return null;
    return { id: r.id, date: r.checkin_date, feeling: r.feeling as Feeling, feelingLabel: FEELINGS[r.feeling as Feeling], celsius, fever: celsius !== null && isFever(celsius),
      note: r.note_encrypted && key ? openText({ ciphertext: r.note_encrypted, iv: r.note_iv, tag: r.note_tag }, key) : null,
      recordedBy: r.recorded_by, createdAt: r.created_at, updatedAt: r.updated_at, edited: Number(r.edit_count) > 0, canEdit: r.is_today === true };
  }
  private async readingCelsius(c: PoolClient, id: string | null, key: Buffer) {
    if (!id) return null; const t = (await c.query(`SELECT value_encrypted,value_iv,value_tag FROM patient_temperature_readings WHERE id=$1`, [id])).rows[0];
    return t ? Number(openText({ ciphertext: t.value_encrypted, iv: t.value_iv, tag: t.value_tag }, key)) : null;
  }

  @Get('me/checkins/today')
  checkinToday(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    let key: ReturnType<typeof careKey>; try { key = careKey(); } catch { throw new ServiceUnavailableException('Check-in indisponível: chave de cifra não configurada'); }
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'registrar_sintoma');
      const r = (await c.query(`SELECT *, checkin_date::text AS checkin_date, (checkin_date=current_date) AS is_today FROM patient_daily_checkins WHERE organization_id=$1 AND patient_id=$2 AND checkin_date=current_date`, [org, s.patientId])).rows[0];
      await this.audit(c, org, req, 'care.checkin.read', s);
      return { today: (await c.query(`SELECT current_date::text AS d`)).rows[0].d, thresholdC: FEVER_THRESHOLD_C, checkin: this.checkinView(r, key.key, r ? await this.readingCelsius(c, r.temperature_reading_id, key.key) : null), feelings: FEELINGS };
    });
  }

  @Put('me/checkins/today')
  checkin(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const ci = parseCheckin(body); // BadRequest pt-BR (temperatura: mesma faixa e casa decimal do registro de temperatura)
    let key: ReturnType<typeof careKey>; try { key = careKey(); } catch { throw new ServiceUnavailableException('Check-in indisponível: chave de cifra não configurada'); }
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'registrar_sintoma');
      const prev = (await c.query(`SELECT id,temperature_reading_id,symptom_report_id,edit_count FROM patient_daily_checkins WHERE organization_id=$1 AND patient_id=$2 AND checkin_date=current_date FOR UPDATE`, [org, s.patientId])).rows[0];
      const prevC = prev ? await this.readingCelsius(c, prev.temperature_reading_id, key.key) : null;
      let readingId: string | null = prev?.temperature_reading_id ?? null, reportId: string | null = prev?.symptom_report_id ?? null, urgent = false;
      // Temperatura nova/alterada => nova leitura imutável; >= 37,8 °C => relato "febre" + alerta urgente (regra care-demo-v1, mesmo caminho de me/temperatures).
      if (ci.temperature && ci.temperature.celsius !== prevC) {
        const t = ci.temperature, fever = isFever(t.celsius); let feverReport: string | null = null;
        if (fever) {
          const a = assessSymptom(temperatureAsSymptom(t)), ans = temperatureAsSymptom(t); feverReport = randomUUID(); urgent = true;
          await c.query(`INSERT INTO patient_symptom_reports(id,organization_id,patient_id,symptom_code,description,source,source_reference,triage_status,details,actor_issuer,actor_sub) VALUES($1,$2,$3,$4,$5,'care-portal',$6,'urgent_review',$7::jsonb,$8,$9)`,
            [feverReport, org, s.patientId, ans.symptomCode, ans.description, `checkin-temp:${randomUUID()}`, JSON.stringify({ ...a.details, reported_by: s.actor, source: 'checkin' }), req.principal.issuer, req.principal.sub]);
          await c.query(`INSERT INTO clinical_alerts(id,organization_id,patient_id,source_report_id,code,level,status,rule_version,explanation) VALUES($1,$2,$3,$4,'symptom.fever','urgent_review','awaiting_review',$5,$6)`,
            [randomUUID(), org, s.patientId, feverReport, a.ruleVersion, a.explanation]);
        }
        const enc = sealText(t.celsius.toFixed(1), key.key);
        readingId = (await c.query(`INSERT INTO patient_temperature_readings(organization_id,patient_id,value_encrypted,value_iv,value_tag,key_id,measured_at,recorded_by,actor_issuer,actor_sub,source_reference,symptom_report_id) VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11) RETURNING id`,
          [org, s.patientId, enc.ciphertext, enc.iv, enc.tag, key.id, s.actor, req.principal.issuer, req.principal.sub, `checkin:${randomUUID()}`, feverReport])).rows[0].id;
      } else if (!ci.temperature) readingId = null;
      else urgent = prevC !== null && isFever(prevC);
      // "Não estou bem" => um relato + alerta de revisão por dia (não duplica ao editar).
      if (ci.feeling === 'mal' && !reportId) {
        reportId = randomUUID();
        await c.query(`INSERT INTO patient_symptom_reports(id,organization_id,patient_id,symptom_code,description,source,source_reference,triage_status,details,actor_issuer,actor_sub) VALUES($1,$2,$3,'other',$4,'care-portal',$5,'pending',$6::jsonb,$7,$8)`,
          [reportId, org, s.patientId, 'Check-in diário: não estou bem', `checkin-unwell:${randomUUID()}`, JSON.stringify({ reported_by: s.actor, source: 'checkin', questionnaire: 'care-demo-v1' }), req.principal.issuer, req.principal.sub]);
        await c.query(`INSERT INTO clinical_alerts(id,organization_id,patient_id,source_report_id,code,level,status,rule_version,explanation) VALUES($1,$2,$3,$4,'checkin.unwell','needs_review','awaiting_review','care-demo-v1',$5)`,
          [randomUUID(), org, s.patientId, reportId, 'Regra demonstrativa: check-in diário "não estou bem". Exige avaliação profissional; não representa diagnóstico ou conduta.']);
      }
      const n = ci.note ? sealText(ci.note, key.key) : null;
      const vals = [ci.feeling, n?.ciphertext ?? null, n?.iv ?? null, n?.tag ?? null, n ? key.id : null, readingId, reportId, s.actor, req.principal.issuer, req.principal.sub];
      let id: string;
      if (prev) { id = prev.id; await c.query(`UPDATE patient_daily_checkins SET feeling=$1,note_encrypted=$2,note_iv=$3,note_tag=$4,key_id=$5,temperature_reading_id=$6,symptom_report_id=$7,recorded_by=$8,actor_issuer=$9,actor_sub=$10,updated_at=now(),edit_count=edit_count+1 WHERE id=$11 AND checkin_date=current_date`, [...vals, id]); }
      else id = (await c.query(`INSERT INTO patient_daily_checkins(organization_id,patient_id,checkin_date,feeling,note_encrypted,note_iv,note_tag,key_id,temperature_reading_id,symptom_report_id,recorded_by,actor_issuer,actor_sub) VALUES($11,$12,current_date,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [...vals, org, s.patientId])).rows[0].id;
      await this.audit(c, org, req, prev ? 'care.checkin.updated' : 'care.checkin.created', s, { checkin_id: id, feeling: ci.feeling, urgent: String(urgent) }); // texto e valor fora da auditoria
      const r = (await c.query(`SELECT *, checkin_date::text AS checkin_date, (checkin_date=current_date) AS is_today FROM patient_daily_checkins WHERE id=$1`, [id])).rows[0];
      return { checkin: this.checkinView(r, key.key, ci.temperature?.celsius ?? null), updated: !!prev, urgent,
        message: urgent ? assessSymptom(temperatureAsSymptom(ci.temperature ?? { celsius: FEVER_THRESHOLD_C, measuredAt: new Date(), requestId: ci.requestId })).patientMessage : ci.feeling === 'mal' ? CHECKIN_UNWELL : CHECKIN_ROUTINE, clinicalAdvice: false };
    });
  }

  // ---------- M25: alertas reais do paciente (clinical_alerts do próprio vínculo), sem conduta. ----------
  @Get('me/alerts')
  alerts(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      if (s.actor === 'caregiver' && !s.scopes.includes('registrar_sintoma') && !s.scopes.includes('ver_jornada')) CareController.need(s, 'ver_jornada');
      const rows = (await c.query(`SELECT a.id,a.code,a.level,a.status,a.created_at,r.description FROM clinical_alerts a LEFT JOIN patient_symptom_reports r ON r.id=a.source_report_id AND r.organization_id=a.organization_id
        WHERE a.organization_id=$1 AND a.patient_id=$2 AND a.created_at >= now() - interval '30 days' ORDER BY a.created_at DESC LIMIT 50`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.alerts.read', s);
      const FINAL = ['resolved', 'dismissed', 'duplicate'];
      return { thresholdC: FEVER_THRESHOLD_C, alerts: rows.map((a) => ({ id: a.id, code: a.code, title: alertCodeLabel(a.code), detail: a.description ?? null, urgent: a.level === 'urgent_review', fever: a.code === 'symptom.fever',
        status: reportStatusLabel(a.status, a.level === 'urgent_review'), active: !FINAL.includes(a.status), at: a.created_at })) };
    });
  }

  // ---------- M25: mensagens paciente/cuidador <-> equipe (não urgente; texto cifrado; auditado). ----------
  @Get('me/messages')
  messages(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    let key: ReturnType<typeof careKey>; try { key = careKey(); } catch { throw new ServiceUnavailableException('Mensagens indisponíveis: chave de cifra não configurada'); }
    return this.run(req, org, async (c, s) => {
      const rows = (await c.query(`SELECT id,direction,author_role,author_display,topic,body_encrypted,body_iv,body_tag,read_at,created_at FROM care_team_messages WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 100`, [org, s.patientId])).rows.reverse();
      await c.query(`UPDATE care_team_messages SET read_at=now() WHERE organization_id=$1 AND patient_id=$2 AND direction='to_patient' AND read_at IS NULL`, [org, s.patientId]);
      await this.audit(c, org, req, 'care.messages.read', s);
      return { disclaimer: MESSAGE_DISCLAIMER, topics: MESSAGE_TOPICS, messages: rows.map((m) => ({ id: m.id, fromTeam: m.direction === 'to_patient', authorRole: m.author_role, author: m.author_display, topic: m.topic as MessageTopic, topicLabel: MESSAGE_TOPICS[m.topic as MessageTopic],
        body: openText({ ciphertext: m.body_encrypted, iv: m.body_iv, tag: m.body_tag }, key.key), at: m.created_at, readByTeam: m.direction === 'to_team' ? !!m.read_at : undefined })) };
    });
  }

  @Post('me/messages')
  sendMessage(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const m = parseMessage(body);
    let key: ReturnType<typeof careKey>; try { key = careKey(); } catch { throw new ServiceUnavailableException('Mensagens indisponíveis: chave de cifra não configurada'); }
    return this.run(req, org, async (c, s) => {
      const dup = await c.query(`SELECT id FROM care_team_messages WHERE organization_id=$1 AND source_reference=$2`, [org, `care:${m.requestId}`]);
      if (dup.rowCount) return { id: dup.rows[0].id, duplicate: true, disclaimer: MESSAGE_DISCLAIMER };
      const gn = (req.principal.claims as Record<string, unknown>).given_name, name = typeof gn === 'string' ? gn.slice(0, 60) : null;
      const e = sealText(m.body, key.key);
      const id = (await c.query(`INSERT INTO care_team_messages(organization_id,patient_id,direction,author_role,author_display,actor_issuer,actor_sub,topic,body_encrypted,body_iv,body_tag,key_id,source_reference) VALUES($1,$2,'to_team',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [org, s.patientId, s.actor, name, req.principal.issuer, req.principal.sub, m.topic, e.ciphertext, e.iv, e.tag, key.id, `care:${m.requestId}`])).rows[0].id;
      await this.audit(c, org, req, 'care.message.sent', s, { message_id: id, topic: m.topic }); // texto fora da auditoria
      return { id, sent: true, disclaimer: MESSAGE_DISCLAIMER };
    });
  }

  // ---------- M15.3 (R4): cuidador. Gestão SOMENTE pelo paciente. ----------
  @Get('me/caregivers')
  caregivers(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient');
      const links = (await c.query(`SELECT id,caregiver_display_name,scopes,created_at,expires_at,revoked_at FROM caregiver_links WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 20`, [org, s.patientId])).rows;
      const invites = (await c.query(`SELECT id,term_days,expires_at FROM caregiver_invites WHERE organization_id=$1 AND patient_id=$2 AND used_at IS NULL AND cancelled_at IS NULL AND expires_at>now() ORDER BY created_at DESC`, [org, s.patientId])).rows;
      const log = (await c.query(`SELECT e.action,e.at,l.caregiver_display_name FROM caregiver_access_events e JOIN caregiver_links l ON l.id=e.link_id WHERE e.organization_id=$1 AND e.patient_id=$2 ORDER BY e.at DESC LIMIT 50`, [org, s.patientId])).rows;
      await this.audit(c, org, req, 'care.caregivers.read', s);
      return { links: links.map((l) => ({ id: l.id, name: l.caregiver_display_name, scopes: l.scopes, createdAt: l.created_at, expiresAt: l.expires_at, active: !l.revoked_at && new Date(l.expires_at) > new Date(), revokedAt: l.revoked_at })),
        invites: invites.map((i) => ({ id: i.id, termDays: i.term_days, expiresAt: i.expires_at })),
        accessLog: log.map((e) => ({ action: e.action, at: e.at, name: e.caregiver_display_name })) };
    });
  }

  @Post('me/caregivers/invites')
  invite(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const termDays = Number(body?.termDays);
    if (!TERM_OPTIONS.includes(termDays)) throw new BadRequestException('Prazo inválido');
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient');
      const pending = await c.query(`SELECT count(*)::int AS n FROM caregiver_invites WHERE organization_id=$1 AND patient_id=$2 AND used_at IS NULL AND cancelled_at IS NULL AND expires_at>now()`, [org, s.patientId]);
      if (pending.rows[0].n >= 3) throw new BadRequestException('Você já tem 3 convites pendentes. Cancele um antes de criar outro.');
      const code = newInviteCode(), id = randomUUID();
      const r = await c.query(`INSERT INTO caregiver_invites(id,organization_id,patient_id,code_hash,term_days,created_by_issuer,created_by_sub,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '72 hours') RETURNING expires_at`,
        [id, org, s.patientId, hashInviteCode(code), termDays, req.principal.issuer, req.principal.sub]);
      await this.audit(c, org, req, 'care.caregiver.invite.created', s, { invite_id: id, term_days: String(termDays) });
      return { id, code, expiresAt: r.rows[0].expires_at, termDays }; // código exibido uma única vez; só o hash fica no banco
    });
  }

  @Post('me/caregivers/invites/:inviteId/cancel')
  cancelInvite(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('inviteId') inviteId: string) {
    if (!UUID.test(inviteId)) throw new BadRequestException('Convite inválido');
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient');
      const r = await c.query(`UPDATE caregiver_invites SET cancelled_at=now() WHERE id=$1 AND organization_id=$2 AND patient_id=$3 AND used_at IS NULL AND cancelled_at IS NULL`, [inviteId, org, s.patientId]);
      if (!r.rowCount) throw new ForbiddenException('Convite não localizado');
      await this.audit(c, org, req, 'care.caregiver.invite.cancelled', s, { invite_id: inviteId });
      return { cancelled: true };
    });
  }

  @Put('me/caregivers/:linkId/scopes')
  scopes(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('linkId') linkId: string, @Body() body: Record<string, unknown>) {
    if (!UUID.test(linkId)) throw new BadRequestException('Vínculo inválido');
    const scopes = Array.isArray(body?.scopes) ? body.scopes.map(String) : null;
    if (!scopes || scopes.some((x) => !CAREGIVER_SCOPES.includes(x as CaregiverScope)) || new Set(scopes).size !== scopes.length) throw new BadRequestException('Permissões inválidas');
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient');
      const r = await c.query(`UPDATE caregiver_links SET scopes=$4::text[] WHERE id=$1 AND organization_id=$2 AND patient_id=$3 AND revoked_at IS NULL AND expires_at>now()`, [linkId, org, s.patientId, scopes]);
      if (!r.rowCount) throw new ForbiddenException('Vínculo não localizado ou encerrado');
      await this.audit(c, org, req, 'care.caregiver.scopes.updated', s, { link_id: linkId, scopes: scopes.join(',') });
      return { scopes };
    });
  }

  @Post('me/caregivers/:linkId/revoke')
  revoke(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('linkId') linkId: string) {
    if (!UUID.test(linkId)) throw new BadRequestException('Vínculo inválido');
    return this.run(req, org, async (c, s) => {
      CareController.need(s, 'patient');
      const r = await c.query(`UPDATE caregiver_links SET revoked_at=now() WHERE id=$1 AND organization_id=$2 AND patient_id=$3 AND revoked_at IS NULL`, [linkId, org, s.patientId]);
      if (!r.rowCount) throw new ForbiddenException('Vínculo não localizado ou já encerrado');
      await this.audit(c, org, req, 'care.caregiver.revoked', s, { link_id: linkId });
      return { revoked: true };
    });
  }

  /** Cuidador aceita o convite (ainda sem vínculo). Código errado/expirado/usado => 403 genérico, auditado. */
  @Post('caregiver/accept')
  async accept(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') orgHeader: string, @Body() body: Record<string, unknown>) {
    syntheticOnly(); const org = tenant(orgHeader);
    const code = normalizeInviteCode(body?.code);
    if (!code || body?.acceptTerms !== true) throw new BadRequestException('Informe o código e aceite os termos');
    type Out = { linked: true; scopes: string[] } | { denied: string; message?: string };
    const out: Out = await this.db.withTenant(org, async (c): Promise<Out> => {
      const inv = (await c.query(`SELECT id,patient_id,term_days FROM caregiver_invites WHERE organization_id=$1 AND code_hash=$2 AND used_at IS NULL AND cancelled_at IS NULL AND expires_at>now() FOR UPDATE`, [org, hashInviteCode(code)])).rows[0];
      if (!inv) return { denied: 'invalid_or_expired' };
      const self = await c.query(`SELECT 1 FROM patient_portal_links WHERE organization_id=$1 AND patient_id=$2 AND oidc_issuer=$3 AND oidc_sub=$4`, [org, inv.patient_id, req.principal.issuer, req.principal.sub]);
      if (self.rowCount) return { denied: 'self_invite' };
      const active = await c.query(`SELECT 1 FROM caregiver_links WHERE organization_id=$1 AND caregiver_issuer=$2 AND caregiver_sub=$3 AND revoked_at IS NULL AND expires_at>now()`, [org, req.principal.issuer, req.principal.sub]);
      if (active.rowCount) return { denied: 'already_linked', message: 'Sua conta já acompanha um paciente. Peça ao paciente atual para encerrar o acesso antes de aceitar outro convite.' };
      const gn = (req.principal.claims as Record<string, unknown>).given_name, name = typeof gn === 'string' ? gn.slice(0, 60) : null;
      const linkId = randomUUID();
      await c.query(`UPDATE caregiver_invites SET used_at=now(),used_by_issuer=$2,used_by_sub=$3 WHERE id=$1`, [inv.id, req.principal.issuer, req.principal.sub]);
      await c.query(`INSERT INTO caregiver_links(id,organization_id,patient_id,invite_id,caregiver_issuer,caregiver_sub,caregiver_display_name,scopes,expires_at,consent_accepted_at) VALUES($1,$2,$3,$4,$5,$6,$7,'{}',now()+make_interval(days=>$8::int),now())`,
        [linkId, org, inv.patient_id, inv.id, req.principal.issuer, req.principal.sub, name, inv.term_days]);
      await c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,'care.caregiver.accepted','patient',$4::jsonb)`, [org, req.principal.issuer, req.principal.sub, JSON.stringify({ patient_id: inv.patient_id, link_id: linkId, invite_id: inv.id, actor_role: 'caregiver', channel: 'care' })]);
      return { linked: true, scopes: [] };
    });
    if ('denied' in out) {
      // Auditoria da recusa em transação própria (a tentativa não altera nenhum convite).
      await this.db.withTenant(org, (c) => c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,'care.caregiver.invite.rejected','caregiver_invite',$4::jsonb)`, [org, req.principal.issuer, req.principal.sub, JSON.stringify({ reason: out.denied, channel: 'care' })]));
      throw new ForbiddenException(out.message ?? 'Código inválido, expirado ou já utilizado');
    }
    return out;
  }

  @Get('me/help')
  help(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c) => {
      const contacts = (await c.query(`SELECT label,phone,hours FROM organization_help_contacts WHERE organization_id=$1 ORDER BY sort_order,label`, [org])).rows;
      return { emergency: 'Em caso de emergência, ligue 192 (SAMU) ou procure o pronto-atendimento mais próximo.', contacts, contactsConfigured: contacts.length > 0 };
    });
  }
}
