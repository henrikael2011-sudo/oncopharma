// M15.4 — regras do Clinical sem decisão clínica automática: estados de alerta (Plano v3 §5.1), quem pode cada transição,
// e checklist pré-ciclo de DISPONIBILIDADE de dados (nunca declara aptidão; dado ausente => "Não é possível concluir").
export const STAFF_ROLES = ['pharmacist', 'physician', 'nurse', 'clinical_manager'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const ALERT_STATES = ['detected', 'awaiting_review', 'in_evaluation', 'referred', 'monitoring', 'resolved', 'dismissed', 'duplicate'] as const;
export type AlertState = (typeof ALERT_STATES)[number];
export const FINAL_STATES: AlertState[] = ['resolved', 'dismissed', 'duplicate'];
export const ALERT_LABEL: Record<AlertState, string> = {
  detected: 'Detectado', awaiting_review: 'Aguardando revisão', in_evaluation: 'Em avaliação', referred: 'Encaminhado',
  monitoring: 'Em acompanhamento', resolved: 'Resolvido', dismissed: 'Descartado', duplicate: 'Duplicado',
};
// Espelha o trigger clinical_alert_transition_guard (0011): a API recusa antes, o banco garante.
export const TRANSITIONS: Record<AlertState, AlertState[]> = {
  detected: ['awaiting_review', 'dismissed', 'duplicate'],
  awaiting_review: ['in_evaluation', 'dismissed', 'duplicate'],
  in_evaluation: ['referred', 'monitoring', 'resolved', 'dismissed', 'duplicate'],
  referred: ['in_evaluation', 'monitoring', 'resolved'],
  monitoring: ['in_evaluation', 'referred', 'resolved'],
  resolved: [], dismissed: [], duplicate: [],
};
// P-CLIN-1 (proposta em vigor): descartar, marcar duplicado e resolver exigem farmacêutico ou médico; enfermagem avalia,
// acompanha e encaminha. Gestor clínico sem vínculo não acessa paciente (telas de gestão no M15.7).
const DECIDERS: StaffRole[] = ['pharmacist', 'physician'];
export function canTransition(role: StaffRole, from: AlertState, to: AlertState): boolean {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  if (['dismissed', 'duplicate', 'resolved'].includes(to)) return DECIDERS.includes(role);
  return role !== 'clinical_manager' || to === 'in_evaluation';
}
export const allowedTransitions = (role: StaffRole, from: AlertState) => (TRANSITIONS[from] || []).filter((to) => canTransition(role, from, to));
export function primaryRole(roles: string[]): StaffRole | null {
  for (const r of STAFF_ROLES) if (roles.includes(r)) return r;
  return null;
}
export const ROLE_LABEL: Record<StaffRole, string> = { pharmacist: 'Farmácia', physician: 'Medicina', nurse: 'Enfermagem', clinical_manager: 'Gestão clínica' };

/** Normaliza a busca: 2..60 caracteres, sem curingas do LIKE; minúsculas sem acento (comparada com a mesma normalização no SQL). */
export function normalizeSearch(q: unknown): string | null {
  if (q === undefined || q === null || q === '') return null;
  if (typeof q !== 'string') return null;
  const t = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[%_\\]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 60) return null;
  return t;
}
export const SQL_FOLD = (col: string) => `translate(lower(${col}),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')`;

export type ChecklistItem = { code: string; label: string; available: boolean; detail: string; source: string | null; at: string | null };
export type PreCycleInput = {
  cycle: { number: number; plannedOn: string | null; protocolCode: string; protocolApproved: boolean } | null;
  labs: { code: string; label: string; collectedAt: string; source: string }[];
  weight: { at: string; source: string } | null;
  allergies: { status: string; at: string; source: string }[];
  reconciliation: { status: string; at: string; source: string } | null;
};
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
/** Checklist de disponibilidade. Referência temporal = data planejada do ciclo (determinística). Não avalia valores. */
export function preCycleChecklist(i: PreCycleInput) {
  const items: ChecklistItem[] = [];
  const ref = i.cycle?.plannedOn ? `${i.cycle.plannedOn}T00:00:00Z` : null; // início do dia planejado; o próprio dia conta (janela -1)
  items.push({ code: 'CYCLE', label: 'Ciclo planejado com data', available: !!ref, detail: i.cycle ? `Ciclo ${i.cycle.number}${i.cycle.plannedOn ? ` previsto para ${i.cycle.plannedOn}` : ' sem data'}` : 'Nenhum ciclo planejado', source: null, at: null });
  items.push({ code: 'PROTOCOL', label: 'Protocolo com versão aprovada', available: !!i.cycle?.protocolApproved, detail: i.cycle ? (i.cycle.protocolApproved ? `${i.cycle.protocolCode} aprovado` : `${i.cycle.protocolCode} sem versão aprovada na instituição`) : 'Sem protocolo', source: null, at: null });
  for (const [code, label] of [['ANC', 'Neutrófilos (até 7 dias antes)'], ['PLT', 'Plaquetas (até 7 dias antes)']] as const) {
    const lab = i.labs.filter((l) => l.code === code && ref && days(l.collectedAt, ref) >= -1 && days(l.collectedAt, ref) <= 7).sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))[0];
    items.push({ code: `LAB_${code}`, label, available: !!lab, detail: lab ? 'Resultado disponível (valor no prontuário)' : 'Sem resultado no período', source: lab?.source ?? null, at: lab?.collectedAt ?? null });
  }
  const w = i.weight && ref && days(i.weight.at, ref) >= -1 && days(i.weight.at, ref) <= 30 ? i.weight : null;
  items.push({ code: 'WEIGHT', label: 'Peso recente (até 30 dias)', available: !!w, detail: w ? 'Registrado' : 'Sem peso no período', source: w?.source ?? null, at: w?.at ?? null });
  const confirmed = i.allergies.find((a) => a.status !== 'unconfirmed');
  items.push({ code: 'ALLERGY', label: 'Alergias confirmadas', available: !!confirmed, detail: confirmed ? 'Revisão registrada' : (i.allergies.length ? 'Registro não confirmado' : 'Sem registro'), source: (confirmed ?? i.allergies[0])?.source ?? null, at: (confirmed ?? i.allergies[0])?.at ?? null });
  const rec = i.reconciliation;
  items.push({ code: 'MED_REC', label: 'Conciliação medicamentosa revisada', available: rec?.status === 'reviewed', detail: rec ? (rec.status === 'reviewed' ? 'Revisada' : 'Pendente de revisão') : 'Sem conciliação', source: rec?.source ?? null, at: rec?.at ?? null });
  const missing = items.filter((x) => !x.available);
  return {
    items, missing: missing.map((x) => x.code),
    conclusion: missing.length ? 'insufficient' as const : 'data_available' as const,
    message: missing.length ? `Não é possível concluir: faltam ${missing.length} ${missing.length === 1 ? 'item' : 'itens'} (${missing.map((x) => x.label.toLowerCase()).join('; ')}).`
      : 'Dados disponíveis para a avaliação profissional. O sistema não declara aptidão para o ciclo.',
    automaticDecision: false,
  };
}
