'use client';
// M21 — "Alertas": avisos reais vêm de me/home (lembretes e orientações da equipe). Os exemplos de alerta
// de febre/remédio são ESTÁTICOS e fictícios (rotulados). O app avisa; quem avalia e decide é a equipe.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { care, dateBR } from '../../lib/care-client';
import { Skeleton, TEAM_DECIDES } from './CareShell';
import { Icon, Tile } from './Icons';
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
    <section className="cm-alert" aria-labelledby="a-fever" data-static-demo><span className="cm-static">Exemplo estático · fictício</span>
      <h2 id="a-fever"><Tile name="thermo" gold />Temperatura subiu</h2><p className="cm-sub">37,8 °C hoje às 08:10 (exemplo)</p>
      <p><b>O que fazer</b></p><ol className="care-list"><li>Com <span className="cm-fever">37,8 °C ou mais</span>, ligue para a equipe — ela avalia e orienta.</li><li>Não tome remédio por conta própria.</li></ol>
      <Link className="btn-primary" href="/care/equipe"><Icon name="phone" />Ligar para a equipe</Link></section>
    <section className="cm-alert" aria-labelledby="a-med" data-static-demo><span className="cm-static">Exemplo estático · fictício</span>
      <h2 id="a-med"><Tile name="pill" gold />Remédio das 12:00</h2>
      <ol className="care-list"><li>Tome se ainda estiver no horário orientado.</li><li>Se esqueceu, pergunte à farmacêutica.</li></ol>
      <Link className="btn-secondary" href="/care/medicamentos"><Icon name="circleCheck" />Ver meus remédios</Link></section>
    <section className="care-card" aria-labelledby="a-done" data-static-demo><span className="cm-static">Exemplo estático · fictício</span><h2 id="a-done"><Tile name="circleCheck" />Resolvidos</h2>
      <div className="cm-row"><div><b>Enjoo leve registrado</b><div className="cm-sub">20/10 · equipe viu</div></div><span className="cm-pill">Visto</span></div>
      <div className="cm-row"><div><b>Consulta confirmada</b><div className="cm-sub">19/10</div></div><span className="cm-pill">Ok</span></div></section>
    <p className="care-note">Em uma emergência, ligue 192 (SAMU). <a className="btn-danger" href="tel:192">Ligar 192</a></p>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
