'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { care, dateBR } from '../../lib/care-client';
import { SIGNATURE, useMe } from './CareShell';
type Home = { sections: { journey: boolean; medications: boolean; symptoms: boolean }; nextCycle: { number: number; date: string; status: string } | null; reminders: { kind: string; text: string; date?: string }[]; guidance: { id: string; text: string }[] };
export function CareHome() {
  const { me } = useMe(); const [h, setH] = useState<Home | null>(null); const [err, setErr] = useState('');
  useEffect(() => { care<Home>('me/home').then(setH).catch((e) => setErr(e.message)); }, []);
  return <>
    <p className="kicker">ONCOPHARMA Care</p>
    {me.actor === 'caregiver'
      ? <h1>{me.displayName ? `Olá, ${me.displayName}.` : 'Olá.'} Você acompanha {me.patientName ?? 'um paciente'}.</h1>
      : <h1>{me.displayName ? `Olá, ${me.displayName}.` : 'Olá.'} Como você está hoje?</h1>}
    <p className="care-signature">{SIGNATURE}</p>
    {me.actor === 'patient' && <Link className="btn-primary btn-large" href="/care/sintoma">Registrar como estou</Link>}
    {me.actor === 'caregiver' && h?.sections.symptoms && <Link className="btn-primary btn-large" href="/care/sintoma">Registrar sintoma de {me.patientName ?? 'quem eu acompanho'}</Link>}
    {me.actor === 'caregiver' && h && !h.sections.journey && !h.sections.medications && !h.sections.symptoms && <p className="care-lead" role="status">{me.patientName ?? 'O paciente'} ainda não liberou nenhuma informação para você.</p>}
    {err && <p role="alert">{err}</p>}
    {h && <div className="care-cards">
      {h.sections.journey && <section className="care-card" aria-labelledby="h-next"><h2 id="h-next">Próxima sessão</h2>{h.nextCycle ? <p><strong>{dateBR(h.nextCycle.date)}</strong><br />Ciclo {h.nextCycle.number} · {h.nextCycle.status}</p> : <p>Nenhuma sessão agendada no momento.</p>}</section>}
      {(h.sections.journey || h.sections.medications) && <section className="care-card" aria-labelledby="h-rem"><h2 id="h-rem">Lembretes</h2>{h.reminders.length ? <ul className="care-list">{h.reminders.map((r, i) => <li key={i}>{r.text}{r.date ? ` — ${dateBR(r.date)}` : ''}</li>)}</ul> : <p>Sem lembretes por enquanto.</p>}</section>}
      <section className="care-card help" aria-labelledby="h-help"><h2 id="h-help">Preciso de ajuda</h2><p>Sinais de alerta e contatos.</p><Link className="btn-secondary" href="/care/ajuda">Ver ajuda</Link></section>
    </div>}
    {h && h.guidance.length > 0 && <section className="care-panel" aria-labelledby="h-guid"><h2 id="h-guid">Orientações da sua equipe</h2><ul className="care-list">{h.guidance.map((g) => <li key={g.id}>{g.text}</li>)}</ul></section>}
  </>;
}
