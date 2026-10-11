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
export function RecordTab({ id }: { id: string }) {
  const [r, setR] = useState<Rec | null>(null), [err, setErr] = useState('');
  useEffect(() => { fetch(`/api/clinical/patients/${id}`, { cache: 'no-store' }).then(async (x) => { const j = await x.json(); if (!x.ok) throw Error(j.error || 'Indisponível'); setR(j); }).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p role="alert" className="clin-error">{err}</p>;
  if (!r) return <p role="status">Carregando prontuário…</p>;
  return <div className="record">
    <details open><summary>Ciclos e protocolos</summary><ul className="clin-list">{r.cycles.map((c) => <li key={c.id}>{c.protocol_code} · ciclo {c.cycle_number} · {CYCLE[c.status] ?? c.status} · {c.planned_on ?? 'sem data'} · versão {c.revision} {c.approved ? '(aprovada)' : '(sem aprovação institucional)'}</li>)}</ul></details>
    {SECTIONS.map(([k, label, t, v, d]) => <details key={k}><summary>{label} ({(r.structured?.[k] || []).length})</summary>
      {(r.structured?.[k] || []).length === 0 ? <p>Sem registros.</p> : <ul className="clin-list">{(r.structured[k] || []).map((i) => <li key={String(i.id)}><strong>{String(i[t] ?? '—')}</strong> {String(i[v] ?? '—')} {i.unit ? String(i.unit) : ''} <small>· {when(String(i[d]))} · Origem: {String(i.source_reference ?? 'não informada')}</small></li>)}</ul>}
    </details>)}
  </div>;
}
