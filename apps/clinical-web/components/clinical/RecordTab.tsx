'use client';
// M15.4 — prontuário estruturado do paciente aberto (consulta auditada: patient.record.read). Prescrição ≠ administração.
import { useEffect, useState } from 'react';
import { when } from '../../lib/work-client';

type Item = Record<string, string | number | null>;
type Rec = { cycles: { id: string; cycle_number: number; planned_on: string | null; status: string; protocol_code: string; revision: string; approved: boolean }[]; structured: Record<string, Item[]> };
const SECTIONS = [['allergies', 'Alergias', 'substance', 'reaction', 'recorded_at'], ['measurements', 'Medidas', 'kind', 'value', 'measured_at'], ['labs', 'Exames', 'analyte_label', 'result_value', 'collected_at'],
  ['medicationOrders', 'Medicamentos prescritos', 'medication', 'status', 'ordered_at'], ['medicationAdministrations', 'Medicamentos administrados', 'medication', 'status', 'administered_at'],
  ['pharmacyAssessments', 'Avaliações farmacêuticas', 'title', 'summary', 'authored_at']] as const;
const CYCLE: Record<string, string> = { planned: 'Planejado', under_review: 'Em revisão', completed: 'Realizado', cancelled: 'Cancelado' };
type Key = (typeof SECTIONS)[number][0];
export const MEDICATION_KEYS: readonly Key[] = ['medicationOrders', 'medicationAdministrations'];
export const LAB_KEYS: readonly Key[] = ['labs'];
// M17: as abas Medicamentos/Exame/Visão geral reutilizam esta mesma leitura (patient.record.read), só filtrando seções.
export function RecordTab({ id, only, summary = false }: { id: string; only?: readonly Key[]; summary?: boolean }) {
  const [r, setR] = useState<Rec | null>(null), [err, setErr] = useState('');
  useEffect(() => { fetch(`/api/clinical/patients/${id}`, { cache: 'no-store' }).then(async (x) => { const j = await x.json(); if (!x.ok) throw Error(j.error || 'Indisponível'); setR(j); }).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p role="alert" className="clin-error">{err}</p>;
  if (!r) return <p role="status">Carregando prontuário…</p>;
  if (summary) return <ul className="clin-list" aria-label="Resumo do prontuário">
    <li>Ciclos: {r.cycles.length}{r.cycles[0] ? ` · próximo/atual: ${r.cycles[0].protocol_code} ciclo ${r.cycles[0].cycle_number} (${CYCLE[r.cycles[0].status] ?? r.cycles[0].status})` : ''}</li>
    {SECTIONS.map(([k, label]) => <li key={k}>{label}: {(r.structured?.[k] || []).length}</li>)}</ul>;
  const sections = only ? SECTIONS.filter(([k]) => only.includes(k)) : SECTIONS;
  return <div className="record">
    {!only && <details open><summary>Ciclos e protocolos</summary><ul className="clin-list">{r.cycles.map((c) => <li key={c.id}>{c.protocol_code} · ciclo {c.cycle_number} · {CYCLE[c.status] ?? c.status} · {c.planned_on ?? 'sem data'} · versão {c.revision} {c.approved ? '(aprovada)' : '(sem aprovação institucional)'}</li>)}</ul></details>}
    {sections.map(([k, label, t, v, d]) => <details key={k} open={!!only}><summary>{label} ({(r.structured?.[k] || []).length})</summary>
      {(r.structured?.[k] || []).length === 0 ? <p>Sem registros.</p> : <ul className="clin-list">{(r.structured[k] || []).map((i) => <li key={String(i.id)}><strong>{String(i[t] ?? '—')}</strong> {String(i[v] ?? '—')} {i.unit ? String(i.unit) : ''} <small>· {when(String(i[d]))} · Origem: {String(i.source_reference ?? 'não informada')}</small></li>)}</ul>}
    </details>)}
  </div>;
}
