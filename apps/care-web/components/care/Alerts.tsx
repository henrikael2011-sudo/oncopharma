'use client';
// M21 — "Alertas": avisos reais vêm de me/home (lembretes e orientações da equipe). Os exemplos de alerta
// de febre/remédio são ESTÁTICOS e fictícios (rotulados). O app avisa; quem avalia e decide é a equipe.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { care, dateBR } from '../../lib/care-client';
import { Skeleton, TEAM_DECIDES } from './CareShell';
import { Icon, Tile } from './Icons';
import { STATIC_EXAMPLE } from '../DemoLabels';
import { MEDICATION_RULE } from '../../lib/care-guidance';
import { LOCAL_URGENT_TEXT, LOCAL_URGENT_TITLE } from '../../lib/care-urgency';
type Home = { reminders: { kind: string; text: string; date?: string }[]; guidance: { id: string; text: string }[] };
type Help = { contacts: { label: string; phone: string | null }[]; contactsConfigured: boolean };
const tel = (p: string) => `tel:${p.replace(/[^0-9+]/g, '')}`;
export function Alerts() {
  const [h, setH] = useState<Home | null>(null), [err, setErr] = useState(''), [help, setHelp] = useState<Help | null>(null);
  useEffect(() => { care<Home>('me/home').then(setH).catch((e) => setErr(e.message)); care<Help>('me/help').then(setHelp).catch(() => setHelp(null)); }, []);
  const phone = help?.contactsConfigured ? help.contacts.find((c) => c.phone)?.phone ?? null : null;
  const active = h ? h.reminders.length + h.guidance.length : 0;
  return <section aria-labelledby="a-title">
    <div className="cm-title-row"><h1 id="a-title">Seus alertas</h1>{h && <span className="cm-pill g" data-alert-count>{active} {active === 1 ? 'ativo' : 'ativos'}</span>}</div>
    <p className="care-lead">O app avisa. Quem avalia é a sua equipe.</p>
    {err && <p role="alert">{err}</p>}
    <div className="cm-grid2">
    <div className="cm-side-col">
    {!h && !err && <Skeleton label="Carregando avisos…" />}
    {h && <section className="care-card" aria-labelledby="a-real"><h2 id="a-real"><Tile name="bell" />Avisos da sua equipe</h2>
      {h.reminders.length + h.guidance.length ? <ul className="care-list">{h.reminders.map((r, i) => <li key={`r${i}`}>{r.text}{r.date ? ` — ${dateBR(r.date)}` : ''}</li>)}{h.guidance.map((g) => <li key={g.id}>{g.text}</li>)}</ul> : <p>Nenhum aviso no momento.</p>}</section>}
    <section className="cm-alert cm-alert-fever" aria-labelledby="a-fever" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="a-fever"><Tile name="thermo" gold />Temperatura alta registrada (exemplo)</h2><p className="cm-sub">Febre (<span className="cm-fever">37,8 °C ou mais</span>) · hoje às 08:10 (exemplo)</p>
      <p><b>{LOCAL_URGENT_TITLE}</b></p><p>{LOCAL_URGENT_TEXT}</p>
      <div className="care-actions cm-actions-row"><Link className="btn-primary" href="/care/sintoma#temperatura"><Icon name="thermo" />Medir agora</Link><a className="btn-danger" href="tel:192"><Icon name="phone" />Ligar 192</a></div></section>
    <section className="cm-alert" aria-labelledby="a-med" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="a-med"><Tile name="pill" gold />Remédio do horário (exemplo)</h2><p>{MEDICATION_RULE}</p>
      <Link className="btn-secondary cm-inline-btn" href="/care/medicamentos"><Icon name="circleCheck" />Marcar como tomado</Link></section>
    </div>
    <div className="cm-side-col">
    <section className="care-card" aria-labelledby="a-doubt"><h2 id="a-doubt"><Tile name="phone" />Em dúvida?</h2><p>Os alertas são lembretes. <b>Quem avalia é a sua equipe</b> — ligue sempre que se preocupar.</p>
      {phone ? <a className="btn-primary" href={tel(phone)} data-team-call><Icon name="phone" />Ligar para a equipe</a>
        : <><button type="button" className="btn-primary" disabled aria-disabled="true" aria-describedby="a-doubt-soon"><Icon name="phone" />Ligar para a equipe</button><p id="a-doubt-soon" className="cm-soon">Em breve: o telefone do seu serviço ainda não foi cadastrado. Use os canais informados pela sua equipe.</p></>}</section>
    <section className="care-card" aria-labelledby="a-done" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span><h2 id="a-done"><Tile name="circleCheck" />Resolvidos</h2>
      <div className="cm-row"><div><b>Enjoo leve registrado</b><div className="cm-sub">20/10 · equipe viu</div></div><span className="cm-pill">Visto</span></div>
      <div className="cm-row"><div><b>Consulta confirmada</b><div className="cm-sub">19/10</div></div><span className="cm-pill">Ok</span></div></section>
    </div>
    </div>
    <p className="care-note">Em uma emergência, ligue 192 (SAMU).</p>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
