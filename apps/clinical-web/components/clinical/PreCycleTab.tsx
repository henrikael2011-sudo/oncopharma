'use client';
// M15.4 — pré-ciclo: checklist de DISPONIBILIDADE (não avalia valores, não declara aptidão) + parecer humano persistido.
import { useCallback, useEffect, useState } from 'react';
import { work, when } from '../../lib/work-client';

type Item = { code: string; label: string; available: boolean; detail: string; source: string | null; at: string | null };
type Data = { items: Item[]; conclusion: 'insufficient' | 'data_available'; message: string; reviews: { id: string; status: string; rationale: string; at: string }[]; canReview: boolean };
export function PreCycleTab({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState(''), [msg, setMsg] = useState(''), [dec, setDec] = useState(''), [why, setWhy] = useState('');
  const load = useCallback(async () => { try { setD(await work<Data>(`patients/${id}/precycle`)); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (err && !d) return <p role="alert" className="clin-error">{err}</p>;
  if (!d) return <p role="status">Carregando pré-ciclo…</p>;
  return <div>
    <p className={d.conclusion === 'insufficient' ? 'clin-warn' : 'clin-ok'} role="status">{d.message}</p>
    <ul className="checklist" aria-label="Checklist pré-ciclo">{d.items.map((i) => <li key={i.code} className={i.available ? 'ok' : 'missing'}>
      <strong>{i.available ? 'Disponível' : 'Ausente'}</strong> — {i.label}: {i.detail}{i.source ? <small> · Origem: {i.source}{i.at ? `, ${when(i.at)}` : ''}</small> : null}
    </li>)}</ul>
    {d.canReview && <form className="workflow-form" onSubmit={async (e) => { e.preventDefault(); setErr(''); setMsg(''); try { await work(`patients/${id}/precycle/reviews`, { method: 'POST', body: { decision: dec, rationale: why } }); setWhy(''); setDec(''); await load(); setMsg('Parecer pré-ciclo registrado.'); } catch (x) { setErr(x instanceof Error ? x.message : 'Erro'); } }}>
      <fieldset className="choices"><legend>Parecer profissional</legend>
        <label className="choice"><input type="radio" name="dec" required checked={dec === 'reviewed'} onChange={() => setDec('reviewed')} /> Revisado — segue para decisão da equipe</label>
        <label className="choice"><input type="radio" name="dec" checked={dec === 'blocked'} onChange={() => setDec('blocked')} /> Bloqueado — pendências precisam ser resolvidas</label>
      </fieldset>
      <label htmlFor="pc-why">Fundamentação</label><textarea id="pc-why" rows={3} required minLength={10} maxLength={2000} value={why} onChange={(e) => setWhy(e.target.value)} />
      <button type="submit" className="btn-primary">Registrar parecer</button>
    </form>}
    {msg && <p role="status" className="clin-ok">{msg}</p>}{err && <p role="alert" className="clin-error">{err}</p>}
    {d.reviews.length > 0 && <section aria-labelledby="pc-hist"><h3 id="pc-hist">Pareceres registrados</h3><ul className="clin-list">{d.reviews.map((r) => <li key={r.id}>{when(r.at)} — {r.status === 'blocked' ? 'Bloqueado' : 'Revisado'}: {r.rationale}</li>)}</ul></section>}
  </div>;
}
