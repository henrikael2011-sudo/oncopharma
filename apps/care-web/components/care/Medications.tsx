'use client';
// M15.2 — somente leitura + adesão relatada. Nunca exibe dose nem permite alterar a prescrição.
// M22 — itens transcritos pela equipe aparecem só depois da liberação da farmácia, com os horários do dia e as
// orientações da equipe; "Tomei / Tomei só parte / Não tomei" é registrado POR HORÁRIO. Cuidador só visualiza.
import { useCallback, useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
import { Skeleton, TEAM_DECIDES, useMe } from './CareShell';
import { Icon, Tile } from './Icons';
import { MEDICATION_RULE } from '../../lib/care-guidance';
type Status = 'taken' | 'missed' | 'partial';
type M = { id: string; name: string; schedule: string; times: { time: string; today: Status | null }[] | null; instructions: string | null; atHome: boolean; canReport: boolean; today: Status | null };
const LABEL = { taken: 'Tomei', partial: 'Tomei só parte', missed: 'Não tomei' } as const;
const DONE = { taken: 'Tomado', partial: 'Tomado em parte', missed: 'Não tomado' } as const;
function Choices({ m, time, value, onPick }: { m: M; time: string | null; value: Status | null; onPick: (m: M, s: Status, t: string | null) => void }) {
  const [open, setOpen] = useState(false);
  if (value && !open) return <button type="button" className="cm-link" onClick={() => setOpen(true)} aria-label={`Alterar registro${time ? ` das ${time}` : ''} de ${m.name}`}>Alterar</button>;
  return <div role="group" aria-label={`Como foi ${time ? `às ${time}` : 'hoje'} com ${m.name}?`} className="cm-choices">{(Object.keys(LABEL) as Status[]).map((k) => <button key={k} type="button" className={value === k ? 'btn-primary' : 'btn-secondary'} aria-pressed={value === k} onClick={() => { setOpen(false); onPick(m, k, time); }}>{LABEL[k]}</button>)}</div>;
}
export function Medications() {
  const { me } = useMe();
  const [list, setList] = useState<M[] | null>(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const load = useCallback(() => care<{ medications: M[] }>('me/medications').then((r) => setList(r.medications)).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function report(m: M, status: Status, time: string | null) { setErr(''); try { await care(`me/medications/${m.id}/adherence`, { method: 'POST', body: { status, requestId: crypto.randomUUID(), ...(time ? { scheduledTime: time } : {}) } }); setMsg(`${m.name}${time ? ` (${time})` : ''}: registrado "${LABEL[status]}" hoje.`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }
  // Contador do dia: conta só doses com horário liberado; prescrições antigas sem horário entram apenas se não houver nenhuma com horário.
  const home = (list ?? []).filter((m) => m.atHome), timed = home.filter((m) => m.times);
  const doses = timed.length ? timed.flatMap((m) => m.times!.map((t) => t.today)) : home.map((m) => m.today);
  const taken = doses.filter((d) => d === 'taken' || d === 'partial').length;
  // Lista do dia por horário (mockup "Lista de hoje"): uma linha por dose com horário; sem horário, uma linha por remédio.
  const rows = home.flatMap((m) => (m.times ? m.times.map((t) => ({ m, time: t.time as string | null, today: t.today })) : [{ m, time: null as string | null, today: m.today }])).sort((x, y) => (x.time ?? '99').localeCompare(y.time ?? '99'));
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
  const pending = rows.filter((r) => !r.today), next = pending.find((r) => r.time && r.time >= now) ?? pending[0];
  const dayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  return <section aria-labelledby="m-title"><div className="cm-title-row"><h1 id="m-title">{me.actor === 'caregiver' ? `Remédios de ${me.patientName ?? 'quem você acompanha'}` : 'Seus remédios de hoje'}</h1>
    {list && doses.length > 0 && <p className="cm-counter" data-med-counter><b>{taken} de {doses.length}</b><span>tomados até agora</span></p>}</div>
    <p className="care-lead cm-mobile-lead">{list && doses.length ? `Remédios de hoje · ${doses.filter(Boolean).length} de ${doses.length} registrados` : 'Remédios de hoje'}</p>
    {err && <p role="alert">{err}</p>}{msg && <p role="status">{msg}</p>}
    {!list && !err && <Skeleton label="Carregando seus remédios…" />}
    {list && <div className="cm-grid2">
      <section className="care-card" aria-labelledby="m-list"><h2 id="m-list"><Tile name="pill" />Lista de hoje · {dayLabel}</h2>
        {rows.length ? <ul className="cm-med-rows">{rows.map((r) => <li key={`${r.m.id}-${r.time ?? 'dia'}`} className="cm-med-row" data-med={r.m.name} data-dose={r.time ?? undefined}>
          <b className="cm-dose-time">{r.time ?? 'Hoje'}</b>
          <div className="cm-med-main"><b>{r.m.name}</b>{r.m.instructions ? <span className="cm-sub" data-med-instructions>{r.m.instructions}</span> : !r.time && <span className="cm-sub">{r.m.schedule}</span>}</div>
          <span className={r.today ? 'cm-pill' : 'cm-pill g'}>{r.today ? DONE[r.today] : 'Pendente'}</span>
          <span className={r.today ? 'cm-chk on' : 'cm-chk'} aria-hidden="true">{r.today && <Icon name="check" size={18} />}</span>
          {r.m.canReport && <div className="cm-med-act"><Choices m={r.m} time={r.time} value={r.today} onPick={(a, b, c) => void report(a, b, c)} /></div>}
        </li>)}</ul> : <p>Nenhum medicamento liberado pela sua equipe.</p>}
        {list.filter((m) => !m.atHome).map((m) => <p key={m.id} className="cm-sub" data-med={m.name}><b>{m.name}</b> · {m.schedule} · Feito no hospital.</p>)}
      </section>
      <div className="cm-side-col">
        {next && <section className="cm-alert" aria-labelledby="m-next"><h2 id="m-next"><Tile name="clock" gold />Próximo horário: {next.time ?? 'hoje'}</h2><p className="cm-sub">{next.m.name}</p>
          {next.m.canReport && <button type="button" className="btn-primary" onClick={() => void report(next.m, 'taken', next.time)}><Icon name="circleCheck" />Marcar como tomada</button>}</section>}
        <section className="care-card" aria-labelledby="m-dose"><h2 id="m-dose"><Tile name="message" />Dúvida sobre um remédio?</h2><p>{MEDICATION_RULE}</p>
          <a className="btn-secondary" href="/care/equipe"><Icon name="phone" />Falar com a equipe</a></section>
      </div>
    </div>}
    {me.actor === 'caregiver' && <p className="care-note">Quem registra se tomou é o próprio paciente.</p>}
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
