// M22 — regras puras da transcrição de prescrição (sem I/O). A equipe TRANSCREVE a prescrição médica; a farmácia
// confere e libera. Nenhuma regra aqui decide conduta, dose ou ajuste — só valida o formato do que foi transcrito.
import { BadRequestException } from '@nestjs/common';
export const ROUTES = { VO: 'Oral', 'SC-casa': 'Subcutânea (em casa)', SC: 'Subcutânea', IV: 'Intravenosa', IM: 'Intramuscular', topica: 'Tópica', outra: 'Outra' } as const;
export type Route = keyof typeof ROUTES;
export const AT_HOME_ROUTES: Route[] = ['VO', 'SC-casa', 'topica'];
export const ENTRY_ROLES = ['pharmacist', 'nurse', 'physician'] as const; // quem transcreve
export const RELEASE_ROLES = ['pharmacist'] as const; // quem confere e libera
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Plano v3 (linha "Sem dose ou automedicação sugerida ao paciente"): orientação que vai ao paciente não leva quantidade/unidade. */
export const PATIENT_DOSE_PATTERN = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|ui|gotas?|comprimidos?|c[aá]psulas?|ampolas?)\b/i;
export type TranscriptionInput = { medication: string; dose: string; route: Route; times: string[]; frequency: string; startDate: string; endDate: string | null; instructions: string; prescriptionRef: string };
const str = (v: unknown, min: number, max: number, f: string) => { if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw new BadRequestException(`${f}: informe entre ${min} e ${max} caracteres`); return v.trim(); };
export function parseTranscription(b: Record<string, unknown>): TranscriptionInput {
  if (!b || typeof b !== 'object') throw new BadRequestException('Transcrição inválida');
  const medication = str(b.medication, 2, 120, 'Medicamento');
  const dose = str(b.dose, 1, 80, 'Dose (como prescrita)');
  const route = String(b.route) as Route; if (!(route in ROUTES)) throw new BadRequestException('Via inválida');
  const times = Array.isArray(b.times) ? [...new Set(b.times.map(String))].sort() : [];
  if (times.length < 1 || times.length > 8 || times.some((t) => !HHMM.test(t))) throw new BadRequestException('Horários: informe de 1 a 8 no formato HH:MM');
  const frequency = str(b.frequency, 2, 120, 'Frequência');
  const startDate = String(b.startDate); if (!DATE.test(startDate) || Number.isNaN(Date.parse(startDate))) throw new BadRequestException('Data de início inválida');
  const endDate = b.endDate ? String(b.endDate) : null;
  if (endDate && (!DATE.test(endDate) || Number.isNaN(Date.parse(endDate)) || endDate < startDate)) throw new BadRequestException('Data de término inválida (deve ser igual ou posterior ao início)');
  const instructions = str(b.instructions, 2, 500, 'Orientações da equipe ao paciente');
  if (PATIENT_DOSE_PATTERN.test(instructions)) throw new BadRequestException('As orientações ao paciente não podem conter dose (quantidade e unidade). Registre a dose no campo próprio — ela não é exibida no Care.');
  const prescriptionRef = str(b.prescriptionRef, 3, 160, 'Referência da prescrição médica');
  return { medication, dose, route, times, frequency, startDate, endDate, instructions, prescriptionRef };
}
export function parseDiscontinue(b: Record<string, unknown>) {
  return { prescriptionRef: str(b?.prescriptionRef, 3, 160, 'Referência da prescrição médica'), reason: str(b?.reason, 3, 500, 'Motivo (conforme prescrição)') };
}
/** Origem do rascunho. Foto (IA ou extrator simulado) e hospital (simulado) só PRÉ-PREENCHEM: a equipe revisa e a farmácia libera. */
export const ENTRY_SOURCES = { manual: 'Manual', foto_ia: 'Foto da prescrição (rascunho por IA)', hospital: 'Sistema do hospital (orais)' } as const;
export type EntrySource = keyof typeof ENTRY_SOURCES;
export function parseSource(b: Record<string, unknown>): { entrySource: EntrySource; sourceDetail: string | null } {
  const e = b?.entrySource === undefined ? 'manual' : String(b.entrySource);
  if (!(e in ENTRY_SOURCES)) throw new BadRequestException('Origem inválida');
  const d = typeof b?.sourceDetail === 'string' && b.sourceDetail.trim() ? b.sourceDetail.trim().slice(0, 160) : null;
  return { entrySource: e as EntrySource, sourceDetail: e === 'manual' ? null : d };
}
const HOSP_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Valida o feed do gateway (hospital simulado): somente sintético, somente via oral, campos limitados. */
export function validateHospitalMeds(j: any) {
  if (!j || j.syntheticOnly !== true || j.format !== 'fhir_r4' || !Array.isArray(j.items) || j.items.length > 50) throw new Error('feed inválido');
  return { source: String(j.source).slice(0, 80), adapterVersion: String(j.adapterVersion).slice(0, 60), skippedNonOral: Number(j.skippedNonOral) || 0,
    items: j.items.filter((i: any) => i && i.route === 'VO' && typeof i.medication === 'string' && i.medication.trim().length >= 2).map((i: any) => ({
      ref: String(i.ref).slice(0, 80), medication: String(i.medication).slice(0, 120), dose: String(i.dose ?? '').slice(0, 80), route: 'VO',
      times: (Array.isArray(i.times) ? i.times : []).map(String).filter((t: string) => HOSP_TIME.test(t)).slice(0, 8), frequency: String(i.frequency ?? '').slice(0, 120),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(i.startDate)) ? String(i.startDate) : '', endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(i.endDate)) ? String(i.endDate) : '',
      instructions: PATIENT_DOSE_PATTERN.test(String(i.instructions ?? '')) ? '' : String(i.instructions ?? '').slice(0, 500) })) };
}
export const canEnter = (role: string) => (ENTRY_ROLES as readonly string[]).includes(role);
export const canRelease = (role: string) => (RELEASE_ROLES as readonly string[]).includes(role);
export const isUuid = (v: unknown) => typeof v === 'string' && UUID.test(v);
/** Ativo no Care na data (YYYY-MM-DD): dentro do período transcrito. */
export function activeOn(day: string, startDate: string, endDate: string | null) { return startDate <= day && (!endDate || day <= endDate); }
export const STATUS_LABEL = { pending_release: 'Aguardando liberação da farmácia', released: 'Liberado', rejected: 'Devolvido pela farmácia', superseded: 'Substituído por versão nova', discontinued: 'Suspenso' } as const;
export const KIND_LABEL = { new: 'Inclusão', update: 'Atualização', discontinue: 'Suspensão' } as const;
