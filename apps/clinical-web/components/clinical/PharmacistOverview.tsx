'use client';
// M20 — Visão geral do farmacêutico (mockup clinical-visao-geral-farmaceutico): pendências do dia, alertas de febre (>= 37,8 °C),
// o que vence por estabilidade (prazos ilustrativos) e atalho para a conferência com IA. Dados fictícios; IA não decide.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { celsius, work, type Overview } from '../../lib/work-client';
import { useStaff } from './ClinicalShell';

const TZ = 'America/Sao_Paulo';
const hour = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const today = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }).replace('-feira', '');
const greet = () => { const h = Number(new Date().toLocaleString('pt-BR', { hour: '2-digit', hour12: false, timeZone: TZ })); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const LEVEL: Record<string, string> = { critico: 'chip c-err', atencao: 'chip c-warn', ok: 'chip c-ok' };
const pl = (n: number, a: string, b: string) => (n === 1 ? a : b);

export function PharmacistOverview() {
  const me = useStaff();
  const [d, setD] = useState<Overview | null>(null), [err, setErr] = useState('');
  const load = useCallback(async () => { setErr(''); try { setD(await work<Overview>('overview')); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const p = d?.pending;
  const stats: [number | undefined, string, string][] = [
    [p?.prescriptionChecks, 'conferências de prescrição', ''], [p?.openAlerts, 'alertas clínicos a revisar', 'n-err'],
    [p?.awaitingPhysician, 'pedidos aguardando médico', 'n-warn'], [p?.openTasks, 'tarefas abertas da farmácia', ''],
    [p?.fever, 'alertas de febre', 'n-err'], [p?.expiringSoon, 'preparos vencendo < 6 h', 'n-warn']];
  return <section className="vg" aria-labelledby="vg-titulo">
    <img className="vg-watermark" src="/brand/clinical.svg" alt="" aria-hidden="true" />
    <div className="vg-sub">
      <div><p className="vg-crumb">Clinical › Visão geral do farmacêutico</p>
        <h1 id="vg-titulo">{greet()}, {me.name ?? me.roleLabel} — {today()}</h1></div>
      <p className="vg-sync">{d?.lastSync ? <>Última sincronização {d.lastSync.source} (fictício): <b>{hour(d.lastSync.at)} (BRT)</b></> : 'Sem sincronização hospitalar registrada ainda.'}<br />
        <span className="vg-demo-inline">Dados fictícios · demonstração não clínica</span></p>
    </div>
    {err && <p role="alert" className="clin-error">{err} <button className="btn-secondary" onClick={() => void load()}>Tentar de novo</button></p>}
    <Link className="vg-short" href="/clinical/conferencia-ia" data-testid="atalho-conferencia-ia">
      <span className="vg-ic" aria-hidden="true">🤖</span>
      <span><b>Abrir conferência com IA</b><small>Atalho direto · /clinical/conferencia-ia · abre a fila sem passar pelo menu</small></span>
      <span className="vg-badge">{d ? `${d.aiConference.pending} ${pl(d.aiConference.pending, 'pendente', 'pendentes')}` : '…'}</span>
      <span className="vg-go">Abrir →</span>
    </Link>
    <section className="vg-card" aria-labelledby="vg-pend">
      <h2 id="vg-pend"><span aria-hidden="true">📋</span> Pendências do dia <span className="tag t-gold">{p ? `${p.total} no total` : '…'}</span></h2>
      <ul className="vg-stats">{stats.map(([n, label, cls]) => <li key={label} className="vg-stat"><b className={cls}>{n ?? '–'}</b><span>{label}</span></li>)}</ul>
    </section>
    <div className="vg-row">
      <section className="vg-card vg-fever" aria-labelledby="vg-febre">
        <h2 id="vg-febre"><span aria-hidden="true">🌡</span> Alertas de febre <span className="tag t-err">{d ? `${d.fever.length} ${pl(d.fever.length, 'ativo', 'ativos')}` : '…'}</span></h2>
        {d && (d.fever.length === 0 ? <p className="clin-empty" role="status">Nenhum paciente vinculado com temperatura ≥ 37,8 °C na última medida.</p>
          : <table className="vg-t"><thead><tr><th scope="col">Paciente</th><th scope="col">Leito</th><th scope="col">Temp.</th><th scope="col">Hora (BRT)</th></tr></thead>
            <tbody>{d.fever.map((f) => <tr key={f.patientId}>
              <td><Link href={`/clinical/pacientes/${f.patientId}`}><b>{f.name}</b></Link><br /><small>{f.record ?? 'Sem prontuário'}</small></td>
              <td>{f.place}</td><td><b className="n-err">{celsius(f.celsius)}</b></td><td>{hour(f.measuredAt)}</td></tr>)}</tbody></table>)}
        <p className="vg-note">Limiar de febre: {d ? celsius(d.feverThresholdC) : '37,8 °C'}. Conduta clínica definida pela equipe médica.</p>
      </section>
      <section className="vg-card" aria-labelledby="vg-vence">
        <h2 id="vg-vence"><span aria-hidden="true">⏳</span> O que vence <span className="tag t-gold">por estabilidade</span><span className="vg-ill">{d?.stabilityNotice ?? 'Prazos ilustrativos — conferir na bula do fabricante'}</span></h2>
        {d && (d.expiring.length === 0 ? <p className="clin-empty" role="status">Nenhum preparo aguardando liberação.</p>
          : <table className="vg-t"><thead><tr><th scope="col">Bolsa / preparo</th><th scope="col">Tempo de estabilidade usado</th><th scope="col">Restante</th></tr></thead>
            <tbody>{d.expiring.map((x) => <tr key={x.id}>
              <td><b>{x.medication} · {x.container}</b><br /><small>{x.patient} · {x.place}</small></td>
              <td className="vg-barcell"><div className="vg-bar" role="meter" aria-valuenow={x.usedPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${x.usedPercent}% da estabilidade usada`}><div className={`vg-fill f-${x.level}`} style={{ width: `${x.usedPercent}%` }} /></div></td>
              <td><span className={LEVEL[x.level]}>{x.remaining}</span></td></tr>)}</tbody></table>)}
      </section>
    </div>
    <aside className="vg-ai" aria-label="IA não decide"><p className="vg-ai-h"><span aria-hidden="true">✨</span> Conferência com IA · rascunho <span className="tag t-gold">rascunho</span></p>
      <p>A IA só gera rascunhos de conferência a partir de dados fictícios. <b>🛡 IA não decide — revisão e decisão são do farmacêutico e da equipe médica.</b></p></aside>
  </section>;
}
