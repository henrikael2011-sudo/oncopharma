'use client';
// M21 — "Equipe": contatos do serviço vêm de me/help (reais, configurados pela instituição). Os cartões de
// profissionais são EXEMPLOS ESTÁTICOS fictícios (sem backend), rotulados na tela. O app não decide: a equipe avalia.
import { useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
import { Skeleton, TEAM_DECIDES } from './CareShell';
import { Icon, Tile } from './Icons';
import { DEMO_ONLY, FICTIONAL_NAME, FICTIONAL_PHONE, STATIC_EXAMPLE } from '../DemoLabels';
import { EMERGENCY_TEXT, WARNING_SIGNS, WARNING_TITLE } from '../../lib/care-guidance';
type H = { emergency: string; contacts: { label: string; phone: string | null; hours: string | null }[]; contactsConfigured: boolean };
const tel = (p: string) => `tel:${p.replace(/[^0-9+]/g, '')}`;
export function Team() {
  const [h, setH] = useState<H | null>(null), [err, setErr] = useState('');
  useEffect(() => { care<H>('me/help').then(setH).catch((e) => setErr(e.message)); }, []);
  return <section aria-labelledby="t-title">
    <div><h1 id="t-title">Falar com a equipe</h1><p className="care-lead">Escolha com quem falar. Quem avalia e decide é a sua equipe.</p></div>
    {err && <p role="alert">{err}</p>}
    {!h && !err && <Skeleton label="Carregando contatos do serviço…" />}
    {h && <section className="care-card" aria-labelledby="t-serv"><h2 id="t-serv"><Tile name="phone" />Contatos do serviço</h2>
      {h.contactsConfigured ? h.contacts.map((c) => <div className="cm-row" key={c.label}><div><b>{c.label}</b>{c.hours && <div className="cm-sub">{c.hours}</div>}</div>{c.phone && <a className="btn-primary" style={{ width: 'auto' }} href={tel(c.phone)}><Icon name="phone" />{c.phone}</a>}</div>)
        : <p>Os contatos do seu serviço ainda não foram cadastrados. Use os canais informados pela sua equipe.</p>}</section>}
    <section className="care-card" aria-labelledby="t-onc" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="t-onc"><Tile name="doctor" />Equipe de oncologia</h2><p className="cm-sub">Dra. Beatriz Exemplo · seg a sex, 8h–18h<br />(00) 0000-0000 · {FICTIONAL_PHONE}</p>
      <div className="care-actions"><button type="button" className="btn-primary" disabled aria-disabled="true"><Icon name="phone" />Ligar para a equipe ({DEMO_ONLY})</button><button type="button" className="btn-secondary" disabled aria-disabled="true"><Icon name="message" />Enviar mensagem (em breve)</button></div></section>
    <section className="care-card" aria-labelledby="t-farm" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="t-farm"><Tile name="pill" />Farmacêutica</h2><p className="cm-sub">Farm. Ana Demo · dúvidas sobre remédios</p>
      <div className="care-actions"><button type="button" className="btn-secondary" disabled aria-disabled="true"><Icon name="message" />Enviar mensagem (em breve)</button></div></section>
    <section className="care-card" aria-labelledby="t-when"><h2 id="t-when"><Tile name="warn" gold />{WARNING_TITLE}</h2>
      <ul className="care-list">{WARNING_SIGNS.map((w) => <li key={w}>{w.startsWith('Febre') ? <>Febre (<span className="cm-fever">37,8 °C ou mais</span>)</> : w}</li>)}</ul>
      <p><strong>{EMERGENCY_TEXT}</strong></p><a className="btn-danger" href="tel:192"><Icon name="phone" />Ligar 192</a></section>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
