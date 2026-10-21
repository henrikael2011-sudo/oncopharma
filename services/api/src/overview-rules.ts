// M20 — Visão geral do farmacêutico: regras puras (limiar de febre, prioridade, prazos de estabilidade). Sem I/O.
// A tela apenas organiza dados já registrados; a conduta clínica é da equipe (IA e sistema não decidem).
export const FEVER_THRESHOLD_C = 38.0;
export const EXPIRING_SOON_HOURS = 6;
export const STABILITY_NOTICE = 'Prazos ilustrativos — conferir na bula do fabricante';
export type FeverPriority = 'alta' | 'media';
/** Febre = temperatura >= 38,0 °C (mais recente do paciente). Prioridade só ordena a lista; não é conduta. */
export const isFever = (celsius: number) => Number.isFinite(celsius) && celsius >= FEVER_THRESHOLD_C;
export const feverPriority = (celsius: number): FeverPriority => (celsius >= 38.5 ? 'alta' : 'media');
export type Stability = { remainingMinutes: number; usedPercent: number; expired: boolean; level: 'critico' | 'atencao' | 'ok' };
export function stability(preparedAt: Date, hours: number, now: Date = new Date()): Stability {
  const total = hours * 60, used = (now.getTime() - preparedAt.getTime()) / 60000;
  const remaining = Math.max(0, Math.round(total - used));
  const usedPercent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));
  const level = remaining <= 2 * 60 ? 'critico' : remaining <= EXPIRING_SOON_HOURS * 60 ? 'atencao' : 'ok';
  return { remainingMinutes: remaining, usedPercent, expired: remaining === 0, level };
}
/** "1 h 40 min", "9 h", "3 dias" — texto para o farmacêutico. */
export function remainingLabel(min: number): string {
  if (min <= 0) return 'Vencido';
  if (min >= 48 * 60) return `${Math.floor(min / 1440)} dias`;
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}
