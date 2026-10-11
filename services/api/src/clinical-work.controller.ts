// M15.4 — API do ONCOPHARMA Clinical (lista, busca, paciente sob demanda, estados de alerta, tarefas, pré-ciclo, linha do tempo).
// Regras: MFA + vínculo profissional ativo + vínculo assistencial (care_assignments) por paciente; RLS por organização;
// lista NUNCA traz dado clínico detalhado (diretrizes de design §3); toda leitura de paciente e toda escrita é auditada.
import { BadGatewayException, BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers, Param, Post, Query, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { syntheticApiEnabled } from './synthetic-mode';
import { type Allocation, allocationLabel, FORMAT_LABEL, normalizeAllocation, syncOutcome, validateFeed } from './allocation-rules';
import { ALERT_LABEL, ALERT_STATES, type AlertState, allowedTransitions, canTransition, FINAL_STATES, normalizeSearch, preCycleChecklist, primaryRole, ROLE_LABEL, SQL_FOLD, STAFF_ROLES, type StaffRole } from './clinical-work-rules';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN = `status NOT IN ('resolved','dismissed','duplicate')`;
type Staff = { role: StaffRole; roles: string[] };
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
function text(v: unknown, min: number, max: number, field: string, optional = false): string | null {
  if (optional && (v === undefined || v === null || v === '')) return null;
  if (typeof v !== 'string' || v.trim().length < min || v.length > max) throw new BadRequestException(`${field}: informe entre ${min} e ${max} caracteres`);
  return v.trim();
}
const id = (v: string, what: string) => { if (!UUID.test(v)) throw new BadRequestException(`${what} inválido`); return v; };

@Controller('clinical')
@UseGuards(AuthGuard)
export class ClinicalWorkController {
  constructor(private readonly db: DatabaseService) {}

  private async run<T>(req: AuthenticatedRequest, org: string | undefined, work: (c: PoolClient, s: Staff) => Promise<T>): Promise<T> {
    if (!syntheticApiEnabled()) throw new ServiceUnavailableException('Clinical disponível somente em ambiente sintético');
    if (!org || !UUID.test(org)) throw new BadRequestException('Organização inválida');
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório para acesso profissional');
    return this.db.withTenant(org, async (c) => {
      const roles = (await c.query<{ role: string }>(`SELECT role FROM memberships WHERE organization_id=$1 AND oidc_issuer=$2 AND oidc_sub=$3 AND active=true`, [org, req.principal.issuer, req.principal.sub])).rows.map((r) => r.role);
      const role = primaryRole(roles);
      if (!role) throw new ForbiddenException('Sem vínculo profissional ativo nesta instituição');
      return work(c, { role, roles });
    });
  }
  private async linked(c: PoolClient, org: string, req: AuthenticatedRequest, patientId: string) {
    const r = await c.query(`SELECT p.id,p.display_name,p.hospital_record FROM patients p JOIN care_assignments a ON a.patient_id=p.id AND a.organization_id=p.organization_id
      WHERE p.id=$1 AND p.organization_id=$2 AND p.synthetic=true AND a.oidc_issuer=$3 AND a.oidc_sub=$4 AND a.active=true`, [patientId, org, req.principal.issuer, req.principal.sub]);
    if (!r.rowCount) throw new ForbiddenException('Paciente não atribuído');
    return r.rows[0] as { id: string; display_name: string | null; hospital_record: string | null };
  }
  private audit(c: PoolClient, org: string, req: AuthenticatedRequest, action: string, s: Staff, resource: string, meta: Record<string, string | number | boolean | null> = {}) {
    return c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
      [org, req.principal.issuer, req.principal.sub, action, resource, JSON.stringify({ ...meta, actor_role: s.role, channel: 'clinical' })]);
  }

  @Get('me')
  me(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    return this.run(req, org, async (_c, s) => ({ role: s.role, roleLabel: ROLE_LABEL[s.role], roles: s.roles.filter((r) => (STAFF_ROLES as readonly string[]).includes(r)), mfa: true,
      name: typeof req.principal.claims.given_name === 'string' ? req.principal.claims.given_name.slice(0, 60) : null }));
  }

  /** Lista mínima (identificação segura + gravidade + pendências). Busca restrita ao vínculo: sem vínculo => lista vazia. */
  @Get('worklist')
  worklist(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Query('q') q?: string) {
    const term = normalizeSearch(q);
    if (q && !term) throw new BadRequestException('Busca: use de 2 a 60 caracteres');
    return this.run(req, org, async (c, s) => {
      const params: unknown[] = [org, req.principal.issuer, req.principal.sub];
      let filter = '';
      if (term) { params.push(`%${term}%`); filter = `AND (${SQL_FOLD('p.display_name')} LIKE $4 OR lower(p.hospital_record) LIKE $4)`; }
      const rows = (await c.query(`SELECT p.id,p.display_name,p.hospital_record,
          (SELECT max(CASE a.level WHEN 'urgent_review' THEN 2 ELSE 1 END) FROM clinical_alerts a WHERE a.organization_id=p.organization_id AND a.patient_id=p.id AND a.${OPEN}) AS sev,
          (SELECT count(*) FROM clinical_alerts a WHERE a.organization_id=p.organization_id AND a.patient_id=p.id AND a.${OPEN})::int AS open_alerts,
          (SELECT count(*) FROM clinical_tasks t WHERE t.organization_id=p.organization_id AND t.patient_id=p.id AND t.status IN ('open','received'))::int AS open_tasks,
          pa.unit, pa.floor, pa.room, pa.bed, pa.source AS alloc_source,
          EXISTS (SELECT 1 FROM allocation_sync_items i WHERE i.organization_id=p.organization_id AND i.patient_id=p.id AND i.outcome='conflict' AND i.resolved_at IS NULL) AS alloc_conflict
        FROM patients p JOIN care_assignments ca ON ca.patient_id=p.id AND ca.organization_id=p.organization_id
        LEFT JOIN patient_allocations pa ON pa.organization_id=p.organization_id AND pa.patient_id=p.id AND pa.superseded_at IS NULL
        WHERE p.organization_id=$1 AND p.synthetic=true AND ca.oidc_issuer=$2 AND ca.oidc_sub=$3 AND ca.active=true ${filter}
        ORDER BY sev DESC NULLS LAST, p.display_name NULLS LAST LIMIT 100`, params)).rows;
      await this.audit(c, org, req, term ? 'patient.search' : 'patient.worklist', s, 'patient', { result_count: rows.length, query_length: term ? term.length : 0 });
      const last = (await c.query(`SELECT source_system,source_format,at FROM allocation_sync_runs WHERE organization_id=$1 ORDER BY at DESC LIMIT 1`, [org])).rows[0];
      return {
        patients: rows.map((r) => ({ id: r.id, name: r.display_name ?? 'Sem nome registrado', record: r.hospital_record, severity: r.sev === 2 ? 'urgent' : r.sev === 1 ? 'review' : null, pending: r.open_alerts + r.open_tasks,
          allocation: r.unit ? { unit: r.unit, floor: r.floor, room: r.room, bed: r.bed, source: r.alloc_source, conflict: r.alloc_conflict } : null })),
        searched: !!term,
        lastSync: last ? { at: iso(last.at), source: `${last.source_system} · ${FORMAT_LABEL[last.source_format]}` } : null,
      };
    });
  }

  /** Paciente aberto (sob demanda): cabeçalho, alertas com ações permitidas ao papel e tarefas. */
  @Get('patients/:patientId')
  patient(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    id(patientId, 'Paciente');
    return this.run(req, org, async (c, s) => {
      const p = await this.linked(c, org, req, patientId);
      const alerts = (await c.query(`SELECT a.id,a.code,a.level,a.status,a.rule_version,a.explanation,a.created_at,a.status_changed_at,a.duplicate_of,r.description,r.symptom_code,r.details->>'reported_by' AS reported_by
        FROM clinical_alerts a LEFT JOIN patient_symptom_reports r ON r.id=a.source_report_id AND r.organization_id=a.organization_id
        WHERE a.organization_id=$1 AND a.patient_id=$2 ORDER BY (a.${OPEN}) DESC, CASE a.level WHEN 'urgent_review' THEN 0 ELSE 1 END, a.created_at DESC LIMIT 50`, [org, patientId])).rows;
      const tasks = (await c.query(`SELECT id,kind,title,details,assignee_role,due_at,status,created_at,created_by_sub,received_at,closed_at,outcome,alert_id FROM clinical_tasks
        WHERE organization_id=$1 AND patient_id=$2 ORDER BY (status IN ('open','received')) DESC, due_at NULLS LAST, created_at DESC LIMIT 50`, [org, patientId])).rows;
      await this.audit(c, org, req, 'patient.overview.read', s, 'patient', { patient_id: patientId });
      return {
        patient: { id: p.id, name: p.display_name ?? 'Sem nome registrado', record: p.hospital_record },
        allocation: await this.allocationView(c, org, patientId),
        role: s.role,
        alerts: alerts.map((a) => ({ id: a.id, code: a.code, level: a.level, status: a.status, statusLabel: ALERT_LABEL[a.status as AlertState], ruleVersion: a.rule_version, explanation: a.explanation,
          description: a.description, reportedBy: a.reported_by, createdAt: iso(a.created_at), changedAt: iso(a.status_changed_at), duplicateOf: a.duplicate_of,
          final: FINAL_STATES.includes(a.status), actions: allowedTransitions(s.role, a.status).map((to) => ({ to, label: ALERT_LABEL[to] })) })),
        tasks: tasks.map((t) => ({ id: t.id, kind: t.kind, title: t.title, details: t.details, assigneeRole: t.assignee_role, assigneeLabel: ROLE_LABEL[t.assignee_role as StaffRole], dueAt: iso(t.due_at), status: t.status,
          createdAt: iso(t.created_at), mine: t.created_by_sub === req.principal.sub, receivedAt: iso(t.received_at), closedAt: iso(t.closed_at), outcome: t.outcome, alertId: t.alert_id,
          canReceive: t.status === 'open' && t.assignee_role === s.role, canComplete: t.status === 'received' && t.assignee_role === s.role, canCancel: ['open', 'received'].includes(t.status) && t.created_by_sub === req.principal.sub })),
        interventionAllowed: s.role === 'pharmacist',
      };
    });
  }

  @Post('alerts/:alertId/transition')
  transition(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('alertId') alertId: string, @Body() body: Record<string, unknown>) {
    id(alertId, 'Alerta');
    const to = String(body?.to ?? '') as AlertState;
    if (!ALERT_STATES.includes(to)) throw new BadRequestException('Estado inválido');
    const justification = text(body?.justification, to === 'dismissed' ? 10 : 3, 2000, 'Justificativa', to !== 'dismissed');
    const duplicateOf = to === 'duplicate' ? id(String(body?.duplicateOf ?? ''), 'Alerta original') : null;
    return this.run(req, org, async (c, s) => this.applyTransition(c, org, req, s, alertId, to, justification, duplicateOf));
  }
  private async applyTransition(c: PoolClient, org: string, req: AuthenticatedRequest, s: Staff, alertId: string, to: AlertState, justification: string | null, duplicateOf: string | null) {
    const a = (await c.query(`SELECT id,patient_id,status FROM clinical_alerts WHERE id=$1 AND organization_id=$2 FOR UPDATE`, [alertId, org])).rows[0];
    if (!a) throw new ForbiddenException('Alerta não localizado');
    await this.linked(c, org, req, a.patient_id);
    if (!canTransition(s.role, a.status, to)) throw new ForbiddenException(`Ação não permitida para ${ROLE_LABEL[s.role]} em "${ALERT_LABEL[a.status as AlertState]}"`);
    if (duplicateOf) {
      const o = await c.query(`SELECT 1 FROM clinical_alerts WHERE id=$1 AND organization_id=$2 AND patient_id=$3 AND id<>$4 AND status<>'duplicate'`, [duplicateOf, org, a.patient_id, alertId]);
      if (!o.rowCount) throw new BadRequestException('Alerta original deve ser outro alerta do mesmo paciente');
    }
    await c.query(`INSERT INTO clinical_alert_transitions(organization_id,alert_id,from_status,to_status,justification,actor_issuer,actor_sub,actor_role) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [org, alertId, a.status, to, justification, req.principal.issuer, req.principal.sub, s.role]);
    await c.query(`UPDATE clinical_alerts SET status=$3, duplicate_of=$4 WHERE id=$1 AND organization_id=$2`, [alertId, org, to, duplicateOf]);
    await this.audit(c, org, req, 'alert.transition', s, 'clinical_alert', { alert_id: alertId, patient_id: a.patient_id, from: a.status, to });
    return { alertId, from: a.status, to, label: ALERT_LABEL[to] };
  }

  // ---------- M15.4b — alocação hospitalar ----------
  private async current(c: PoolClient, org: string, patientId: string) {
    return (await c.query(`SELECT id,unit,floor,room,bed,source,recorded_at,recorded_by_role,sync_run_id FROM patient_allocations WHERE organization_id=$1 AND patient_id=$2 AND superseded_at IS NULL FOR UPDATE`, [org, patientId])).rows[0] as
      (Allocation & { id: string; source: 'hospital' | 'manual'; recorded_at: Date; recorded_by_role: StaffRole; sync_run_id: string | null }) | undefined;
  }
  private async allocationView(c: PoolClient, org: string, patientId: string) {
    const a = (await c.query(`SELECT pa.unit,pa.floor,pa.room,pa.bed,pa.source,pa.recorded_at,pa.recorded_by_role,r.source_system,r.source_format
      FROM patient_allocations pa LEFT JOIN allocation_sync_runs r ON r.id=pa.sync_run_id WHERE pa.organization_id=$1 AND pa.patient_id=$2 AND pa.superseded_at IS NULL`, [org, patientId])).rows[0];
    const conflict = (await c.query(`SELECT i.unit,i.floor,i.room,i.bed,r.at,r.source_system,r.source_format FROM allocation_sync_items i JOIN allocation_sync_runs r ON r.id=i.run_id
      WHERE i.organization_id=$1 AND i.patient_id=$2 AND i.outcome='conflict' AND i.resolved_at IS NULL ORDER BY r.at DESC LIMIT 1`, [org, patientId])).rows[0];
    return {
      current: a ? { unit: a.unit, floor: a.floor, room: a.room, bed: a.bed, label: allocationLabel(a), source: a.source, at: iso(a.recorded_at),
        origin: a.source === 'hospital' ? `${a.source_system} · ${FORMAT_LABEL[a.source_format]}` : ROLE_LABEL[a.recorded_by_role as StaffRole] } : null,
      conflict: conflict ? { label: allocationLabel(conflict), at: iso(conflict.at), origin: `${conflict.source_system} · ${FORMAT_LABEL[conflict.source_format]}` } : null,
      manualAllowed: !a || a.source === 'manual',
    };
  }
  private async supersede(c: PoolClient, org: string, cur: { id: string } | undefined) {
    if (cur) await c.query(`UPDATE patient_allocations SET superseded_at=now() WHERE id=$1 AND organization_id=$2 AND superseded_at IS NULL`, [cur.id, org]);
  }

  /** "Sincronizar": integration-gateway (hospital simulado) → normaliza → aplica. Manual divergente nunca é sobrescrita (vira divergência). */
  @Post('allocations/sync')
  async sync(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    await this.run(req, org, async () => null); // autoriza (MFA + vínculo profissional) antes de chamar o gateway
    const base = process.env.INTEGRATION_GATEWAY_URL, token = process.env.INTEGRATION_GATEWAY_TOKEN;
    if (!base || !token) throw new ServiceUnavailableException('Integração hospitalar não configurada');
    let feed: ReturnType<typeof validateFeed>;
    try {
      const r = await fetch(`${base.replace(/\/$/, '')}/v1/locations`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`gateway ${r.status}`);
      feed = validateFeed(await r.json());
    } catch { throw new BadGatewayException('Não foi possível sincronizar com o hospital agora. Tente novamente.'); }
    return this.run(req, org, async (c, s) => {
      const run = (await c.query(`INSERT INTO allocation_sync_runs(organization_id,source_system,source_format,adapter_version,fetched_at,actor_issuer,actor_sub,actor_role,received)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,at`, [org, feed.source, feed.format, feed.adapterVersion, feed.fetchedAt, req.principal.issuer, req.principal.sub, s.role, feed.items.length])).rows[0];
      const n = { updated: 0, unchanged: 0, conflicts: 0, not_found: 0 };
      for (const it of feed.items) {
        const p = (await c.query(`SELECT id FROM patients WHERE organization_id=$1 AND hospital_record=$2 AND synthetic=true`, [org, it.record])).rows[0];
        let outcome: string;
        if (!p) { outcome = 'not_found'; n.not_found++; }
        else {
          const cur = await this.current(c, org, p.id);
          outcome = syncOutcome(cur ?? null, it);
          if (outcome === 'updated' || outcome === 'confirmed') {
            await this.supersede(c, org, cur);
            await c.query(`INSERT INTO patient_allocations(organization_id,patient_id,unit,floor,room,bed,source,sync_run_id,source_ref,recorded_by_issuer,recorded_by_sub,recorded_by_role)
              VALUES($1,$2,$3,$4,$5,$6,'hospital',$7,$8,$9,$10,$11)`, [org, p.id, it.unit, it.floor, it.room, it.bed, run.id, it.ref, req.principal.issuer, req.principal.sub, s.role]);
            // Hospital passou a informar (igual ou atualizado): divergências pendentes deixam de valer.
            await c.query(`UPDATE allocation_sync_items SET resolved_at=now(),resolved_by_sub=$3,resolution='accepted_hospital' WHERE organization_id=$1 AND patient_id=$2 AND outcome='conflict' AND resolved_at IS NULL`, [org, p.id, req.principal.sub]);
            n.updated += outcome === 'updated' ? 1 : 0; n.unchanged += outcome === 'confirmed' ? 1 : 0;
          } else if (outcome === 'unchanged') n.unchanged++;
          else n.conflicts++;
        }
        await c.query(`INSERT INTO allocation_sync_items(organization_id,run_id,patient_id,hospital_record,unit,floor,room,bed,source_ref,outcome) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [org, run.id, p?.id ?? null, it.record, it.unit, it.floor, it.room, it.bed, it.ref, outcome]);
      }
      await c.query(`UPDATE allocation_sync_runs SET updated=$2,unchanged=$3,conflicts=$4,not_found=$5 WHERE id=$1`, [run.id, n.updated, n.unchanged, n.conflicts, n.not_found]);
      await this.audit(c, org, req, 'allocation.sync', s, 'allocation_sync_run', { run_id: run.id, format: feed.format, received: feed.items.length, ...n });
      // Somente contagens: nomes/prontuários de pacientes fora do vínculo nunca são devolvidos.
      return { runId: run.id, at: iso(run.at), source: `${feed.source} · ${FORMAT_LABEL[feed.format]}`, received: feed.items.length, ...n };
    });
  }

  /** Preenchimento manual: só quando o hospital não informa a alocação (ou ela já é manual). Autor/papel/horário registrados. */
  @Post('patients/:patientId/allocation')
  manualAllocation(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string, @Body() body: Record<string, unknown>) {
    id(patientId, 'Paciente');
    let a: Allocation; try { a = normalizeAllocation(body); } catch (e) { throw new BadRequestException((e as Error).message); }
    return this.run(req, org, async (c, s) => {
      await this.linked(c, org, req, patientId);
      const cur = await this.current(c, org, patientId);
      if (cur?.source === 'hospital') throw new ConflictException('Alocação informada pelo hospital. Use "Sincronizar" para atualizar.');
      await this.supersede(c, org, cur);
      await c.query(`INSERT INTO patient_allocations(organization_id,patient_id,unit,floor,room,bed,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES($1,$2,$3,$4,$5,$6,'manual',$7,$8,$9)`,
        [org, patientId, a.unit, a.floor, a.room, a.bed, req.principal.issuer, req.principal.sub, s.role]);
      await c.query(`UPDATE allocation_sync_items SET resolved_at=now(),resolved_by_sub=$3,resolution='kept_manual' WHERE organization_id=$1 AND patient_id=$2 AND outcome='conflict' AND resolved_at IS NULL`, [org, patientId, req.principal.sub]);
      await this.audit(c, org, req, 'allocation.manual', s, 'patient_allocation', { patient_id: patientId, replaced_manual: !!cur });
      return this.allocationView(c, org, patientId);
    });
  }

  /** Divergência hospital × manual: decisão humana explícita (usar dado do hospital ou manter o manual). */
  @Post('patients/:patientId/allocation/conflict')
  resolveConflict(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string, @Body() body: Record<string, unknown>) {
    id(patientId, 'Paciente');
    const resolution = body?.resolution === 'accepted_hospital' ? 'accepted_hospital' : body?.resolution === 'kept_manual' ? 'kept_manual' : null;
    if (!resolution) throw new BadRequestException('Resolução inválida');
    return this.run(req, org, async (c, s) => {
      await this.linked(c, org, req, patientId);
      const item = (await c.query(`SELECT i.id,i.unit,i.floor,i.room,i.bed,i.run_id,i.source_ref FROM allocation_sync_items i JOIN allocation_sync_runs r ON r.id=i.run_id
        WHERE i.organization_id=$1 AND i.patient_id=$2 AND i.outcome='conflict' AND i.resolved_at IS NULL ORDER BY r.at DESC LIMIT 1 FOR UPDATE OF i`, [org, patientId])).rows[0];
      if (!item) throw new ConflictException('Não há divergência pendente para este paciente');
      if (resolution === 'accepted_hospital') {
        await this.supersede(c, org, await this.current(c, org, patientId));
        await c.query(`INSERT INTO patient_allocations(organization_id,patient_id,unit,floor,room,bed,source,sync_run_id,source_ref,recorded_by_issuer,recorded_by_sub,recorded_by_role)
          VALUES($1,$2,$3,$4,$5,$6,'hospital',$7,$8,$9,$10,$11)`, [org, patientId, item.unit, item.floor, item.room, item.bed, item.run_id, item.source_ref, req.principal.issuer, req.principal.sub, s.role]);
      }
      await c.query(`UPDATE allocation_sync_items SET resolved_at=now(),resolved_by_sub=$3,resolution=$4 WHERE organization_id=$1 AND patient_id=$2 AND outcome='conflict' AND resolved_at IS NULL`, [org, patientId, req.principal.sub, resolution]);
      await this.audit(c, org, req, 'allocation.conflict.resolved', s, 'patient_allocation', { patient_id: patientId, resolution });
      return this.allocationView(c, org, patientId);
    });
  }

  @Post('patients/:patientId/tasks')
  createTask(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string, @Body() body: Record<string, unknown>) {
    id(patientId, 'Paciente');
    const kind = body?.kind === 'referral' ? 'referral' : body?.kind === 'task' ? 'task' : null;
    if (!kind) throw new BadRequestException('Tipo inválido');
    const title = text(body?.title, 3, 160, 'Título')!, details = text(body?.details, 1, 2000, 'Detalhes', true);
    const assigneeRole = String(body?.assigneeRole ?? '') as StaffRole;
    if (!(STAFF_ROLES as readonly string[]).includes(assigneeRole)) throw new BadRequestException('Responsável inválido');
    let dueAt: string | null = null;
    if (body?.dueAt) { const d = Date.parse(String(body.dueAt)); if (Number.isNaN(d) || d < Date.now() - 60_000 || d > Date.now() + 90 * 86_400_000) throw new BadRequestException('Prazo inválido'); dueAt = new Date(d).toISOString(); }
    const alertId = body?.alertId ? id(String(body.alertId), 'Alerta') : null;
    return this.run(req, org, async (c, s) => {
      await this.linked(c, org, req, patientId);
      if (s.role === 'clinical_manager') throw new ForbiddenException('Gestão clínica não cria tarefas assistenciais');
      if (alertId) { const a = await c.query(`SELECT status FROM clinical_alerts WHERE id=$1 AND organization_id=$2 AND patient_id=$3`, [alertId, org, patientId]); if (!a.rowCount) throw new BadRequestException('Alerta não pertence ao paciente'); }
      const taskId = randomUUID();
      await c.query(`INSERT INTO clinical_tasks(id,organization_id,patient_id,alert_id,kind,title,details,assignee_role,due_at,created_by_issuer,created_by_sub) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [taskId, org, patientId, alertId, kind, title, details, assigneeRole, dueAt, req.principal.issuer, req.principal.sub]);
      await this.audit(c, org, req, kind === 'referral' ? 'referral.created' : 'task.created', s, 'clinical_task', { task_id: taskId, patient_id: patientId, alert_id: alertId, assignee_role: assigneeRole });
      let alert = null;
      if (kind === 'referral' && alertId) {
        const st = (await c.query(`SELECT status FROM clinical_alerts WHERE id=$1 AND organization_id=$2`, [alertId, org])).rows[0]?.status as AlertState;
        if (canTransition(s.role, st, 'referred')) alert = await this.applyTransition(c, org, req, s, alertId, 'referred', `Encaminhado a ${ROLE_LABEL[assigneeRole]}: ${title}`, null);
      }
      return { taskId, alert };
    });
  }
  private async task(c: PoolClient, org: string, req: AuthenticatedRequest, taskId: string) {
    const t = (await c.query(`SELECT * FROM clinical_tasks WHERE id=$1 AND organization_id=$2 FOR UPDATE`, [id(taskId, 'Tarefa'), org])).rows[0];
    if (!t) throw new ForbiddenException('Tarefa não localizada');
    await this.linked(c, org, req, t.patient_id);
    return t;
  }
  @Post('tasks/:taskId/receive')
  receive(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('taskId') taskId: string) {
    return this.run(req, org, async (c, s) => {
      const t = await this.task(c, org, req, taskId);
      if (t.status !== 'open' || t.assignee_role !== s.role) throw new ForbiddenException('Somente o responsável confirma o recebimento de tarefa aberta');
      await c.query(`UPDATE clinical_tasks SET status='received',received_by_sub=$3,received_at=now() WHERE id=$1 AND organization_id=$2`, [taskId, org, req.principal.sub]);
      await this.audit(c, org, req, 'task.received', s, 'clinical_task', { task_id: taskId, patient_id: t.patient_id });
      return { taskId, status: 'received' };
    });
  }
  @Post('tasks/:taskId/complete')
  complete(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('taskId') taskId: string, @Body() body: Record<string, unknown>) {
    const outcome = text(body?.outcome, 3, 2000, 'Desfecho')!;
    return this.run(req, org, async (c, s) => {
      const t = await this.task(c, org, req, taskId);
      if (t.status !== 'received' || t.assignee_role !== s.role) throw new ForbiddenException('Confirme o recebimento antes de concluir; somente o responsável conclui');
      await c.query(`UPDATE clinical_tasks SET status='done',closed_by_sub=$3,closed_at=now(),outcome=$4 WHERE id=$1 AND organization_id=$2`, [taskId, org, req.principal.sub, outcome]);
      await this.audit(c, org, req, 'task.completed', s, 'clinical_task', { task_id: taskId, patient_id: t.patient_id });
      return { taskId, status: 'done' };
    });
  }
  @Post('tasks/:taskId/cancel')
  cancel(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('taskId') taskId: string, @Body() body: Record<string, unknown>) {
    const reason = text(body?.reason, 3, 2000, 'Motivo')!;
    return this.run(req, org, async (c, s) => {
      const t = await this.task(c, org, req, taskId);
      if (!['open', 'received'].includes(t.status) || t.created_by_sub !== req.principal.sub) throw new ForbiddenException('Somente quem criou cancela tarefa em aberto');
      await c.query(`UPDATE clinical_tasks SET status='cancelled',closed_by_sub=$3,closed_at=now(),outcome=$4 WHERE id=$1 AND organization_id=$2`, [taskId, org, req.principal.sub, reason]);
      await this.audit(c, org, req, 'task.cancelled', s, 'clinical_task', { task_id: taskId, patient_id: t.patient_id });
      return { taskId, status: 'cancelled' };
    });
  }

  /** Checklist pré-ciclo de disponibilidade de dados + pareceres registrados (sem decisão automática). */
  @Get('patients/:patientId/precycle')
  precycle(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    id(patientId, 'Paciente');
    return this.run(req, org, async (c, s) => {
      await this.linked(c, org, req, patientId);
      const result = await this.checklist(c, org, patientId);
      const reviews = (await c.query(`SELECT id,status,rationale,created_at,actor_sub FROM clinical_reviews WHERE organization_id=$1 AND patient_id=$2 AND review_type='pre_cycle' ORDER BY created_at DESC LIMIT 10`, [org, patientId])).rows
        .map((r) => ({ id: r.id, status: r.status, rationale: r.rationale, at: iso(r.created_at), mine: r.actor_sub === req.principal.sub }));
      await this.audit(c, org, req, 'patient.precycle.read', s, 'patient', { patient_id: patientId });
      return { ...result, reviews, canReview: s.role === 'pharmacist' || s.role === 'physician' };
    });
  }
  private async checklist(c: PoolClient, org: string, patientId: string) {
    const cy = (await c.query(`SELECT c.id,c.cycle_number,c.planned_on::text AS planned_on,pr.code,pr.approved FROM treatment_cycles c JOIN oncology_protocols pr ON pr.id=c.protocol_id AND pr.organization_id=c.organization_id
      WHERE c.organization_id=$1 AND c.patient_id=$2 AND c.status IN ('planned','under_review') ORDER BY c.planned_on NULLS LAST LIMIT 1`, [org, patientId])).rows[0];
    const labs = (await c.query(`SELECT analyte_code,analyte_label,collected_at,source_reference FROM clinical_labs WHERE organization_id=$1 AND patient_id=$2 ORDER BY collected_at DESC LIMIT 50`, [org, patientId])).rows;
    const w = (await c.query(`SELECT measured_at,source_reference FROM clinical_measurements WHERE organization_id=$1 AND patient_id=$2 AND kind='weight' ORDER BY measured_at DESC LIMIT 1`, [org, patientId])).rows[0];
    const al = (await c.query(`SELECT status,recorded_at,source_reference FROM clinical_allergies WHERE organization_id=$1 AND patient_id=$2 ORDER BY recorded_at DESC LIMIT 20`, [org, patientId])).rows;
    const rec = (await c.query(`SELECT review_status,authored_at,source_reference FROM pharmacy_assessments WHERE organization_id=$1 AND patient_id=$2 AND title ILIKE 'Concilia%' ORDER BY authored_at DESC LIMIT 1`, [org, patientId])).rows[0];
    return {
      cycleId: cy?.id ?? null,
      ...preCycleChecklist({
        cycle: cy ? { number: cy.cycle_number, plannedOn: cy.planned_on, protocolCode: cy.code, protocolApproved: cy.approved === true } : null,
        labs: labs.map((l) => ({ code: l.analyte_code, label: l.analyte_label, collectedAt: iso(l.collected_at)!, source: l.source_reference })),
        weight: w ? { at: iso(w.measured_at)!, source: w.source_reference } : null,
        allergies: al.map((a) => ({ status: a.status, at: iso(a.recorded_at)!, source: a.source_reference })),
        reconciliation: rec ? { status: rec.review_status, at: iso(rec.authored_at)!, source: rec.source_reference } : null,
      }),
    };
  }
  @Post('patients/:patientId/precycle/reviews')
  precycleReview(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string, @Body() body: Record<string, unknown>) {
    id(patientId, 'Paciente');
    const decision = body?.decision === 'reviewed' ? 'reviewed' : body?.decision === 'blocked' ? 'blocked' : null;
    if (!decision) throw new BadRequestException('Parecer inválido');
    const rationale = text(body?.rationale, 10, 2000, 'Fundamentação')!;
    return this.run(req, org, async (c, s) => {
      await this.linked(c, org, req, patientId);
      if (s.role !== 'pharmacist' && s.role !== 'physician') throw new ForbiddenException('Parecer pré-ciclo: farmácia ou medicina');
      const snap = await this.checklist(c, org, patientId);
      if (!snap.cycleId) throw new BadRequestException('Sem ciclo planejado');
      const reviewId = randomUUID();
      await c.query(`INSERT INTO clinical_reviews(id,organization_id,patient_id,cycle_id,review_type,status,checklist,rationale,actor_issuer,actor_sub,reviewed_at) VALUES($1,$2,$3,$4,'pre_cycle',$5,$6::jsonb,$7,$8,$9,now())`,
        [reviewId, org, patientId, snap.cycleId, decision, JSON.stringify({ items: snap.items, conclusion: snap.conclusion, automaticDecision: false }), rationale, req.principal.issuer, req.principal.sub]);
      await this.audit(c, org, req, 'precycle.reviewed', s, 'clinical_review', { review_id: reviewId, patient_id: patientId, decision, data_complete: snap.conclusion === 'data_available' });
      return { reviewId, decision };
    });
  }

  /** Linha do tempo multiprofissional com origem e horário de cada registro. */
  @Get('patients/:patientId/timeline')
  timeline(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    id(patientId, 'Paciente');
    return this.run(req, org, async (c, s) => {
      await this.linked(c, org, req, patientId);
      const P = [org, patientId];
      const q = async (sql: string) => (await c.query(sql, P)).rows;
      const items = [
        ...(await q(`SELECT reported_at AS at,symptom_code,description,triage_status,details->>'reported_by' AS by FROM patient_symptom_reports WHERE organization_id=$1 AND patient_id=$2 ORDER BY reported_at DESC LIMIT 50`))
          .map((r) => ({ at: iso(r.at), kind: 'symptom', title: 'Relato no Care', detail: r.description, source: r.by === 'caregiver' ? 'Care — cuidador' : 'Care — paciente', urgent: r.triage_status === 'urgent_review' })),
        ...(await q(`SELECT t.at,t.from_status,t.to_status,t.actor_role,t.justification,a.code FROM clinical_alert_transitions t JOIN clinical_alerts a ON a.id=t.alert_id AND a.organization_id=t.organization_id WHERE t.organization_id=$1 AND a.patient_id=$2 ORDER BY t.at DESC LIMIT 100`))
          .map((r) => ({ at: iso(r.at), kind: 'alert', title: `Alerta ${r.code}: ${ALERT_LABEL[r.from_status as AlertState]} → ${ALERT_LABEL[r.to_status as AlertState]}`, detail: r.justification, source: `ONCOPHARMA Clinical — ${ROLE_LABEL[r.actor_role as StaffRole]}` })),
        ...(await q(`SELECT created_at AS at,code,level,rule_version FROM clinical_alerts WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 50`))
          .map((r) => ({ at: iso(r.at), kind: 'alert', title: `Alerta criado: ${r.code}`, detail: r.level === 'urgent_review' ? 'Revisão urgente' : 'Requer revisão', source: `Regra ${r.rule_version}` })),
        ...(await q(`SELECT created_at AS at,decision,note FROM clinical_interventions WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 50`))
          .map((r) => ({ at: iso(r.at), kind: 'intervention', title: 'Intervenção farmacêutica registrada', detail: r.note, source: 'ONCOPHARMA Clinical — Farmácia' })),
        ...(await q(`SELECT created_at AS at,kind,title,assignee_role,status FROM clinical_tasks WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 50`))
          .map((r) => ({ at: iso(r.at), kind: 'task', title: `${r.kind === 'referral' ? 'Encaminhamento' : 'Tarefa'}: ${r.title}`, detail: `Responsável: ${ROLE_LABEL[r.assignee_role as StaffRole]}`, source: 'ONCOPHARMA Clinical' })),
        ...(await q(`SELECT collected_at AS at,analyte_label,result_value,unit,source_reference FROM clinical_labs WHERE organization_id=$1 AND patient_id=$2 ORDER BY collected_at DESC LIMIT 50`))
          .map((r) => ({ at: iso(r.at), kind: 'lab', title: `Exame: ${r.analyte_label}`, detail: `${r.result_value ?? '—'} ${r.unit}`, source: r.source_reference })),
        ...(await q(`SELECT administered_at AS at,medication,status,source_reference FROM clinical_medication_administrations WHERE organization_id=$1 AND patient_id=$2 ORDER BY administered_at DESC LIMIT 50`))
          .map((r) => ({ at: iso(r.at), kind: 'administration', title: `Administração: ${r.medication}`, detail: r.status === 'completed' ? 'Administrado' : r.status === 'not_done' ? 'Não administrado' : 'Em andamento', source: r.source_reference })),
        ...(await q(`SELECT observed_at AS at,title,value_text,source_type,source_reference FROM clinical_observations WHERE organization_id=$1 AND patient_id=$2 ORDER BY observed_at DESC LIMIT 50`))
          .map((r) => ({ at: iso(r.at), kind: 'observation', title: r.title, detail: r.value_text, source: `${r.source_type} / ${r.source_reference}` })),
        ...(await q(`SELECT created_at AS at,status,rationale FROM clinical_reviews WHERE organization_id=$1 AND patient_id=$2 AND review_type='pre_cycle' ORDER BY created_at DESC LIMIT 20`))
          .map((r) => ({ at: iso(r.at), kind: 'review', title: r.status === 'blocked' ? 'Parecer pré-ciclo: bloqueado' : 'Parecer pré-ciclo registrado', detail: r.rationale, source: 'ONCOPHARMA Clinical' })),
      ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 200);
      await this.audit(c, org, req, 'patient.timeline.read', s, 'patient', { patient_id: patientId });
      return { items };
    });
  }
}
