'use client';
// M21 — "Alertas": avisos reais vêm de me/home (lembretes e orientações da equipe). Os exemplos de alerta
// de febre/remédio são ESTÁTICOS e fictícios (rotulados). O app avisa; quem avalia e decide é a equipe.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { care, dateBR } from '../../lib/care-client';
import { Skeleton, TEAM_DECIDES } from './CareShell';
import { Icon, Tile } from './Icons';
import { DEMO_ONLY, FICTIONAL_NAME, FICTIONAL_PHONE, STATIC_EXAMPLE } from '../DemoLabels';
import { MEDICATION_RULE } from '../../lib/care-guidance';
import { LOCAL_URGENT_TEXT, LOCAL_URGENT_TITLE } from '../../lib/care-urgency';
type Home = { reminders: { kind: string; text: string; date?: string }[]; guidance: { id: string; text: string }[] };
export function Alerts() {
  const [h, setH] = useState<Home | null>(null), [err, setErr] = useState('');
  useEffect(() => { care<Home>('me/home').then(setH).catch((e) => setErr(e.message)); }, []);
  return <section aria-labelledby="a-title">
    <div><h1 id="a-title">Alertas</h1><p className="care-lead">O app avisa. Quem avalia é a sua equipe.</p></div>
    {err && <p role="alert">{err}</p>}
    {!h && !err && <Skeleton label="Carregando avisos…" />}
    {h && <section className="care-card" aria-labelledby="a-real"><h2 id="a-real"><Tile name="bell" />Avisos da sua equipe</h2>
      {h.reminders.length + h.guidance.length ? <ul className="care-list">{h.reminders.map((r, i) => <li key={`r${i}`}>{r.text}{r.date ? ` — ${dateBR(r.date)}` : ''}</li>)}{h.guidance.map((g) => <li key={g.id}>{g.text}</li>)}</ul> : <p>Nenhum aviso no momento.</p>}</section>}
    <section className="cm-alert" aria-labelledby="a-fever" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="a-fever"><Tile name="thermo" gold />Febre registrada (exemplo)</h2><p className="cm-sub">Febre (<span className="cm-fever">37,8 °C ou mais</span>) · hoje às 08:10 (exemplo)</p>
      <p><b>{LOCAL_URGENT_TITLE}</b></p><p>{LOCAL_URGENT_TEXT}</p>
      <a className="btn-danger" href="tel:192"><Icon name="phone" />Ligar 192</a></section>
    <section className="cm-alert" aria-labelledby="a-med" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="a-med"><Tile name="pill" gold />Lembrete de remédio (exemplo)</h2><p>{MEDICATION_RULE}</p>
      <Link className="btn-secondary" href="/care/medicamentos"><Icon name="circleCheck" />Ver meus remédios</Link></section>
    <section className="care-card" aria-labelledby="a-done" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span><h2 id="a-done"><Tile name="circleCheck" />Resolvidos</h2>
      <div className="cm-row"><div><b>Enjoo leve registrado</b><div className="cm-sub">20/10 · equipe viu</div></div><span className="cm-pill">Visto</span></div>
      <div className="cm-row"><div><b>Consulta confirmada</b><div className="cm-sub">19/10</div></div><span className="cm-pill">Ok</span></div></section>
    <p className="care-note">Em uma emergência, ligue 192 (SAMU).</p>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
