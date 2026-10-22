// M22 — transcrição da prescrição médica (Clinical) + liberação farmacêutica. Só depois de liberada a entrada
// vira o pedido ativo que o Care mostra (nome, horários, orientações; dose NUNCA ao paciente). Sem IA/decisão automática.
// Regras: MFA + vínculo profissional + vínculo assistencial por paciente (mesmo padrão do ClinicalWorkController);
// RLS por organização; dose e orientações cifradas (CARE_ENCRYPTION_KEY); toda leitura/escrita auditada.
import { BadGatewayException, BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers, Param, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { syntheticApiEnabled } from './synthetic-mode';
import { careKey, openText, sealText } from './care-crypto';
import { primaryRole, ROLE_LABEL, type StaffRole } from './clinical-work-rules';
import { canEnter, canRelease, ENTRY_SOURCES, isUuid, KIND_LABEL, parseDiscontinue, parseSource, parseTranscription, ROUTES, STATUS_LABEL, validateHospitalMeds, type EntrySource, type TranscriptionInput } from './med-transcription-rules';

type Staff = { role: StaffRole };
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
const id = (v: string, what: string) => { if (!isUuid(v)) throw new BadRequestException(`${what} inválido`); return v; };
const COLS = `id,lineage_id,version,kind,medication,dose_encrypted,dose_iv,dose_tag,route,times,frequency_text,start_date,end_date,instructions_encrypted,instructions_iv,instructions_tag,key_id,prescription_reference,status,entered_by_role,entered_by_sub,entered_at,reviewed_by_sub,reviewed_at,review_note,order_id,entry_source,source_detail`;

@Controller('clinical')
@UseGuards(AuthGuard)
export class MedTranscriptionController {
  constructor(private readonly db: DatabaseService) {}
  private key() { try { return careKey(); } catch { throw new ServiceUnavailableException('Transcrição indisponível: chave de cifra não configurada'); } }
  private run<T>(req: AuthenticatedRequest, org: string | undefined, work: (c: PoolClient, s: Staff) => Promise<T>): Promise<T> {
    if (!syntheticApiEnabled()) throw new ServiceUnavailableException('Clinical disponível somente em ambiente sintético');
    if (!org || !isUuid(org)) throw new BadRequestException('Organização inválida');
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório para acesso profissional');
    return this.db.withTenant(org, async (c) => {
      const roles = (await c.query<{ role: string }>(`SELECT role FROM memberships WHERE organization_id=$1 AND oidc_issuer=$2 AND oidc_sub=$3 AND active=true`, [org, req.principal.issuer, req.principal.sub])).rows.map((r) => r.role);
      const role = primaryRole(roles); if (!role) throw new ForbiddenException('Sem vínculo profissional ativo nesta instituição');
      return work(c, { role });
    });
  }
  private async linked(c: PoolClient, org: string, req: AuthenticatedRequest, patientId: string) {
    const r = await c.query(`SELECT 1 FROM patients p JOIN care_assignments a ON a.patient_id=p.id AND a.organization_id=p.organization_id WHERE p.id=$1 AND p.organization_id=$2 AND p.synthetic=true AND a.oidc_issuer=$3 AND a.oidc_sub=$4 AND a.active=true`, [patientId, org, req.principal.issuer, req.principal.sub]);
    if (!r.rowCount) throw new ForbiddenException('Paciente não atribuído');
  }
  private audit(c: PoolClient, org: string, req: AuthenticatedRequest, action: string, s: Staff, meta: Record<string, string | number | null>) {
    return c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,$4,'medication_transcription',$5::jsonb)`,
      [org, req.principal.issuer, req.principal.sub, action, JSON.stringify({ ...meta, actor_role: s.role, channel: 'clinical' })]);
  }
  private async insertVersion(c: PoolClient, org: string, req: AuthenticatedRequest, s: Staff, patientId: string, lineage: string, version: number, kind: 'new' | 'update' | 'discontinue', t: TranscriptionInput, orderId: string | null, src: { entrySource: EntrySource; sourceDetail: string | null } = { entrySource: 'manual', sourceDetail: null }) {
    const k = this.key(), dose = sealText(t.dose, k.key), ins = sealText(t.instructions, k.key);
    const r = await c.query(`INSERT INTO clinical_med_transcriptions(organization_id,patient_id,lineage_id,version,kind,medication,dose_encrypted,dose_iv,dose_tag,route,times,frequency_text,start_date,end_date,instructions_encrypted,instructions_iv,instructions_tag,key_id,prescription_reference,status,entered_by_issuer,entered_by_sub,entered_by_role,order_id,entry_source,source_detail)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending_release',$20,$21,$22,$23,$24,$25) RETURNING id`,
      [org, patientId, lineage, version, kind, t.medication, dose.ciphertext, dose.iv, dose.tag, t.route, t.times, t.frequency, t.startDate, t.endDate, ins.ciphertext, ins.iv, ins.tag, k.id, t.prescriptionRef, req.principal.issuer, req.principal.sub, s.role, orderId, src.entrySource, src.sourceDetail]);
    return r.rows[0].id as string;
  }
  private view(row: Record<string, any>, key: Buffer) {
    const open = (p: string) => openText({ ciphertext: row[`${p}_encrypted`], iv: row[`${p}_iv`], tag: row[`${p}_tag`] }, key);
    return { id: row.id, lineageId: row.lineage_id, version: row.version, kind: row.kind, kindLabel: KIND_LABEL[row.kind as keyof typeof KIND_LABEL], medication: row.medication, dose: open('dose'), route: row.route, routeLabel: ROUTES[row.route as keyof typeof ROUTES],
      times: row.times as string[], frequency: row.frequency_text, startDate: day(row.start_date), endDate: day(row.end_date), instructions: open('instructions'), prescriptionRef: row.prescription_reference,
      status: row.status, statusLabel: STATUS_LABEL[row.status as keyof typeof STATUS_LABEL], enteredBy: ROLE_LABEL[row.entered_by_role as StaffRole] ?? row.entered_by_role, enteredAt: iso(row.entered_at), reviewedAt: iso(row.reviewed_at), reviewNote: row.review_note,
      entrySource: row.entry_source ?? 'manual', entrySourceLabel: ENTRY_SOURCES[(row.entry_source ?? 'manual') as EntrySource], sourceDetail: row.source_detail ?? null };
  }

  /** Lista as linhagens do paciente com o histórico de versões (trilha de auditoria visível à equipe). */
  @Get('patients/:patientId/med-transcriptions')
  list(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    id(patientId, 'Paciente'); const k = this.key();
    return this.run(req, org, async (c, s) => {
      await this.linked(c, org, req, patientId);
      const rows = (await c.query(`SELECT ${COLS} FROM clinical_med_transcriptions WHERE organization_id=$1 AND patient_id=$2 ORDER BY entered_at DESC, version DESC LIMIT 300`, [org, patientId])).rows;
      await this.audit(c, org, req, 'clinical.med_transcription.read', s, { patient_id: patientId });
      const items = rows.map((r) => ({ ...this.view(r, k.key), mine: r.entered_by_sub === req.principal.sub, reviewedByMe: r.reviewed_by_sub === req.principal.sub }));
      return { role: s.role, canEnter: canEnter(s.role), canRelease: canRelease(s.role), routes: ROUTES, items };
    });
  }

  /** Importar ORAIS do sistema do hospital (gateway simulado, FHIR R4). Só devolve RASCUNHOS: nada é gravado; a equipe revisa e registra. */
  @Get('patients/:patientId/med-transcriptions/hospital-oral')
  async hospitalOral(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string) {
    id(patientId, 'Paciente');
    const record = await this.run(req, org, async (c, s) => {
      if (!canEnter(s.role)) throw new ForbiddenException('Somente farmácia, enfermagem ou medicina transcrevem a prescrição');
      await this.linked(c, org, req, patientId);
      return (await c.query<{ hospital_record: string | null }>(`SELECT hospital_record FROM patients WHERE id=$1 AND organization_id=$2`, [patientId, org])).rows[0]?.hospital_record ?? null;
    });
    if (!record) throw new ConflictException('Paciente sem prontuário hospitalar vinculado');
    const base = process.env.INTEGRATION_GATEWAY_URL, token = process.env.INTEGRATION_GATEWAY_TOKEN;
    if (!base || !token) throw new ServiceUnavailableException('Integração hospitalar não configurada');
    let feed: ReturnType<typeof validateHospitalMeds>;
    try {
      const r = await fetch(`${base.replace(/\/$/, '')}/v1/medications?record=${encodeURIComponent(record)}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`gateway ${r.status}`);
      feed = validateHospitalMeds(await r.json());
    } catch { throw new BadGatewayException('Não foi possível consultar o sistema do hospital agora. Tente novamente.'); }
    return this.run(req, org, async (c, s) => {
      await this.audit(c, org, req, 'clinical.med_transcription.hospital_fetched', s, { patient_id: patientId, received: feed.items.length, skipped_non_oral: feed.skippedNonOral, adapter: feed.adapterVersion });
      return { source: feed.source, decision: 'PENDING_REVIEW', items: feed.items, skippedNonOral: feed.skippedNonOral };
    });
  }

  @Post('patients/:patientId/med-transcriptions')
  create(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string, @Body() body: Record<string, unknown>) {
    id(patientId, 'Paciente'); const t = parseTranscription(body); const src = parseSource(body); const lineageIn = body?.lineageId;
    if (lineageIn !== undefined && !isUuid(lineageIn)) throw new BadRequestException('Linhagem inválida');
    return this.run(req, org, async (c, s) => {
      if (!canEnter(s.role)) throw new ForbiddenException('Somente farmácia, enfermagem ou medicina transcrevem a prescrição');
      await this.linked(c, org, req, patientId);
      let lineage: string = randomUUID(), version = 1, kind: 'new' | 'update' = 'new', orderId: string | null = null;
      if (typeof lineageIn === 'string') {
        const cur = (await c.query(`SELECT version,status,order_id FROM clinical_med_transcriptions WHERE organization_id=$1 AND patient_id=$2 AND lineage_id=$3 ORDER BY version DESC LIMIT 1 FOR UPDATE`, [org, patientId, lineageIn])).rows[0];
        if (!cur) throw new ForbiddenException('Medicamento não localizado');
        if (cur.status === 'pending_release') throw new ConflictException('Já existe uma versão aguardando liberação da farmácia');
        if (cur.status === 'discontinued') throw new ConflictException('Medicamento suspenso: faça uma nova inclusão');
        const released = (await c.query(`SELECT order_id FROM clinical_med_transcriptions WHERE organization_id=$1 AND lineage_id=$2 AND status='released' LIMIT 1`, [org, lineageIn])).rows[0];
        lineage = lineageIn; version = cur.version + 1; kind = released ? 'update' : 'new'; orderId = released?.order_id ?? null;
      }
      const newId = await this.insertVersion(c, org, req, s, patientId, lineage, version, kind, t, orderId, src);
      await this.audit(c, org, req, `clinical.med_transcription.${kind === 'new' ? 'entered' : 'updated'}`, s, { patient_id: patientId, transcription_id: newId, lineage_id: lineage, version, entry_source: src.entrySource });
      return { id: newId, lineageId: lineage, version, status: 'pending_release' };
    });
  }

  @Post('patients/:patientId/med-transcriptions/:lineageId/discontinue')
  discontinue(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('patientId') patientId: string, @Param('lineageId') lineageId: string, @Body() body: Record<string, unknown>) {
    id(patientId, 'Paciente'); id(lineageId, 'Linhagem'); const d = parseDiscontinue(body); const k = this.key();
    return this.run(req, org, async (c, s) => {
      if (!canEnter(s.role)) throw new ForbiddenException('Somente farmácia, enfermagem ou medicina transcrevem a prescrição');
      await this.linked(c, org, req, patientId);
      const cur = (await c.query(`SELECT ${COLS} FROM clinical_med_transcriptions WHERE organization_id=$1 AND patient_id=$2 AND lineage_id=$3 AND status='released' LIMIT 1 FOR UPDATE`, [org, patientId, lineageId])).rows[0];
      if (!cur) throw new ConflictException('Só é possível suspender um medicamento já liberado');
      const pend = await c.query(`SELECT 1 FROM clinical_med_transcriptions WHERE organization_id=$1 AND lineage_id=$2 AND status='pending_release'`, [org, lineageId]);
      if (pend.rowCount) throw new ConflictException('Já existe uma versão aguardando liberação da farmácia');
      const v = this.view(cur, k.key); const max = (await c.query(`SELECT max(version)::int AS v FROM clinical_med_transcriptions WHERE organization_id=$1 AND lineage_id=$2`, [org, lineageId])).rows[0].v;
      const newId = await this.insertVersion(c, org, req, s, patientId, lineageId, max + 1, 'discontinue', { medication: v.medication, dose: v.dose, route: v.route, times: v.times, frequency: v.frequency, startDate: v.startDate!, endDate: v.endDate, instructions: v.instructions, prescriptionRef: `${d.prescriptionRef} — ${d.reason}`.slice(0, 160) }, cur.order_id);
      await this.audit(c, org, req, 'clinical.med_transcription.discontinue_entered', s, { patient_id: patientId, transcription_id: newId, lineage_id: lineageId });
      return { id: newId, status: 'pending_release' };
    });
  }

  /** Conferência e liberação: SOMENTE farmácia. Só então o Care passa a mostrar (ou deixa de mostrar) o medicamento. */
  @Post('med-transcriptions/:id/release')
  release(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('id') trId: string, @Body() body: Record<string, unknown>) {
    id(trId, 'Transcrição'); const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    if (body?.confirm !== true) throw new BadRequestException('Confirme que conferiu a transcrição com a prescrição médica');
    return this.run(req, org, async (c, s) => {
      if (!canRelease(s.role)) throw new ForbiddenException('Somente a farmácia confere e libera a transcrição');
      const t = (await c.query(`SELECT id,patient_id,lineage_id,kind,medication,route,times,frequency_text,order_id,status FROM clinical_med_transcriptions WHERE id=$1 AND organization_id=$2 FOR UPDATE`, [trId, org])).rows[0];
      if (!t) throw new ForbiddenException('Transcrição não localizada');
      await this.linked(c, org, req, t.patient_id);
      if (t.status !== 'pending_release') throw new ConflictException('Esta transcrição não está aguardando liberação');
      const schedule = `${(t.times as string[]).join(', ')} · ${t.frequency_text}`;
      let orderId: string | null = t.order_id;
      if (t.kind === 'new') {
        orderId = randomUUID();
        await c.query(`INSERT INTO clinical_medication_orders(id,organization_id,patient_id,medication,route,frequency_text,status,ordered_at,source_reference) VALUES($1,$2,$3,$4,$5,$6,'active',now(),$7)`, [orderId, org, t.patient_id, t.medication, t.route, schedule, `transcr:${t.lineage_id}`]);
      } else if (t.kind === 'update') {
        await c.query(`UPDATE clinical_medication_orders SET medication=$1,route=$2,frequency_text=$3,status='active' WHERE id=$4 AND organization_id=$5`, [t.medication, t.route, schedule, orderId, org]);
      } else {
        await c.query(`UPDATE clinical_medication_orders SET status='stopped' WHERE id=$1 AND organization_id=$2`, [orderId, org]);
      }
      await c.query(`UPDATE clinical_med_transcriptions SET status=$1 WHERE organization_id=$2 AND lineage_id=$3 AND status='released'`, [t.kind === 'discontinue' ? 'discontinued' : 'superseded', org, t.lineage_id]);
      await c.query(`UPDATE clinical_med_transcriptions SET status=$1,reviewed_by_issuer=$2,reviewed_by_sub=$3,reviewed_at=now(),review_note=$4,order_id=$5 WHERE id=$6 AND organization_id=$7`,
        [t.kind === 'discontinue' ? 'discontinued' : 'released', req.principal.issuer, req.principal.sub, note, orderId, trId, org]);
      await this.audit(c, org, req, 'clinical.med_transcription.released', s, { patient_id: t.patient_id, transcription_id: trId, lineage_id: t.lineage_id, kind: t.kind, order_id: orderId });
      return { id: trId, status: t.kind === 'discontinue' ? 'discontinued' : 'released', orderId };
    });
  }

  @Post('med-transcriptions/:id/reject')
  reject(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('id') trId: string, @Body() body: Record<string, unknown>) {
    id(trId, 'Transcrição'); const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length < 3 || note.length > 500) throw new BadRequestException('Informe o motivo da devolução (3 a 500 caracteres)');
    return this.run(req, org, async (c, s) => {
      if (!canRelease(s.role)) throw new ForbiddenException('Somente a farmácia confere e devolve a transcrição');
      const t = (await c.query(`SELECT id,patient_id,lineage_id,status FROM clinical_med_transcriptions WHERE id=$1 AND organization_id=$2 FOR UPDATE`, [trId, org])).rows[0];
      if (!t) throw new ForbiddenException('Transcrição não localizada');
      await this.linked(c, org, req, t.patient_id);
      if (t.status !== 'pending_release') throw new ConflictException('Esta transcrição não está aguardando liberação');
      await c.query(`UPDATE clinical_med_transcriptions SET status='rejected',reviewed_by_issuer=$1,reviewed_by_sub=$2,reviewed_at=now(),review_note=$3 WHERE id=$4 AND organization_id=$5`, [req.principal.issuer, req.principal.sub, note, trId, org]);
      await this.audit(c, org, req, 'clinical.med_transcription.rejected', s, { patient_id: t.patient_id, transcription_id: trId, lineage_id: t.lineage_id });
      return { id: trId, status: 'rejected' };
    });
  }
}
