'use client';
// M21 — "Equipe": contatos do serviço vêm de me/help (reais, configurados pela instituição). Os cartões de
// profissionais são EXEMPLOS ESTÁTICOS fictícios (sem backend), rotulados na tela. O app não decide: a equipe avalia.
import { useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
import { Skeleton, TEAM_DECIDES } from './CareShell';
import { Icon, Tile } from './Icons';
import { FICTIONAL_NAME, FICTIONAL_PHONE, STATIC_EXAMPLE } from '../DemoLabels';
import { EMERGENCY_TEXT, WARNING_SIGNS, WARNING_TITLE } from '../../lib/care-guidance';
type H = { emergency: string; contacts: { label: string; phone: string | null; hours: string | null }[]; contactsConfigured: boolean };
const tel = (p: string) => `tel:${p.replace(/[^0-9+]/g, '')}`;
export function Team() {
  const [h, setH] = useState<H | null>(null), [err, setErr] = useState('');
  useEffect(() => { care<H>('me/help').then(setH).catch((e) => setErr(e.message)); }, []);
  const phone = h?.contactsConfigured ? h.contacts.find((c) => c.phone)?.phone ?? null : null;
  const call = (label: string, primary: boolean) => phone
    ? <a className={primary ? 'btn-primary' : 'btn-secondary'} href={tel(phone)} data-team-call><Icon name="phone" />{label}</a>
    : <button type="button" className={primary ? 'btn-primary' : 'btn-secondary'} disabled aria-disabled="true" title="Em breve: telefone do serviço não cadastrado"><Icon name="phone" />{label} (em breve)</button>;
  const msg = (primary: boolean) => <button type="button" className={primary ? 'btn-primary' : 'btn-secondary'} disabled aria-disabled="true" title="Em breve: mensagens pelo app ainda não disponíveis"><Icon name="message" />Enviar mensagem (em breve)</button>;
  return <section aria-labelledby="t-title">
    <div><h1 id="t-title">Precisa de ajuda? Fale com a equipe</h1><p className="care-lead">Escolha com quem falar. Quem avalia e decide é a sua equipe.</p></div>
    {err && <p role="alert">{err}</p>}
    <section className="cm-alert cm-emergency" aria-labelledby="t-emerg"><h2 id="t-emerg"><Tile name="siren" gold />Emergência</h2>
      <p><strong>{EMERGENCY_TEXT}</strong></p><a className="btn-danger cm-inline-btn" href="tel:192"><Icon name="phone" />Ligar 192</a></section>
    <div className="cm-grid3">
    <section className="care-card" aria-labelledby="t-onc" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="t-onc"><Tile name="doctor" />Equipe de oncologia</h2><p className="cm-sub">Dra. Beatriz Exemplo · seg a sex, 8h–18h<br />(00) 0000-0000 · {FICTIONAL_PHONE}</p>
      <div className="care-actions">{call('Ligar agora', true)}{msg(false)}</div></section>
    <section className="care-card" aria-labelledby="t-farm" data-static-demo><span className="cm-static">{STATIC_EXAMPLE}</span>
      <h2 id="t-farm"><Tile name="pill" />Farmacêutica</h2><p className="cm-sub">Farm. Ana Demo · dúvidas sobre remédios ({FICTIONAL_NAME})</p>
      <div className="care-actions">{msg(true)}{call('Ligar', false)}</div></section>
    {!h && !err ? <Skeleton label="Carregando contatos do serviço…" /> : h && <section className="care-card" aria-labelledby="t-serv"><h2 id="t-serv"><Tile name="phone" />Contatos do serviço</h2>
      {h.contactsConfigured ? h.contacts.map((c) => <div className="cm-row" key={c.label}><div><b>{c.label}</b>{c.hours && <div className="cm-sub">{c.hours}</div>}</div>{c.phone && <a className="btn-primary" style={{ width: 'auto' }} href={tel(c.phone)}><Icon name="phone" />{c.phone}</a>}</div>)
        : <p>Os contatos do seu serviço ainda não foram cadastrados. Use os canais informados pela sua equipe.</p>}</section>}
    </div>
    <section className="care-card" aria-labelledby="t-when"><h2 id="t-when"><Tile name="warn" gold />{WARNING_TITLE}</h2>
      <ul className="care-list cm-cols2">{WARNING_SIGNS.map((w) => <li key={w}>{w.startsWith('Febre') ? <>Febre (<span className="cm-fever">37,8 °C ou mais</span>)</> : w}</li>)}</ul></section>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
