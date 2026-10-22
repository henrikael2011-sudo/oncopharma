// M24 — painel base do farmacêutico hospitalar: fila de alertas (gravidade, depois tempo de espera) e visão por paciente
// (check-ins recentes, alertas, medicamentos). Dados: alertas existentes (Care → clinical_alerts) + alocação/medicações do
// conector hospitalar SIMULADO (integration-gateway, FHIR R4 fictício). Só leitura: o app não decide; a equipe avalia.
// Regras: MFA + vínculo profissional + vínculo assistencial por paciente; RLS por organização; leituras auditadas.
import { BadRequestException, Controller, ForbiddenException, Get, Headers, Param, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { syntheticApiEnabled } from './synthetic-mode';
import { careKey, openText } from './care-crypto';
import { ALERT_LABEL, type AlertState, primaryRole, ROLE_LABEL, type StaffRole } from './clinical-work-rules';
import { validateHospitalMeds } from './med-transcription-rules';
import { FEVER_THRESHOLD_C, isFever, locationLabel, POLL_SECONDS, SEVERITY_LABEL, SIMULATED_INTEGRATION, sortQueue, TEAM_ASSESSES, waitingMinutes } from './hospital-panel-rules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN = `status NOT IN ('resolved','dismissed','duplicate')`;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
type Staff = { role: StaffRole };
const ADHERENCE: Record<string, string> = { taken: 'Tomou', partial: 'Tomou só parte', missed: 'Não tomou' };

@Controller('clinical/panel')
@UseGuards(AuthGuard)
export class HospitalPanelController {
  constructor(private readonly db: DatabaseService) {}
  private run<T>(req: AuthenticatedRequest, org: string | undefined, work: (c: PoolClient, s: Staff) => Promise<T>): Promise<T> {
    if (!syntheticApiEnabled()) throw new ServiceUnavailableException('Clinical disponível somente em ambiente sintético');
    if (!org || !UUID.test(org)) throw new BadRequestException('Organização inválida');
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório para acesso profissional');
    return this.db.withTenant(org, async (c) => {
      const roles = (await c.query<{ role: string }>(`SELECT role FROM memberships WHERE organization_id=$1 AND oidc_issuer=$2 AND oidc_sub=$3 AND active=true`, [org, req.principal.issuer, req.principal.sub])).rows.map((r) => r.role);
      const role = primaryRole(roles); if (!role) throw new ForbiddenException('Sem vínculo profissional ativo nesta instituição');
      return work(c, { role });
    });
  }
  private audit(c: PoolClient, org: string, req: AuthenticatedRequest, action: string, s: Staff, meta: Record<string, string | number | null>) {
    return c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,$4,'hospital_panel',$5::jsonb)`,
      [org, req.principal.issuer, req.principal.sub, action, JSON.stringify({ ...meta, actor_role: s.role, channel: 'clinical' })]);
  }
  private meta(lastSync: { source_system: string; at: Date } | undefined) {
    return { simulated: true, integrationNotice: SIMULATED_INTEGRATION, teamNotice: TEAM_ASSESSES, feverThresholdC: FEVER_THRESHOLD_C, pollSeconds: POLL_SECONDS,
      lastSync: lastSync ? { source: lastSync.source_system, at: iso(lastSync.at) } : null, generatedAt: new Date().toISOString() };
  }

  /** Fila: alertas abertos dos pacientes vinculados ao profissional. Ordem: gravidade, depois espera (mais antigo primeiro). */
  @Get('queue')
  queue(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (c, s) => {
      const rows = (await c.query(`SELECT a.id,a.patient_id,a.code,a.level,a.status,a.explanation,a.created_at,r.description,r.details->>'reported_by' AS reported_by,
          p.display_name,p.hospital_record,pa.unit,pa.room,pa.bed,pa.source AS alloc_source
        FROM clinical_alerts a JOIN patients p ON p.id=a.patient_id AND p.organization_id=a.organization_id AND p.synthetic=true
        JOIN care_assignments ca ON ca.patient_id=p.id AND ca.organization_id=p.organization_id AND ca.oidc_issuer=$2 AND ca.oidc_sub=$3 AND ca.active=true
        LEFT JOIN patient_symptom_reports r ON r.id=a.source_report_id AND r.organization_id=a.organization_id
        LEFT JOIN patient_allocations pa ON pa.organization_id=p.organization_id AND pa.patient_id=p.id AND pa.superseded_at IS NULL
        WHERE a.organization_id=$1 AND a.${OPEN} ORDER BY CASE a.level WHEN 'urgent_review' THEN 0 ELSE 1 END, a.created_at ASC LIMIT 200`, [org, req.principal.issuer, req.principal.sub])).rows;
      const last = (await c.query(`SELECT source_system,at FROM allocation_sync_runs WHERE organization_id=$1 ORDER BY at DESC LIMIT 1`, [org])).rows[0];
      await this.audit(c, org, req, 'hospital_panel.queue.read', s, { result_count: rows.length });
      const items = sortQueue(rows.map((a) => ({ id: a.id, patientId: a.patient_id, patientName: a.display_name ?? 'Sem nome registrado', record: a.hospital_record,
        location: locationLabel(a), locationSource: a.alloc_source ?? null,
        code: a.code, level: a.level, levelLabel: SEVERITY_LABEL[a.level] ?? a.level, status: a.status, statusLabel: ALERT_LABEL[a.status as AlertState] ?? a.status,
        explanation: a.explanation, description: a.description, reportedBy: a.reported_by, createdAt: iso(a.created_at)!, waitingMinutes: waitingMinutes(iso(a.created_at)!) })));
      return { role: s.role, roleLabel: ROLE_LABEL[s.role], ...this.meta(last), counts: { urgent: items.filter((i) => i.level === 'urgent_review').length, review: items.filter((i) => i.level !== 'urgent_review').length }, items };
    });
  }

  /** Detalhe do paciente: check-ins recentes (14 dias), alertas e medicamentos (ativos + orais do hospital SIMULADO). */
  @Get('patients/:patientId')
  async patient(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    if (!UUID.test(patientId)) throw new BadRequestException('Paciente inválido');
    let k: Buffer | null = null; try { k = careKey().key; } catch { k = null; }
    const data = await this.run(req, org, async (c, s) => {
      const p = (await c.query(`SELECT p.id,p.display_name,p.hospital_record,pa.unit,pa.room,pa.bed,pa.source AS alloc_source,pa.recorded_at AS alloc_at FROM patients p
        JOIN care_assignments ca ON ca.patient_id=p.id AND ca.organization_id=p.organization_id AND ca.oidc_issuer=$3 AND ca.oidc_sub=$4 AND ca.active=true
        LEFT JOIN patient_allocations pa ON pa.organization_id=p.organization_id AND pa.patient_id=p.id AND pa.superseded_at IS NULL
        WHERE p.id=$1 AND p.organization_id=$2 AND p.synthetic=true`, [patientId, org, req.principal.issuer, req.principal.sub])).rows[0];
      if (!p) throw new ForbiddenException('Paciente não atribuído');
      const symptoms = (await c.query(`SELECT id,symptom_code,description,reported_at,triage_status,details->>'reported_by' AS reported_by,details->>'source' AS src FROM patient_symptom_reports
        WHERE organization_id=$1 AND patient_id=$2 AND reported_at>=now()-interval '14 days' ORDER BY reported_at DESC LIMIT 50`, [org, patientId])).rows;
      const temps = (await c.query(`SELECT id,value_encrypted,value_iv,value_tag,measured_at,recorded_by FROM patient_temperature_readings WHERE organization_id=$1 AND patient_id=$2 AND measured_at>=now()-interval '14 days' ORDER BY measured_at DESC LIMIT 50`, [org, patientId])).rows;
      const adherence = (await c.query(`SELECT r.id,r.status,r.reported_on,r.scheduled_time,r.created_at,o.medication FROM patient_adherence_reports r JOIN clinical_medication_orders o ON o.id=r.order_id AND o.organization_id=r.organization_id
        WHERE r.organization_id=$1 AND r.patient_id=$2 AND r.created_at>=now()-interval '14 days' ORDER BY r.created_at DESC LIMIT 50`, [org, patientId])).rows;
      const alerts = (await c.query(`SELECT id,code,level,status,explanation,created_at FROM clinical_alerts WHERE organization_id=$1 AND patient_id=$2 ORDER BY (${OPEN}) DESC, CASE level WHEN 'urgent_review' THEN 0 ELSE 1 END, created_at ASC LIMIT 50`, [org, patientId])).rows;
      const meds = (await c.query(`SELECT id,medication,route,frequency_text,status,ordered_at,source_reference FROM clinical_medication_orders WHERE organization_id=$1 AND patient_id=$2 AND status='active' ORDER BY medication LIMIT 50`, [org, patientId])).rows;
      const last = (await c.query(`SELECT source_system,at FROM allocation_sync_runs WHERE organization_id=$1 ORDER BY at DESC LIMIT 1`, [org])).rows[0];
      await this.audit(c, org, req, 'hospital_panel.patient.read', s, { patient_id: patientId });
      const checkins = [
        ...symptoms.map((x) => ({ kind: 'symptom' as const, id: x.id, at: iso(x.reported_at)!, label: x.src === 'temperature' ? 'Temperatura com febre (relato gerado)' : 'Sintoma relatado', detail: x.description, flagged: x.triage_status === 'urgent_review', by: x.reported_by })),
        ...temps.map((x) => { const v = k ? Number(openText({ ciphertext: x.value_encrypted, iv: x.value_iv, tag: x.value_tag }, k)) : null;
          return { kind: 'temperature' as const, id: x.id, at: iso(x.measured_at)!, label: 'Temperatura', detail: v === null ? 'Valor indisponível (chave de cifra não configurada)' : `${v.toFixed(1).replace('.', ',')} °C`, flagged: v !== null && isFever(v), by: x.recorded_by }; }),
        ...adherence.map((x) => ({ kind: 'adherence' as const, id: x.id, at: iso(x.created_at)!, label: 'Adesão relatada', detail: `${x.medication}: ${ADHERENCE[x.status] ?? x.status}${x.scheduled_time ? ` (${x.scheduled_time})` : ''}`, flagged: x.status !== 'taken', by: null })),
      ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 60);
      return { role: s.role, ...this.meta(last),
        patient: { id: p.id, name: p.display_name ?? 'Sem nome registrado', record: p.hospital_record, location: locationLabel(p), locationSource: p.alloc_source ?? null },
        alerts: sortQueue(alerts.map((a) => ({ id: a.id, code: a.code, level: a.level, levelLabel: SEVERITY_LABEL[a.level] ?? a.level, status: a.status, statusLabel: ALERT_LABEL[a.status as AlertState] ?? a.status, open: !['resolved', 'dismissed', 'duplicate'].includes(a.status), explanation: a.explanation, createdAt: iso(a.created_at)! }))),
        checkins, medications: meds.map((m) => ({ id: m.id, medication: m.medication, route: m.route, schedule: m.frequency_text, origin: String(m.source_reference).startsWith('transcr:') ? 'Transcrição liberada pela farmácia' : 'Registro sintético' })) };
    });
    return { ...data, hospitalMeds: await this.hospitalOral(data.patient.record) };
  }
  private async hospitalOral(record: string | null) {
    const base = process.env.INTEGRATION_GATEWAY_URL, token = process.env.INTEGRATION_GATEWAY_TOKEN;
    if (!record) return { available: false, simulated: true, reason: 'Paciente sem prontuário hospitalar', items: [] };
    if (!base || !token) return { available: false, simulated: true, reason: 'Conector hospitalar simulado não configurado', items: [] };
    try {
      const r = await fetch(`${base.replace(/\/$/, '')}/v1/medications?record=${encodeURIComponent(record)}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
      if (!r.ok) throw new Error(String(r.status));
      const f = validateHospitalMeds(await r.json());
      return { available: true, simulated: true, source: f.source, items: f.items.map((i: { ref: string; medication: string; route: string; times: string[]; frequency: string }) => ({ ref: i.ref, medication: i.medication, route: i.route, times: i.times, frequency: i.frequency })) };
    } catch { return { available: false, simulated: true, reason: 'Sistema do hospital (simulado) indisponível agora', items: [] }; }
  }
}
