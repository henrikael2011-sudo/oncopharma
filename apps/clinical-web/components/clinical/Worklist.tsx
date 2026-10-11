'use client';
// M15.4 — lista mínima (diretrizes §2–§4): identificação segura, gravidade e pendências. Detalhe só ao abrir o paciente.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { work, type Row } from '../../lib/work-client';
import { useStaff } from './ClinicalShell';

const SEV: Record<string, [string, string]> = { urgent: ['Urgente', 'sev sev-urgent'], review: ['Revisão', 'sev sev-review'] };
export function Worklist() {
  const me = useStaff();
  const [rows, setRows] = useState<Row[] | null>(null), [q, setQ] = useState(''), [searched, setSearched] = useState(false), [err, setErr] = useState('');
  const load = useCallback(async (term: string) => {
    setErr('');
    try { const r = await work<{ patients: Row[]; searched: boolean }>(`worklist${term ? `?q=${encodeURIComponent(term)}` : ''}`); setRows(r.patients); setSearched(r.searched); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); }
  }, []);
  useEffect(() => { void load(''); }, [load]);
  return <section aria-labelledby="lista-titulo">
    <div className="clin-toolbar">
      <div><p className="kicker">ONCOPHARMA Clinical · {me.roleLabel}</p><h1 id="lista-titulo">Pacientes</h1></div>
      <form role="search" className="clin-search" onSubmit={(e) => { e.preventDefault(); void load(q.trim()); }}>
        <label htmlFor="busca">Buscar paciente</label>
        <input id="busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou prontuário" minLength={2} maxLength={60} autoComplete="off" />
        <button type="submit" className="btn-primary">Buscar</button>
        {searched && <button type="button" className="btn-secondary" onClick={() => { setQ(''); void load(''); }}>Limpar</button>}
      </form>
    </div>
    {err && <p role="alert" className="clin-error">{err}</p>}
    {!rows ? <p role="status">Carregando pacientes…</p>
      : rows.length === 0 ? <p className="clin-empty" role="status">{searched ? 'Nenhum paciente encontrado entre os seus vínculos.' : 'Nenhum paciente vinculado a você.'}</p>
      : <ul className="patient-list" aria-label={searched ? 'Resultado da busca' : 'Pacientes vinculados'}>
        {rows.map((p) => <li key={p.id}><Link className="patient-row" href={`/clinical/pacientes/${p.id}`}>
          <span className="pr-name">{p.name}</span>
          <span className="pr-record">{p.record ? `Prontuário ${p.record}` : 'Sem prontuário'}</span>
          <span className={p.severity ? SEV[p.severity][1] : 'sev sev-none'}>{p.severity ? SEV[p.severity][0] : 'Sem alerta aberto'}</span>
          <span className="pr-pending">{p.pending === 0 ? 'Sem pendências' : p.pending === 1 ? '1 pendência' : `${p.pending} pendências`}</span>
        </Link></li>)}
      </ul>}
  </section>;
}
