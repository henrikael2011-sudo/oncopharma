// M24 — autocadastro do paciente por convite de uso único.
// Equipe (MFA + vínculo profissional) emite convite → link + QR. Paciente/cuidador abre SEM login, preenche e envia →
// registro 'pending_review' (pendente de conferência). Só a equipe confere e confirma (criando o paciente sintético a
// partir do que foi enviado, sem redigitação) ou devolve. Dados pessoais cifrados em repouso; auditoria SEM dado pessoal;
// limite de tentativas no endpoint público; token guardado apenas como SHA-256.
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers, HttpException, HttpStatus, NotFoundException, Param, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import * as QRCode from 'qrcode';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { DatabaseService } from './database.service';
import { syntheticApiEnabled } from './synthetic-mode';
import { careKey, openText, sealText } from './care-crypto';
import { primaryRole, type StaffRole } from './clinical-work-rules';
import { age, canIssue, CONSENT_TERMS_VERSION, inviteHours, isUuid, parseRegistration, RateLimiter, RECORD, REG_STATUS_LABEL, signInvite, tokenHash, tokenSecret, verifyInvite, type RegistrationInput } from './registration-rules';

const INVALID = 'Convite inválido, expirado ou já utilizado. Peça um novo convite à equipe.';
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const secret = () => { try { return tokenSecret(); } catch { throw new ServiceUnavailableException('Cadastro indisponível: segredo de convite não configurado'); } };
const key = () => { try { return careKey(); } catch { throw new ServiceUnavailableException('Cadastro indisponível: chave de cifra não configurada'); } };
const gate = () => { if (!syntheticApiEnabled()) throw new ServiceUnavailableException('Cadastro disponível somente em ambiente sintético'); };
// Limites do endpoint público (por instância): leitura 30/min e envio 5/10 min por cliente; 10 envios/10 min por convite.
export const publicReadLimit = new RateLimiter(30, 60_000), publicSubmitLimit = new RateLimiter(5, 600_000), inviteSubmitLimit = new RateLimiter(10, 600_000);
const tooMany = () => new HttpException('Muitas tentativas. Aguarde alguns minutos e tente de novo.', HttpStatus.TOO_MANY_REQUESTS);
const client = (req: AuthenticatedRequest | any, h?: string) => (typeof h === 'string' && /^[a-f0-9]{16,64}$/.test(h) ? h : String(req?.socket?.remoteAddress ?? 'local'));

/** Público (sem login): validar e enviar o formulário do convite. */
@Controller('public/registration')
export class PublicRegistrationController {
  constructor(private readonly db: DatabaseService) {}
  private claims(token: string) { const c = verifyInvite(token, secret()); if (!c) throw new NotFoundException(INVALID); return c; }
  private async openInvite(c: PoolClient, org: string, token: string, lock = false) {
    const r = (await c.query(`SELECT id,expires_at,used_at,revoked_at FROM patient_registration_invites WHERE organization_id=$1 AND token_sha256=$2 ${lock ? 'FOR UPDATE' : ''}`, [org, tokenHash(token)])).rows[0];
    if (!r || r.used_at || r.revoked_at || new Date(r.expires_at).getTime() <= Date.now()) throw new NotFoundException(INVALID);
    return r as { id: string; expires_at: Date };
  }

  @Get(':token')
  async check(@Req() req: any, @Param('token') token: string, @Headers('x-client-hash') ch?: string) {
    gate(); if (!publicReadLimit.take(`r:${client(req, ch)}`)) throw tooMany();
    const cl = this.claims(token);
    return this.db.withTenant(cl.org, async (c) => {
      const inv = await this.openInvite(c, cl.org, token);
      if (inv.id !== cl.inviteId) throw new NotFoundException(INVALID);
      return { valid: true, expiresAt: iso(inv.expires_at), consentVersion: CONSENT_TERMS_VERSION, synthetic: true };
    });
  }

  @Post(':token')
  async submit(@Req() req: any, @Param('token') token: string, @Body() body: Record<string, unknown>, @Headers('x-client-hash') ch?: string) {
    gate(); if (!publicSubmitLimit.take(`s:${client(req, ch)}`) || !inviteSubmitLimit.take(`i:${String(token).slice(-43)}`)) throw tooMany();
    const cl = this.claims(token); const input = parseRegistration(body); const k = key();
    return this.db.withTenant(cl.org, async (c) => {
      const inv = await this.openInvite(c, cl.org, token, true);
      if (inv.id !== cl.inviteId) throw new NotFoundException(INVALID);
      const { fullName, consent: _c, ...rest } = input;
      const sealed = sealText(JSON.stringify(rest), k.key);
      const regId = randomUUID();
      await c.query(`INSERT INTO patient_registrations(id,organization_id,invite_id,display_name,payload_encrypted,payload_iv,payload_tag,key_id,submitted_by,consent_terms_version,consent_accepted_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`, [regId, cl.org, inv.id, fullName, sealed.ciphertext, sealed.iv, sealed.tag, k.id, input.submittedBy, CONSENT_TERMS_VERSION]);
      const used = await c.query(`UPDATE patient_registration_invites SET used_at=now() WHERE id=$1 AND organization_id=$2 AND used_at IS NULL AND revoked_at IS NULL RETURNING id`, [inv.id, cl.org]);
      if (!used.rowCount) throw new NotFoundException(INVALID);
      // Auditoria sem dado pessoal: só identificadores técnicos e quem enviou (paciente/cuidador).
      await c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,'public-invite',$2,'registration.submitted','patient_registration',$3::jsonb)`,
        [cl.org, `invite:${inv.id}`, JSON.stringify({ registration_id: regId, invite_id: inv.id, submitted_by: input.submittedBy, channel: 'care-public' })]);
      return { registrationId: regId, status: 'pending_review', message: 'Cadastro recebido. A equipe vai conferir seus dados e entrar em contato. Você não precisa enviar de novo.' };
    });
  }
}

type Staff = { role: StaffRole };
/** Equipe: emitir convite (link + QR), listar cadastros e conferir. */
@Controller('clinical')
@UseGuards(AuthGuard)
export class RegistrationController {
  constructor(private readonly db: DatabaseService) {}
  private run<T>(req: AuthenticatedRequest, org: string | undefined, work: (c: PoolClient, s: Staff) => Promise<T>): Promise<T> {
    gate();
    if (!org || !isUuid(org)) throw new BadRequestException('Organização inválida');
    if (!req.principal.mfa) throw new ForbiddenException('MFA obrigatório para acesso profissional');
    return this.db.withTenant(org, async (c) => {
      const roles = (await c.query<{ role: string }>(`SELECT role FROM memberships WHERE organization_id=$1 AND oidc_issuer=$2 AND oidc_sub=$3 AND active=true`, [org, req.principal.issuer, req.principal.sub])).rows.map((r) => r.role);
      const role = primaryRole(roles); if (!role) throw new ForbiddenException('Sem vínculo profissional ativo nesta instituição');
      if (!canIssue(role)) throw new ForbiddenException('Somente farmácia, enfermagem ou medicina emitem convites e conferem cadastros');
      return work(c, { role });
    });
  }
  private audit(c: PoolClient, org: string, req: AuthenticatedRequest, action: string, s: Staff, meta: Record<string, string | number | null>) {
    return c.query(`INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES($1,$2,$3,$4,'patient_registration',$5::jsonb)`,
      [org, req.principal.issuer, req.principal.sub, action, JSON.stringify({ ...meta, actor_role: s.role, channel: 'clinical' })]);
  }

  @Post('registration-invites')
  async invite(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Body() body: Record<string, unknown>) {
    const hours = inviteHours(body?.hours); const sec = secret();
    const base = process.env.CARE_PUBLIC_ORIGIN; if (!base || !/^https?:\/\/[^\s/]+$/.test(base.replace(/\/$/, ''))) throw new ServiceUnavailableException('Endereço público do Care não configurado');
    const out = await this.run(req, org, async (c, s) => {
      // M25: validade calculada no banco (now() da transação + horas), igual ao created_at do CHECK invite_max_7d — sem corrida entre relógio do Node e do Postgres.
      const inviteId = randomUUID();
      const exp = new Date((await c.query(`SELECT now() + make_interval(hours => $1::int) AS exp`, [hours])).rows[0].exp).getTime();
      const token = signInvite({ inviteId, org, exp }, sec);
      await c.query(`INSERT INTO patient_registration_invites(id,organization_id,token_sha256,created_by_issuer,created_by_sub,created_by_role,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,now(),now() + make_interval(hours => $7::int))`,
        [inviteId, org, tokenHash(token), req.principal.issuer, req.principal.sub, s.role, hours]);
      await this.audit(c, org, req, 'registration.invite.created', s, { invite_id: inviteId, hours });
      return { inviteId, expiresAt: new Date(exp).toISOString(), link: `${base.replace(/\/$/, '')}/cadastro/${token}` };
    });
    const qrSvg = await QRCode.toString(out.link, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#0a344a', light: '#ffffff' } });
    return { ...out, qrSvg, singleUse: true };
  }

  @Get('registrations')
  list(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string) {
    const k = key();
    return this.run(req, org, async (c, s) => {
      const rows = (await c.query(`SELECT r.id,r.display_name,r.payload_encrypted,r.payload_iv,r.payload_tag,r.submitted_by,r.status,r.created_at,r.reviewed_at,r.review_note,r.patient_id,i.expires_at
        FROM patient_registrations r JOIN patient_registration_invites i ON i.id=r.invite_id AND i.organization_id=r.organization_id
        WHERE r.organization_id=$1 ORDER BY (r.status='pending_review') DESC, r.created_at DESC LIMIT 100`, [org])).rows;
      const invites = (await c.query(`SELECT count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at>now())::int AS open FROM patient_registration_invites WHERE organization_id=$1`, [org])).rows[0];
      await this.audit(c, org, req, 'registration.list.read', s, { result_count: rows.length });
      return { role: s.role, openInvites: invites.open, items: rows.map((r) => {
        const p = JSON.parse(openText({ ciphertext: r.payload_encrypted, iv: r.payload_iv, tag: r.payload_tag }, k.key)) as Omit<RegistrationInput, 'fullName' | 'consent'>;
        return { id: r.id, name: r.display_name, ...p, age: age(p.birthDate), submittedByLabel: p.submittedBy === 'caregiver' ? 'Cuidador' : 'Paciente', status: r.status, statusLabel: REG_STATUS_LABEL[r.status as keyof typeof REG_STATUS_LABEL],
          createdAt: iso(r.created_at), reviewedAt: iso(r.reviewed_at), reviewNote: r.review_note, patientId: r.patient_id };
      }) };
    });
  }

  @Post('registrations/:id/confirm')
  confirm(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('id') regId: string, @Body() body: Record<string, unknown>) {
    if (!isUuid(regId)) throw new BadRequestException('Cadastro inválido');
    if (body?.confirm !== true) throw new BadRequestException('Confirme que conferiu os dados com o paciente/documento');
    const record = typeof body?.record === 'string' ? body.record.trim().toUpperCase() : '';
    if (!RECORD.test(record)) throw new BadRequestException('Prontuário: 3 a 30 letras, números ou hífen');
    return this.run(req, org, async (c, s) => {
      const r = (await c.query(`SELECT id,display_name,status FROM patient_registrations WHERE id=$1 AND organization_id=$2 FOR UPDATE`, [regId, org])).rows[0];
      if (!r) throw new NotFoundException('Cadastro não localizado');
      if (r.status !== 'pending_review') throw new ConflictException('Este cadastro já foi conferido');
      const dup = await c.query(`SELECT 1 FROM patients WHERE organization_id=$1 AND hospital_record=$2`, [org, record]);
      if (dup.rowCount) throw new ConflictException('Já existe paciente com este prontuário: confira antes de confirmar');
      const patientId = (await c.query(`INSERT INTO patients(organization_id,external_reference,synthetic,display_name,hospital_record) VALUES($1,$2,true,$3,$4) RETURNING id`, [org, `CAD-${regId}`, r.display_name, record])).rows[0].id;
      await c.query(`UPDATE patient_registrations SET status='confirmed',patient_id=$1,reviewed_by_issuer=$2,reviewed_by_sub=$3,reviewed_by_role=$4,reviewed_at=now() WHERE id=$5 AND organization_id=$6`, [patientId, req.principal.issuer, req.principal.sub, s.role, regId, org]);
      await this.audit(c, org, req, 'registration.confirmed', s, { registration_id: regId, patient_id: patientId });
      return { id: regId, status: 'confirmed', patientId };
    });
  }

  @Post('registrations/:id/reject')
  reject(@Req() req: AuthenticatedRequest, @Headers('x-organization-id') org: string, @Param('id') regId: string, @Body() body: Record<string, unknown>) {
    if (!isUuid(regId)) throw new BadRequestException('Cadastro inválido');
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length < 3 || note.length > 500) throw new BadRequestException('Informe o motivo da devolução (3 a 500 caracteres)');
    return this.run(req, org, async (c, s) => {
      const r = (await c.query(`SELECT status FROM patient_registrations WHERE id=$1 AND organization_id=$2 FOR UPDATE`, [regId, org])).rows[0];
      if (!r) throw new NotFoundException('Cadastro não localizado');
      if (r.status !== 'pending_review') throw new ConflictException('Este cadastro já foi conferido');
      await c.query(`UPDATE patient_registrations SET status='rejected',reviewed_by_issuer=$1,reviewed_by_sub=$2,reviewed_by_role=$3,reviewed_at=now(),review_note=$4 WHERE id=$5 AND organization_id=$6`, [req.principal.issuer, req.principal.sub, s.role, note, regId, org]);
      await this.audit(c, org, req, 'registration.rejected', s, { registration_id: regId });
      return { id: regId, status: 'rejected' };
    });
  }
}
