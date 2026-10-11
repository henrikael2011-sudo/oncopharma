'use client';
import { useEffect, useState } from 'react';
import { care, dateBR } from '../../lib/care-client';
type J = { cycles: { number: number; date: string | null; status: string }[]; reports: { id: string; symptom: string; status: string; at: string }[] };
export function Journey() {
  const [j, setJ] = useState<J | null>(null), [err, setErr] = useState('');
  useEffect(() => { care<J>('me/journey').then(setJ).catch((e) => setErr(e.message)); }, []);
  return <section aria-labelledby="j-title"><h1 id="j-title">Minha jornada</h1>{err && <p role="alert">{err}</p>}
    {j && <><section className="care-panel" aria-labelledby="j-cyc"><h2 id="j-cyc">Sessões do tratamento</h2>{j.cycles.length ? <ol className="care-timeline">{j.cycles.map((c) => <li key={c.number}><strong>Ciclo {c.number}</strong> — {c.date ? dateBR(c.date) : 'data a definir'} · {c.status}</li>)}</ol> : <p>Ainda não há sessões registradas.</p>}</section>
      <section className="care-panel" aria-labelledby="j-rep"><h2 id="j-rep">Meus relatos</h2>{j.reports.length ? <ul className="care-list">{j.reports.map((r) => <li key={r.id}>{new Date(r.at).toLocaleDateString('pt-BR')} — {r.symptom} · {r.status}</li>)}</ul> : <p>Você ainda não enviou relatos.</p>}</section></>}
  </section>;
}
