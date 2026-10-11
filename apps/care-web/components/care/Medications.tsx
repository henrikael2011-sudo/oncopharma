'use client';
// M15.2 — somente leitura + adesão relatada. Nunca exibe dose nem permite alterar a prescrição.
import { useCallback, useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
type M = { id: string; name: string; schedule: string; atHome: boolean; today: 'taken' | 'missed' | 'partial' | null };
const LABEL = { taken: 'Tomei', partial: 'Tomei só parte', missed: 'Não tomei' } as const;
export function Medications() {
  const [list, setList] = useState<M[] | null>(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const load = useCallback(() => care<{ medications: M[] }>('me/medications').then((r) => setList(r.medications)).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function report(m: M, status: keyof typeof LABEL) { setErr(''); try { await care(`me/medications/${m.id}/adherence`, { method: 'POST', body: { status, requestId: crypto.randomUUID() } }); setMsg(`${m.name}: registrado "${LABEL[status]}" hoje.`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }
  return <section aria-labelledby="m-title"><h1 id="m-title">Meus medicamentos</h1>
    <p className="care-lead">Siga sempre a orientação da sua equipe. Não altere doses por conta própria.</p>
    {err && <p role="alert">{err}</p>}{msg && <p role="status">{msg}</p>}
    {list && (list.length ? <ul className="care-med-list">{list.map((m) => <li key={m.id} className="care-card"><h2>{m.name}</h2><p>{m.schedule}</p>
      {m.atHome ? <div role="group" aria-label={`Como foi hoje com ${m.name}?`} className="care-actions">{(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => <button key={k} type="button" className={m.today === k ? 'btn-primary' : 'btn-secondary'} aria-pressed={m.today === k} onClick={() => void report(m, k)}>{LABEL[k]}</button>)}</div> : <p className="care-note">Feito no hospital.</p>}
    </li>)}</ul> : <p>Nenhum medicamento registrado pela sua equipe.</p>)}
  </section>;
}
