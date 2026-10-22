'use client';
// M15.2 — orientação genérica de urgência + contatos configuráveis pela instituição (vazios até a configuração).
import { useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
import { EMERGENCY_TEXT, WARNING_SIGNS, WARNING_TITLE } from '../../lib/care-guidance';
type H = { emergency: string; contacts: { label: string; phone: string | null; hours: string | null }[]; contactsConfigured: boolean };
export function Help() {
  const [h, setH] = useState<H | null>(null), [err, setErr] = useState('');
  useEffect(() => { care<H>('me/help').then(setH).catch((e) => setErr(e.message)); }, []);
  return <section aria-labelledby="h-title"><h1 id="h-title">Preciso de ajuda</h1>{err && <p role="alert">{err}</p>}
    <section className="care-panel care-urgent" aria-labelledby="h-urg"><h2 id="h-urg">{WARNING_TITLE}</h2>
      <ul className="care-list">{WARNING_SIGNS.map((w) => <li key={w}>{w}</li>)}</ul>
      <p className="care-lead"><strong>{h?.emergency ?? EMERGENCY_TEXT}</strong></p><a className="btn-danger" href="tel:192">Ligar 192</a></section>
    {h && <section className="care-panel" aria-labelledby="h-cont"><h2 id="h-cont">Contatos do serviço</h2>{h.contactsConfigured ? <ul className="care-list">{h.contacts.map((c) => <li key={c.label}><strong>{c.label}</strong>{c.phone ? <> — <a href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}>{c.phone}</a></> : null}{c.hours ? ` (${c.hours})` : ''}</li>)}</ul> : <p>Os contatos do seu serviço ainda não foram cadastrados. Use os canais informados pela sua equipe.</p>}</section>}
  </section>;
}
