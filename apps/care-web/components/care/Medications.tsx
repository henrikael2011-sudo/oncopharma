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
  return <div role="group" aria-label={`Como foi ${time ? `às ${time}` : 'hoje'} com ${m.name}?`} className="care-actions">{(Object.keys(LABEL) as Status[]).map((k) => <button key={k} type="button" className={value === k ? 'btn-primary' : 'btn-secondary'} aria-pressed={value === k} onClick={() => onPick(m, k, time)}>{LABEL[k]}</button>)}</div>;
}
export function Medications() {
  const { me } = useMe();
  const [list, setList] = useState<M[] | null>(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const load = useCallback(() => care<{ medications: M[] }>('me/medications').then((r) => setList(r.medications)).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function report(m: M, status: Status, time: string | null) { setErr(''); try { await care(`me/medications/${m.id}/adherence`, { method: 'POST', body: { status, requestId: crypto.randomUUID(), ...(time ? { scheduledTime: time } : {}) } }); setMsg(`${m.name}${time ? ` (${time})` : ''}: registrado "${LABEL[status]}" hoje.`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }
  const doses = (list ?? []).filter((m) => m.atHome).flatMap((m) => m.times ? m.times.map((t) => t.today) : [m.today]);
  return <section aria-labelledby="m-title"><div><h1 id="m-title">{me.actor === 'caregiver' ? `Remédios de ${me.patientName ?? 'quem você acompanha'}` : 'Meus medicamentos'}</h1>
    <p className="care-lead">{list && doses.length ? `Remédios de hoje · ${doses.filter(Boolean).length} de ${doses.length} registrados` : 'Remédios de hoje'}</p></div>
    {err && <p role="alert">{err}</p>}{msg && <p role="status">{msg}</p>}
    {!list && !err && <Skeleton label="Carregando seus remédios…" />}
    {list && (list.length ? <ul className="care-med-list">{list.map((m) => <li key={m.id} className="care-card" data-med={m.name}>
      <h2><Tile name="pill" />{m.name}</h2>
      {m.instructions && <p className="cm-sub" data-med-instructions>{m.instructions}</p>}
      {!m.atHome ? <><p className="cm-sub">{m.schedule}</p><p className="care-note">Feito no hospital.</p></>
        : m.times ? m.times.map((t) => <div key={t.time} className="cm-dose" data-dose={t.time}>
            <div className="cm-row"><span className={t.today ? 'cm-chk on' : 'cm-chk'} aria-hidden="true">{t.today && <Icon name="check" size={18} />}</span><div><b className="cm-dose-time">{t.time}</b></div><span className={t.today ? 'cm-pill' : 'cm-pill g'}>{t.today ? DONE[t.today] : 'A registrar'}</span></div>
            {m.canReport && <Choices m={m} time={t.time} value={t.today} onPick={(a, b, c) => void report(a, b, c)} />}</div>)
        : <><p className="cm-sub">{m.schedule}</p>{m.canReport ? <Choices m={m} time={null} value={m.today} onPick={(a, b, c) => void report(a, b, c)} /> : <p className="cm-sub">Hoje: {m.today ? DONE[m.today] : 'ainda não registrado'}</p>}</>}
    </li>)}</ul> : <p>Nenhum medicamento liberado pela sua equipe.</p>)}
    {me.actor === 'caregiver' && <p className="care-note">Quem registra se tomou é o próprio paciente.</p>}
    <section className="cm-alert" aria-labelledby="m-dose"><h2 id="m-dose"><Tile name="warn" gold />Orientação</h2><p>{MEDICATION_RULE}</p>
      <a className="btn-secondary" href="/care/equipe"><Icon name="message" />Falar com a equipe</a></section>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
