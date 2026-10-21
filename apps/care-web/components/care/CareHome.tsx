'use client';
// M21 — Início no padrão Care mobile aprovado: dados reais de me/home; atalhos para as demais funções existentes.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { care, dateBR } from '../../lib/care-client';
import { SIGNATURE, Skeleton, TEAM_DECIDES, useMe } from './CareShell';
import { Icon, Tile } from './Icons';
type Home = { sections: { journey: boolean; medications: boolean; symptoms: boolean }; nextCycle: { number: number; date: string; status: string } | null; reminders: { kind: string; text: string; date?: string }[]; guidance: { id: string; text: string }[] };
const today = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
export function CareHome() {
  const { me } = useMe(); const [h, setH] = useState<Home | null>(null); const [err, setErr] = useState('');
  useEffect(() => { care<Home>('me/home').then(setH).catch((e) => setErr(e.message)); }, []);
  const first = me.displayName?.split(' ')[0];
  const canSymptom = me.actor === 'patient' || !!h?.sections.symptoms;
  return <>
    <div>
      <p className="kicker">ONCOPHARMA Care</p>
      {me.actor === 'caregiver'
        ? <h1>{first ? `Olá, ${first}.` : 'Olá.'} Você acompanha {me.patientName ?? 'um paciente'}.</h1>
        : <h1>{first ? `Olá, ${first}.` : 'Olá.'} Como você está hoje?</h1>}
      <p className="care-lead">{today()} · dados fictícios</p>
      <p className="care-signature">{SIGNATURE}</p>
    </div>
    {err && <p role="alert">{err}</p>}
    {!h && !err && <Skeleton label="Carregando dados do paciente…" />}
    {me.actor === 'caregiver' && h && !h.sections.journey && !h.sections.medications && !h.sections.symptoms && <p className="care-lead" role="status">{me.patientName ?? 'O paciente'} ainda não liberou nenhuma informação para você.</p>}
    {h && canSymptom && <section className="care-card" aria-labelledby="h-today"><h2 id="h-today"><Tile name="smile" />{me.actor === 'caregiver' ? `Como ${me.patientName ?? 'a pessoa'} está hoje?` : 'Como você está hoje?'}</h2><p className="cm-sub">Leva menos de 1 minuto. A equipe acompanha.</p>
      <div className="care-actions"><Link className="btn-primary btn-large" href="/care/sintoma"><Icon name="notebook" />{me.actor === 'caregiver' ? `Registrar sintoma de ${me.patientName ?? 'quem eu acompanho'}` : 'Registrar como estou'}</Link></div></section>}
    {h && <div className="care-cards">
      {h.sections.journey && <section className="care-card" aria-labelledby="h-next"><h2 id="h-next"><Tile name="calendar" />Próxima sessão</h2>{h.nextCycle ? <><div className="cm-big">{dateBR(h.nextCycle.date)}</div><p className="cm-sub">Ciclo {h.nextCycle.number} · {h.nextCycle.status}</p></> : <p>Nenhuma sessão agendada no momento.</p>}</section>}
      {(h.sections.journey || h.sections.medications) && <section className="care-card" aria-labelledby="h-rem"><h2 id="h-rem"><Tile name="clock" />Lembretes</h2>{h.reminders.length ? <ul className="care-list">{h.reminders.map((r, i) => <li key={i}>{r.text}{r.date ? ` — ${dateBR(r.date)}` : ''}</li>)}</ul> : <p>Sem lembretes por enquanto.</p>}</section>}
      {h.guidance.length > 0 && <section className="care-card" aria-labelledby="h-guid"><h2 id="h-guid"><Tile name="doctor" />Orientações da sua equipe</h2><ul className="care-list">{h.guidance.map((g) => <li key={g.id}>{g.text}</li>)}</ul></section>}
    </div>}
    <nav aria-label="Mais opções" className="cm-more">
      {(me.actor === 'patient' || me.scopes.includes('ver_jornada')) && <Link href="/care/jornada"><Tile name="heartPulse" />Minha jornada</Link>}
      <Link href="/care/ajuda"><Tile name="siren" />Preciso de ajuda</Link>
      {me.actor === 'patient' && <Link href="/care/cuidador"><Tile name="family" />Cuidador e privacidade</Link>}
      {me.actor === 'patient' && <Link href="/care/preferencias"><Tile name="user" />Preferências</Link>}
    </nav>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </>;
}
