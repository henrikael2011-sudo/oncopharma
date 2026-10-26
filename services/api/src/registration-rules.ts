// M24 — regras puras do autocadastro por convite (sem I/O). O formulário só COLETA o que o paciente/cuidador informa;
// nada aqui avalia diagnóstico ou tratamento. O registro nasce pendente e a equipe confere.
import { BadRequestException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ISSUER_ROLES = ['pharmacist', 'nurse', 'physician'] as const; // quem emite convite e confere cadastro
export const canIssue = (role: string) => (ISSUER_ROLES as readonly string[]).includes(role);
export const CONSENT_TERMS_VERSION = 'cadastro-ficticio-v1';
export const INVITE_DEFAULT_HOURS = 72, INVITE_MAX_HOURS = 168;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown) => typeof v === 'string' && UUID.test(v);
const b64u = (b: Buffer) => b.toString('base64url');

export function tokenSecret(): Buffer {
  const s = process.env.REGISTRATION_TOKEN_SECRET || '';
  if (s.length < 32) throw new Error('REGISTRATION_TOKEN_SECRET ausente ou curto (mín. 32)');
  return Buffer.from(s, 'utf8');
}
/** Token assinado (HMAC-SHA256): r1.<payload>.<assinatura>. Payload: convite, organização, expiração e nonce. */
export function signInvite(p: { inviteId: string; org: string; exp: number }, secret: Buffer, nonce = randomBytes(16)): string {
  const body = b64u(Buffer.from(JSON.stringify({ i: p.inviteId, o: p.org, e: p.exp, n: b64u(nonce) })));
  return `r1.${body}.${b64u(createHmac('sha256', secret).update(`r1.${body}`).digest())}`;
}
export type InviteClaims = { inviteId: string; org: string; exp: number };
/** Verifica formato, assinatura (tempo constante) e expiração. Não consulta o banco: uso único é garantido lá. */
export function verifyInvite(token: unknown, secret: Buffer, now = Date.now()): InviteClaims | null {
  if (typeof token !== 'string' || token.length > 400 || !/^r1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [, body, sig] = token.split('.');
  const expected = createHmac('sha256', secret).update(`r1.${body}`).digest(), got = Buffer.from(sig, 'base64url');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  let j: any; try { j = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!isUuid(j?.i) || !isUuid(j?.o) || !Number.isInteger(j?.e) || j.e <= now) return null;
  return { inviteId: j.i, org: j.o, exp: j.e };
}
export const tokenHash = (token: string) => createHash('sha256').update(token, 'utf8').digest();
export function inviteHours(v: unknown): number {
  if (v === undefined || v === null || v === '') return INVITE_DEFAULT_HOURS;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > INVITE_MAX_HOURS) throw new BadRequestException(`Validade do convite: de 1 a ${INVITE_MAX_HOURS} horas`);
  return n;
}

export type RegistrationInput = {
  fullName: string; birthDate: string; phone: string; email: string | null; submittedBy: 'patient' | 'caregiver';
  caregiver: { name: string; relationship: string; phone: string } | null;
  diagnosis: string; regimen: string | null; treatmentStart: string | null; hospitalName: string | null; consent: true;
};
const CTRL = /[\u0000-\u001f\u007f<>]/;
const str = (v: unknown, min: number, max: number, f: string) => {
  if (typeof v !== 'string') throw new BadRequestException(`${f}: obrigatório`);
  const t = v.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length < min || t.length > max) throw new BadRequestException(`${f}: informe entre ${min} e ${max} caracteres`);
  if (CTRL.test(t)) throw new BadRequestException(`${f}: caracteres não permitidos`);
  return t;
};
const opt = (v: unknown, max: number, f: string) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : str(v, 2, max, f));
const NAME = /^[\p{L}][\p{L}' .-]*$/u;
export function normalizePhone(v: unknown, f: string): string {
  if (typeof v !== 'string') throw new BadRequestException(`${f}: obrigatório`);
  const d = v.replace(/[\s().-]/g, '').replace(/^\+?55/, '');
  if (!/^[1-9]{2}9?\d{8}$/.test(d)) throw new BadRequestException(`${f}: informe DDD + número (ex.: (11) 91234-5678)`);
  return `+55${d}`;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export function parseRegistration(b: Record<string, unknown>, now = new Date()): RegistrationInput {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new BadRequestException('Cadastro inválido');
  const fullName = str(b.fullName, 3, 80, 'Nome completo'); if (!NAME.test(fullName) || !fullName.includes(' ')) throw new BadRequestException('Nome completo: informe nome e sobrenome, somente letras');
  const birthDate = String(b.birthDate ?? ''); const today = now.toISOString().slice(0, 10);
  if (!validDate(birthDate) || birthDate > today || birthDate < '1900-01-01') throw new BadRequestException('Data de nascimento inválida');
  const phone = normalizePhone(b.phone, 'Telefone do paciente');
  const email = b.email === undefined || b.email === null || b.email === '' ? null : String(b.email).trim().toLowerCase();
  if (email !== null && (email.length > 120 || !/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/.test(email))) throw new BadRequestException('E-mail inválido');
  const submittedBy = b.submittedBy === 'caregiver' ? 'caregiver' : b.submittedBy === 'patient' ? 'patient' : null;
  if (!submittedBy) throw new BadRequestException('Informe quem está preenchendo (paciente ou cuidador)');
  let caregiver: RegistrationInput['caregiver'] = null;
  const c = b.caregiver as Record<string, unknown> | null | undefined;
  const hasCaregiver = !!c && typeof c === 'object' && Object.values(c).some((x) => typeof x === 'string' && x.trim());
  if (submittedBy === 'caregiver' && !hasCaregiver) throw new BadRequestException('Cuidador: informe nome, parentesco e telefone de quem está preenchendo');
  if (hasCaregiver) {
    const name = str(c!.name, 3, 80, 'Nome do cuidador'); if (!NAME.test(name)) throw new BadRequestException('Nome do cuidador: somente letras');
    caregiver = { name, relationship: str(c!.relationship, 2, 40, 'Parentesco do cuidador'), phone: normalizePhone(c!.phone, 'Telefone do cuidador') };
  }
  const diagnosis = str(b.diagnosis, 2, 120, 'Diagnóstico (como informado pela equipe médica)');
  const regimen = opt(b.regimen, 120, 'Tratamento / protocolo');
  const treatmentStart = b.treatmentStart ? String(b.treatmentStart) : null;
  if (treatmentStart && (!validDate(treatmentStart) || treatmentStart < birthDate)) throw new BadRequestException('Início do tratamento inválido');
  const hospitalName = opt(b.hospitalName, 80, 'Hospital / clínica');
  if (b.consent !== true) throw new BadRequestException('É preciso marcar o consentimento para enviar o cadastro');
  return { fullName, birthDate, phone, email, submittedBy, caregiver, diagnosis, regimen, treatmentStart, hospitalName, consent: true };
}

/** Limite por janela fixa em memória (por instância). Chave = hash; nunca IP/token em claro nos logs. */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  take(key: string, now = Date.now()): boolean {
    const k = createHash('sha256').update(key).digest('hex').slice(0, 32);
    if (this.hits.size > 10_000) for (const [x, v] of this.hits) if (v.reset <= now) this.hits.delete(x);
    const cur = this.hits.get(k);
    if (!cur || cur.reset <= now) { this.hits.set(k, { n: 1, reset: now + this.windowMs }); return true; }
    cur.n += 1; return cur.n <= this.max;
  }
}
export const REG_STATUS_LABEL = { pending_review: 'Pendente de conferência', confirmed: 'Conferido pela equipe', rejected: 'Devolvido pela equipe' } as const;
export const RECORD = /^[A-Za-z0-9-]{3,30}$/;
export function age(birthDate: string, now = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number); let a = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) a -= 1; return a;
}
