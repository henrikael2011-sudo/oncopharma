'use client';
// M15.4 — lista mínima (diretrizes §2–§4): identificação segura, gravidade e pendências. Detalhe só ao abrir o paciente.
// M15.4b — agrupamento por alocação hospitalar (unidade · andar) e "Sincronizar" via integration-gateway, com origem e horário.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { roomLabel, when, work, type Row, type SyncResult, type Worklist as WL } from '../../lib/work-client';
import { useStaff } from './ClinicalShell';

const SEV: Record<string, [string, string]> = { urgent: ['Urgente', 'sev sev-urgent'], review: ['Revisão', 'sev sev-review'] };
const NONE = 'Sem alocação informada';
function PatientRow({ p }: { p: Row }) {
  const a = p.allocation;
  return <li><Link className="patient-row" href={`/clinical/pacientes/${p.id}`}>
    <span className="pr-name">{p.name}</span>
    <span className="pr-record">{p.record ? `Prontuário ${p.record}` : 'Sem prontuário'}{a && roomLabel(a) ? ` · ${roomLabel(a)}` : ''}
      {a?.source === 'manual' && <span className="tag-manual"> Manual</span>}{a?.source === 'pdf' && <span className="tag-manual"> PDF importado</span>}{a?.conflict && <span className="tag-conflict"> Divergência com o hospital</span>}</span>
    <span className={p.severity ? SEV[p.severity][1] : 'sev sev-none'}>{p.severity ? SEV[p.severity][0] : 'Sem alerta aberto'}</span>
    <span className="pr-pending">{p.pending === 0 ? 'Sem pendências' : p.pending === 1 ? '1 pendência' : `${p.pending} pendências`}</span>
  </Link></li>;
}
export function Worklist() {
  const me = useStaff();
  const [data, setData] = useState<WL | null>(null), [q, setQ] = useState(''), [err, setErr] = useState(''), [byLocation, setByLocation] = useState(true);
  const [syncing, setSyncing] = useState(false), [syncMsg, setSyncMsg] = useState('');
  const load = useCallback(async (term: string) => {
    setErr('');
    try { setData(await work<WL>(`worklist${term ? `?q=${encodeURIComponent(term)}` : ''}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); }
  }, []);
  useEffect(() => { void load(''); }, [load]);
  const sync = async () => {
    setSyncing(true); setSyncMsg(''); setErr('');
    try {
      const r = await work<SyncResult>('allocations/sync', { method: 'POST', body: {} });
      const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
      setSyncMsg(`Sincronização concluída: ${plural(r.updated, 'atualizado', 'atualizados')}, ${plural(r.unchanged, 'sem alteração', 'sem alteração')}, ${plural(r.conflicts, 'divergência', 'divergências')}, ${plural(r.not_found, 'não localizado', 'não localizados')}.`);
      await load(q.trim());
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setSyncing(false); }
  };
  const rows = data?.patients ?? null, searched = !!data?.searched;
  const groups = useMemo(() => {
    if (!rows) return [];
    const m = new Map<string, Row[]>();
    for (const p of rows) { const k = p.allocation ? [p.allocation.unit, p.allocation.floor].filter(Boolean).join(' · ') : NONE; m.set(k, [...(m.get(k) || []), p]); }
    return [...m.entries()].sort(([a], [b]) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b, 'pt-BR')));
  }, [rows]);
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
    <div className="clin-syncbar">
      <p id="sync-info">{data?.lastSync ? <>Última sincronização: {when(data.lastSync.at)} · Origem: {data.lastSync.source}</> : 'Alocação ainda não sincronizada com o hospital.'}</p>
      <button type="button" className="btn-secondary" onClick={() => void sync()} disabled={syncing} aria-describedby="sync-info">{syncing ? 'Sincronizando…' : 'Sincronizar'}</button>
      {me.role !== 'physician' && <Link className="btn-secondary" href="/clinical/importar">Importar lista (PDF)</Link>}
      <label className="clin-toggle"><input type="checkbox" checked={byLocation} onChange={(e) => setByLocation(e.target.checked)} /> Agrupar por unidade e andar</label>
    </div>
    <div aria-live="polite">{syncMsg && <p role="status" className="clin-ok">{syncMsg}</p>}</div>
    {err && <p role="alert" className="clin-error">{err}</p>}
    {!rows ? <p role="status">Carregando pacientes…</p>
      : rows.length === 0 ? <p className="clin-empty" role="status">{searched ? 'Nenhum paciente encontrado entre os seus vínculos.' : 'Nenhum paciente vinculado a você.'}</p>
      : searched || !byLocation
        ? <ul className="patient-list" aria-label={searched ? 'Resultado da busca' : 'Pacientes vinculados'}>{rows.map((p) => <PatientRow key={p.id} p={p} />)}</ul>
        : <div aria-label="Pacientes vinculados" role="group">{groups.map(([g, list], i) => <section key={g} className="patient-group" aria-labelledby={`grp-${i}`}>
            <h2 id={`grp-${i}`}>{g} <span className="grp-count">({list.length})</span></h2>
            <ul className="patient-list" aria-label={g}>{list.map((p) => <PatientRow key={p.id} p={p} />)}</ul>
          </section>)}</div>}
  </section>;
}
