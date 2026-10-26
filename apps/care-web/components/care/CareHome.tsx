'use client';
// Início no padrão dos mockups oficiais (21/10): faixa "Estou bem hoje", próxima dose, próxima consulta, resumo de hoje
// e aviso de temperatura. M25: check-in diário real (DailyCheckin → me/checkins/today). Tudo vem das rotas reais (me/home, me/medications, me/temperatures); textos clínicos só das
// fontes aprovadas (care-guidance / care-urgency). O app só organiza e registra: quem avalia e decide é a equipe.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { care, dateBR } from '../../lib/care-client';
import { SIGNATURE, Skeleton, TEAM_DECIDES, useMe } from './CareShell';
import { Icon, Tile } from './Icons';
import { DailyCheckin } from './DailyCheckin';
import { EMERGENCY_TEXT, FEVER_THRESHOLD_LABEL, WARNING_TITLE } from '../../lib/care-guidance';
type Home = { sections: { journey: boolean; medications: boolean; symptoms: boolean }; nextCycle: { number: number; date: string; status: string } | null; reminders: { kind: string; text: string; date?: string }[]; guidance: { id: string; text: string }[] };
type Status = 'taken' | 'missed' | 'partial';
type Med = { id: string; name: string; schedule: string; times: { time: string; today: Status | null }[] | null; atHome: boolean; canReport: boolean; today: Status | null };
type Reading = { id: string; celsius: number; measuredAt: string; fever: boolean };
const today = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
const hourNow = () => Number(new Date().toLocaleString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }));
const greet = () => { const h = hourNow(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const nowHHMM = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
const br = (n: number) => n.toFixed(1).replace('.', ',');
const hhmm = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
// Próxima dose: primeiro horário de hoje ainda sem registro, a partir de agora (ou o primeiro pendente do dia).
function nextDose(meds: Med[]): { med: Med; time: string | null } | null {
  const slots = meds.filter((m) => m.atHome).flatMap((m) => (m.times ? m.times.filter((t) => !t.today).map((t) => ({ med: m, time: t.time as string | null })) : !m.today ? [{ med: m, time: null }] : []));
  if (!slots.length) return null;
  const now = nowHHMM(); const timed = slots.filter((s) => s.time).sort((a, b) => a.time!.localeCompare(b.time!));
  return timed.find((s) => s.time! >= now) ?? timed[0] ?? slots[0];
}
export function CareHome() {
  const { me } = useMe();
  const [h, setH] = useState<Home | null>(null), [meds, setMeds] = useState<Med[] | null>(null), [temps, setTemps] = useState<Reading[] | null>(null);
  const [err, setErr] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const first = me.displayName?.split(' ')[0];
  const canMeds = me.actor === 'patient' || me.scopes.includes('ver_medicamentos');
  const canSymptom = me.actor === 'patient' || me.scopes.includes('registrar_sintoma');
  const loadMeds = useCallback(() => { if (canMeds) care<{ medications: Med[] }>('me/medications').then((r) => setMeds(r.medications)).catch(() => setMeds([])); }, [canMeds]);
  useEffect(() => { care<Home>('me/home').then(setH).catch((e) => setErr(e.message)); loadMeds(); if (canSymptom) care<{ readings: Reading[] }>('me/temperatures').then((r) => setTemps(r.readings)).catch(() => setTemps([])); }, [loadMeds, canSymptom]);
  const nd = meds ? nextDose(meds) : null;
  const doses = (meds ?? []).filter((m) => m.atHome).flatMap((m) => (m.times ? m.times.map((t) => t.today) : [m.today]));
  const lastT = temps && temps.length ? temps[temps.length - 1] : null;
  const recentT = lastT && Date.now() - Date.parse(lastT.measuredAt) < 36 * 3600e3 ? lastT : null;
  async function take() {
    if (!nd) return; setBusy(true); setErr('');
    try { await care(`me/medications/${nd.med.id}/adherence`, { method: 'POST', body: { status: 'taken', requestId: crypto.randomUUID(), ...(nd.time ? { scheduledTime: nd.time } : {}) } }); setMsg(`${nd.med.name}${nd.time ? ` (${nd.time})` : ''}: registrado "Tomei" hoje.`); loadMeds(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  }
  return <>
    <div className="cm-home-head">
      {me.actor === 'caregiver'
        ? <h1>{greet()}{first ? `, ${first}` : ''}! Você acompanha {me.patientName ?? 'um paciente'}.</h1>
        : <h1><span className="cm-desk">{greet()}{first ? `, ${first}` : ''}! Como você está hoje?</span><span className="cm-mob">Olá{first ? `, ${first}` : ''}</span></h1>}
      <p className="care-lead">{today()}</p>
      <p className="care-signature">{SIGNATURE}</p>
    </div>
    {err && <p role="alert">{err}</p>}
    {msg && <p role="status" data-home-msg>{msg}</p>}
    {canSymptom && <section className="cm-hero" aria-labelledby="h-well">
      <Tile name="smile" gold size={30} />
      <div><h2 id="h-well">{me.actor === 'caregiver' ? `${me.patientName ?? 'A pessoa'} está bem hoje` : 'Estou bem hoje'}</h2><p>Toque para enviar o check-in diário à equipe · leva 10 segundos</p></div>
      <DailyCheckin variant="hero" who={me.actor === 'caregiver' ? me.patientName ?? 'a pessoa' : null} />
    </section>}
    {!h && !err && <Skeleton label="Carregando dados do paciente…" />}
    {me.actor === 'caregiver' && h && !h.sections.journey && !h.sections.medications && !h.sections.symptoms && <p className="care-lead" role="status">{me.patientName ?? 'O paciente'} ainda não liberou nenhuma informação para você.</p>}
    {h && <div className="cm-grid3 cm-home-cards">
      {canMeds && <section className="care-card" aria-labelledby="h-dose"><h2 id="h-dose"><Tile name="pill" />Próxima dose</h2>
        {!meds ? <Skeleton label="Carregando remédios…" /> : nd ? <><div className="cm-big" data-next-dose>{nd.time ?? 'Hoje'}</div><p className="cm-name">{nd.med.name}</p><p className="cm-sub">{nd.med.schedule}</p>
          {nd.med.canReport ? <button type="button" className="btn-primary" onClick={() => void take()} disabled={busy}><Icon name="circleCheck" />Marcar como tomada</button> : <p className="cm-sub">Quem registra se tomou é o próprio paciente.</p>}</>
          : <p className="cm-sub">{meds.length ? 'Todos os remédios de hoje já foram registrados.' : 'Nenhum remédio liberado pela sua equipe.'}</p>}</section>}
      {h.sections.journey && <section className="care-card" aria-labelledby="h-next"><h2 id="h-next"><Tile name="calendar" />Próxima consulta</h2>
        {h.nextCycle ? <><div className="cm-big">{h.nextCycle.date.slice(8, 10)}/{h.nextCycle.date.slice(5, 7)}</div><p className="cm-name">{dateBR(h.nextCycle.date)}</p><p className="cm-sub">Ciclo {h.nextCycle.number} · {h.nextCycle.status}</p></> : <p className="cm-sub">Nenhuma sessão agendada no momento.</p>}
        <Link className="btn-secondary" href="/care/jornada"><Icon name="calendar" />Ver detalhes</Link></section>}
      <section className="care-card cm-today" aria-labelledby="h-today"><h2 id="h-today"><Tile name="heartPulse" />Hoje</h2>
        <dl>{canSymptom && <div><dt><Icon name="thermo" size={16} />Temperatura</dt><dd>{lastT && new Date(lastT.measuredAt).toDateString() === new Date().toDateString() ? `${br(lastT.celsius)} °C · ${hhmm(lastT.measuredAt)}` : '—'}</dd></div>}
          {canMeds && <div><dt><Icon name="pill" size={16} />Remédios</dt><dd>{doses.length ? `${doses.filter((d) => d === 'taken' || d === 'partial').length} de ${doses.length} tomados` : '—'}</dd></div>}
          {h.reminders.length > 0 && <div><dt><Icon name="clock" size={16} />Lembretes</dt><dd>{h.reminders.length}</dd></div>}</dl></section>
    </div>}
    {recentT && <section className={recentT.fever ? 'cm-alert cm-home-alert is-fever' : 'cm-alert cm-home-alert'} aria-labelledby="h-temp" data-home-temp>
      <h2 id="h-temp"><Tile name={recentT.fever ? 'warn' : 'bell'} gold />{recentT.fever ? '1 alerta para hoje' : 'Temperatura registrada'}</h2>
      <p>Temperatura {br(recentT.celsius)} °C às {hhmm(recentT.measuredAt)}. Febre: <span className="cm-fever">{FEVER_THRESHOLD_LABEL} ou mais</span>.</p>
      {recentT.fever ? <><p><b>{WARNING_TITLE}:</b> febre. {EMERGENCY_TEXT}</p><a className="btn-danger" href="tel:192"><Icon name="phone" />Ligar 192</a></> : null}
      <Link className="btn-secondary cm-inline-btn" href="/care/sintoma#temperatura"><Icon name="thermo" />Medir e registrar</Link>
    </section>}
    {h && h.guidance.length > 0 && <section className="care-card" aria-labelledby="h-guid"><h2 id="h-guid"><Tile name="doctor" />Orientações da sua equipe</h2><ul className="care-list">{h.guidance.map((g) => <li key={g.id}>{g.text}</li>)}</ul></section>}
    {canSymptom && <section className="care-card cm-mobile-only" aria-labelledby="h-how"><h2 id="h-how"><Tile name="smile" />{me.actor === 'caregiver' ? `Como ${me.patientName ?? 'a pessoa'} está hoje?` : 'Como você está hoje?'}</h2><p className="cm-sub">Leva menos de 1 minuto.</p>
      <DailyCheckin variant="quick" who={me.actor === 'caregiver' ? me.patientName ?? 'a pessoa' : null} /></section>}
    <nav aria-label="Mais opções" className="cm-more">
      {(me.actor === 'patient' || me.scopes.includes('ver_jornada')) && <Link href="/care/jornada"><Tile name="heartPulse" />Minha jornada</Link>}
      <Link href="/care/ajuda"><Tile name="siren" />Preciso de ajuda</Link>
      {me.actor === 'patient' && <Link href="/care/cuidador"><Tile name="family" />Cuidador e privacidade</Link>}
      {me.actor === 'patient' && <Link href="/care/preferencias"><Tile name="user" />Preferências</Link>}
    </nav>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </>;
}
