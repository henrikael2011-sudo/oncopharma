'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { care, dateBR } from '../../lib/care-client';
import { SIGNATURE, useMe } from './CareShell';
type Home = { nextCycle: { number: number; date: string; status: string } | null; reminders: { kind: string; text: string; date?: string }[]; guidance: { id: string; text: string }[] };
export function CareHome() {
  const { me } = useMe(); const [h, setH] = useState<Home | null>(null); const [err, setErr] = useState('');
  useEffect(() => { care<Home>('me/home').then(setH).catch((e) => setErr(e.message)); }, []);
  return <>
    <p className="kicker">ONCOPHARMA Care</p>
    <h1>{me.displayName ? `Olá, ${me.displayName}.` : 'Olá.'} Como você está hoje?</h1>
    <p className="care-signature">{SIGNATURE}</p>
    <Link className="btn-primary btn-large" href="/care/sintoma">Registrar como estou</Link>
    {err && <p role="alert">{err}</p>}
    {h && <div className="care-cards">
      <section className="care-card" aria-labelledby="h-next"><h2 id="h-next">Próxima sessão</h2>{h.nextCycle ? <p><strong>{dateBR(h.nextCycle.date)}</strong><br />Ciclo {h.nextCycle.number} · {h.nextCycle.status}</p> : <p>Nenhuma sessão agendada no momento.</p>}</section>
      <section className="care-card" aria-labelledby="h-rem"><h2 id="h-rem">Lembretes</h2>{h.reminders.length ? <ul className="care-list">{h.reminders.map((r, i) => <li key={i}>{r.text}{r.date ? ` — ${dateBR(r.date)}` : ''}</li>)}</ul> : <p>Sem lembretes por enquanto.</p>}</section>
      <section className="care-card help" aria-labelledby="h-help"><h2 id="h-help">Preciso de ajuda</h2><p>Sinais de alerta e contatos.</p><Link className="btn-secondary" href="/care/ajuda">Ver ajuda</Link></section>
    </div>}
    {h && h.guidance.length > 0 && <section className="care-panel" aria-labelledby="h-guid"><h2 id="h-guid">Orientações da sua equipe</h2><ul className="care-list">{h.guidance.map((g) => <li key={g.id}>{g.text}</li>)}</ul></section>}
  </>;
}
