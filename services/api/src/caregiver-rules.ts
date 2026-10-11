// M15.3 — regras do cuidador (P-R4, proposta em vigor): escopos fechados, todos desligados por padrão; prazo 30/60/90 dias;
// convite com código aleatório de uso único (60 bits, alfabeto sem caracteres ambíguos), válido por 72 h; só o hash SHA-256 é guardado.
import { createHash, randomInt } from 'node:crypto';
export const CAREGIVER_SCOPES = ['ver_jornada', 'ver_medicamentos', 'registrar_sintoma'] as const;
export type CaregiverScope = typeof CAREGIVER_SCOPES[number];
export const TERM_OPTIONS = [30, 60, 90];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 símbolos => 5 bits cada; 12 símbolos = 60 bits
export function newInviteCode(): string {
  const raw = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
export function normalizeInviteCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.toUpperCase().replace(/[\s-]/g, '');
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(s) ? s : null;
}
export const hashInviteCode = (code: string) => createHash('sha256').update(`oncopharma-caregiver-invite:${normalizeInviteCode(code)}`).digest('hex');
