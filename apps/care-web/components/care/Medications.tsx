'use client';
// M15.2 — somente leitura + adesão relatada. Nunca exibe dose nem permite alterar a prescrição.
import { useCallback, useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
import { Skeleton, TEAM_DECIDES } from './CareShell';
import { Icon, Tile } from './Icons';
type M = { id: string; name: string; schedule: string; atHome: boolean; today: 'taken' | 'missed' | 'partial' | null };
const LABEL = { taken: 'Tomei', partial: 'Tomei só parte', missed: 'Não tomei' } as const;
// M21 — exemplo estático (sem backend) exibido só quando a equipe ainda não registrou medicamentos.
const DEMO: [string, string, boolean][] = [['Ondansetrona 8 mg', '08:00', true], ['Dexametasona 4 mg', '08:00', true], ['Ondansetrona 8 mg', '12:00', false], ['Omeprazol 20 mg', '14:00', false]];
export function Medications() {
  const [list, setList] = useState<M[] | null>(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const load = useCallback(() => care<{ medications: M[] }>('me/medications').then((r) => setList(r.medications)).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function report(m: M, status: keyof typeof LABEL) { setErr(''); try { await care(`me/medications/${m.id}/adherence`, { method: 'POST', body: { status, requestId: crypto.randomUUID() } }); setMsg(`${m.name}: registrado "${LABEL[status]}" hoje.`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }
  const home = list?.filter((m) => m.atHome) ?? [], done = home.filter((m) => m.today).length;
  return <section aria-labelledby="m-title"><div><h1 id="m-title">Meus medicamentos</h1>
    <p className="care-lead">{list && home.length ? `Remédios de hoje · ${done} de ${home.length} registrados` : 'Remédios de hoje'}</p></div>
    {err && <p role="alert">{err}</p>}{msg && <p role="status">{msg}</p>}
    {!list && !err && <Skeleton label="Carregando seus remédios…" />}
    {list && (list.length ? <ul className="care-med-list">{list.map((m) => <li key={m.id} className="care-card"><h2>{m.atHome ? <span className={m.today ? "cm-chk on" : "cm-chk"} aria-hidden="true">{m.today && <Icon name="check" size={18} />}</span> : <Tile name="pill" />}{m.name}</h2><p className="cm-sub">{m.schedule}</p>
      {m.atHome ? <div role="group" aria-label={`Como foi hoje com ${m.name}?`} className="care-actions">{(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => <button key={k} type="button" className={m.today === k ? 'btn-primary' : 'btn-secondary'} aria-pressed={m.today === k} onClick={() => void report(m, k)}>{LABEL[k]}</button>)}</div> : <p className="care-note">Feito no hospital.</p>}
    </li>)}</ul> : <><p>Nenhum medicamento registrado pela sua equipe.</p>
      <section className="care-card" aria-labelledby="m-demo" data-static-demo><span className="cm-static">Exemplo estático · fictício</span><h2 id="m-demo"><Tile name="pill" />Lista do dia (exemplo)</h2>
        {DEMO.map(([n, t, ok], i) => <div className="cm-row" key={i}><span className={ok ? 'cm-chk on' : 'cm-chk'} aria-hidden="true">{ok && <Icon name="check" size={18} />}</span><div><b>{n}</b><div className="cm-sub">{t} · nome fictício</div></div><span className={ok ? 'cm-pill' : 'cm-pill g'}>{ok ? 'Tomado' : 'Depois'}</span></div>)}</section></>)}
    <section className="cm-alert" aria-labelledby="m-dose"><h2 id="m-dose"><Tile name="warn" gold />Não mude a dose sozinho(a)</h2><p>Siga sempre a orientação da sua equipe. Se tiver dúvida ou esquecer uma dose, fale com a farmacêutica antes.</p>
      <a className="btn-secondary" href="/care/equipe"><Icon name="message" />Falar com a equipe</a></section>
    <p className="cm-note">{TEAM_DECIDES}</p>
  </section>;
}
