'use client';
// M15.2 — orientação genérica de urgência + contatos configuráveis pela instituição (vazios até a configuração).
import { useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
type H = { emergency: string; contacts: { label: string; phone: string | null; hours: string | null }[]; contactsConfigured: boolean };
export function Help() {
  const [h, setH] = useState<H | null>(null), [err, setErr] = useState('');
  useEffect(() => { care<H>('me/help').then(setH).catch((e) => setErr(e.message)); }, []);
  return <section aria-labelledby="h-title"><h1 id="h-title">Preciso de ajuda</h1>{err && <p role="alert">{err}</p>}
    <section className="care-panel care-urgent" aria-labelledby="h-urg"><h2 id="h-urg">Procure atendimento imediato se tiver</h2>
      <ul className="care-list"><li>Febre (37,8 °C ou mais)</li><li>Falta de ar</li><li>Sangramento</li><li>Não conseguir beber líquidos</li><li>Confusão ou muita sonolência</li></ul>
      <p className="care-lead"><strong>{h?.emergency ?? 'Em caso de emergência, ligue 192 (SAMU).'}</strong></p><a className="btn-danger" href="tel:192">Ligar 192</a></section>
    {h && <section className="care-panel" aria-labelledby="h-cont"><h2 id="h-cont">Contatos do serviço</h2>{h.contactsConfigured ? <ul className="care-list">{h.contacts.map((c) => <li key={c.label}><strong>{c.label}</strong>{c.phone ? <> — <a href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}>{c.phone}</a></> : null}{c.hours ? ` (${c.hours})` : ''}</li>)}</ul> : <p>Os contatos do seu serviço ainda não foram cadastrados. Use os canais informados pela sua equipe.</p>}</section>}
  </section>;
}
