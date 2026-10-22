// M24 — painel do farmacêutico hospitalar: regras puras de fila e de rótulos (sem I/O).
// A fila só ORDENA para leitura (gravidade, depois tempo de espera). O app não decide conduta: a equipe avalia.
import { FEVER_THRESHOLD_C, isFever } from './care-rules';
export { FEVER_THRESHOLD_C, isFever };
export const SEVERITY_RANK: Record<string, number> = { urgent_review: 0, needs_review: 1 };
export const SEVERITY_LABEL: Record<string, string> = { urgent_review: 'Urgente', needs_review: 'Revisão' };
export type QueueItem = { level: string; createdAt: string; [k: string]: unknown };
/** Gravidade (urgente primeiro) e, dentro dela, quem espera há mais tempo primeiro. Estável. */
export function sortQueue<T extends QueueItem>(items: T[]): T[] {
  return items.map((x, i) => [x, i] as const).sort(([a, i], [b, j]) => (SEVERITY_RANK[a.level] ?? 9) - (SEVERITY_RANK[b.level] ?? 9) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || i - j).map(([x]) => x);
}
export function waitingMinutes(createdAt: string, now = Date.now()) { return Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000)); }
export const TEAM_ASSESSES = 'O ONCOPHARMA não decide conduta: a equipe assistencial avalia cada alerta.';
export const SIMULATED_INTEGRATION = 'Integração hospitalar SIMULADA (FHIR R4 fictício) — não é Tasy/MV nem sistema real.';
export const POLL_SECONDS = 15;
/** Mesmo rótulo da lista do Clinical: "Quarto" só quando o quarto é numérico (ex.: "Box 04" fica como está). */
export function locationLabel(a: { unit?: string | null; room?: string | null; bed?: string | null }) {
  if (!a.unit) return null;
  return [a.unit, a.room ? (/^\d/.test(a.room) ? `Quarto ${a.room}` : a.room) : null, a.bed ? `Leito ${a.bed}` : null].filter(Boolean).join(' · ');
}
