// M15.5 / D-012: registro humano; nenhuma escrita no sistema de prescrição.
export const REQUEST_LABELS = { draft: 'Rascunho', sent: 'Enviada', in_review: 'Em revisão', accepted: 'Aceita', adjusted: 'Ajustada', declined: 'Recusada', completed: 'Concluída', discarded: 'Descartada' } as const;
export type RequestStatus = keyof typeof REQUEST_LABELS;
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = { draft: ['sent', 'discarded'], sent: ['in_review'], in_review: ['accepted', 'adjusted', 'declined'], accepted: ['completed'], adjusted: ['completed'], declined: ['completed'], completed: [], discarded: [] };
export const REQUEST_ROLES = ['pharmacist', 'nurse', 'physician'];
export const EVIDENCE_TYPES = ['alert', 'order', 'administration', 'lab', 'symptom'] as const;
export const PRIORITY_LABELS = { routine: 'Rotina', priority: 'Prioritária', urgent: 'Urgente' } as const;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requestTransition(from: RequestStatus, to: RequestStatus, author: boolean, recipient: boolean) {
  if (!REQUEST_TRANSITIONS[from]?.includes(to)) return false;
  return ['sent', 'discarded', 'completed'].includes(to) ? author : recipient;
}
export function evidenceRefs(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) throw Error('Selecione de 1 a 10 evidências');
  const refs = value.map((v) => {
    if (!v || !EVIDENCE_TYPES.includes(v.type) || typeof v.id !== 'string' || !UUID.test(v.id)) throw Error('Evidência inválida');
    return { type: v.type as (typeof EVIDENCE_TYPES)[number], id: v.id };
  });
  if (new Set(refs.map((v) => `${v.type}:${v.id}`)).size !== refs.length) throw Error('Evidência repetida');
  return refs;
}
