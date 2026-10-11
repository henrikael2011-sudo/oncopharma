// M15.4b — Regras de alocação hospitalar (unidade/andar/quarto/leito). Puras e testáveis.
export type Allocation = { unit: string; floor: string | null; room: string | null; bed: string | null };
export type FeedItem = Allocation & { record: string; ref: string | null; at: string | null };
export const FORMATS = ['fhir_r4', 'hl7v2_adt'] as const;
export const FORMAT_LABEL: Record<string, string> = { fhir_r4: 'FHIR R4', hl7v2_adt: 'HL7 ADT' };
const RECORD = /^[A-Za-z0-9-]{3,30}$/;
const LIMITS: Record<keyof Allocation, [number, number]> = { unit: [2, 80], floor: [1, 40], room: [1, 40], bed: [1, 20] };
function field(v: unknown, k: keyof Allocation): string | null {
  if (v === undefined || v === null || v === '') { if (k === 'unit') throw new Error('Unidade é obrigatória'); return null; }
  if (typeof v !== 'string') throw new Error(`${k}: valor inválido`);
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s && k !== 'unit') return null;
  const [min, max] = LIMITS[k];
  if (s.length < min || s.length > max) throw new Error(`${({ unit: 'Unidade', floor: 'Andar', room: 'Quarto', bed: 'Leito' })[k]}: de ${min} a ${max} caracteres`);
  return s;
}
export function normalizeAllocation(body: unknown): Allocation {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return { unit: field(b.unit, 'unit')!, floor: field(b.floor, 'floor'), room: field(b.room, 'room'), bed: field(b.bed, 'bed') };
}
/** Valida o retorno do integration-gateway (defesa em profundidade: a API não confia no gateway). */
export function validateFeed(raw: unknown): { source: string; format: (typeof FORMATS)[number]; adapterVersion: string; fetchedAt: string; items: FeedItem[] } {
  const r = raw as Record<string, unknown>;
  if (!r || r.syntheticOnly !== true) throw new Error('Feed sem marcação sintética');
  if (typeof r.source !== 'string' || r.source.length < 2 || r.source.length > 80) throw new Error('Origem inválida');
  if (!(FORMATS as readonly string[]).includes(String(r.format))) throw new Error('Formato inválido');
  if (typeof r.adapterVersion !== 'string' || r.adapterVersion.length > 60) throw new Error('Versão do adaptador inválida');
  if (typeof r.fetchedAt !== 'string' || Number.isNaN(Date.parse(r.fetchedAt))) throw new Error('Horário inválido');
  if (!Array.isArray(r.items) || r.items.length > 500) throw new Error('Itens inválidos');
  const seen = new Set<string>();
  const items = r.items.map((x) => {
    const i = x as Record<string, unknown>;
    if (typeof i.record !== 'string' || !RECORD.test(i.record)) throw new Error('Prontuário inválido');
    if (seen.has(i.record)) throw new Error(`Prontuário repetido no feed: ${i.record}`); seen.add(i.record);
    const a = normalizeAllocation(i);
    const ref = typeof i.ref === 'string' ? i.ref.slice(0, 120) : null;
    const at = typeof i.at === 'string' && !Number.isNaN(Date.parse(i.at)) ? new Date(i.at).toISOString() : null;
    return { ...a, record: i.record, ref, at };
  });
  return { source: r.source, format: r.format as (typeof FORMATS)[number], adapterVersion: r.adapterVersion, fetchedAt: new Date(r.fetchedAt).toISOString(), items };
}
const k = (v: string | null) => (v ?? '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
export const sameAllocation = (a: Allocation, b: Allocation) => k(a.unit) === k(b.unit) && k(a.floor) === k(b.floor) && k(a.room) === k(b.room) && k(a.bed) === k(b.bed);
/** Decide o efeito de um item sincronizado sobre a alocação atual. Manual divergente NUNCA é sobrescrita automaticamente. */
export function syncOutcome(current: (Allocation & { source: 'hospital' | 'manual' }) | null, incoming: Allocation): 'updated' | 'unchanged' | 'confirmed' | 'conflict' {
  if (!current) return 'updated';
  if (current.source === 'hospital') return sameAllocation(current, incoming) ? 'unchanged' : 'updated';
  return sameAllocation(current, incoming) ? 'confirmed' : 'conflict';
}
export const allocationLabel = (a: Allocation) => [a.unit, a.floor, a.room ? (/^\d/.test(a.room) ? `Quarto ${a.room}` : a.room) : null, a.bed ? `Leito ${a.bed}` : null].filter(Boolean).join(' · ');
