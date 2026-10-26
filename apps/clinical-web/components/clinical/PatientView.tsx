'use client';
// M15.4 — paciente aberto: dados carregados SOB DEMANDA por aba (cada leitura auditada na API).
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { roomLabel, work, type PatientData } from '../../lib/work-client';
import { AlertsTab } from './AlertsTab';
import { TasksTab } from './TasksTab';
import { PreCycleTab } from './PreCycleTab';
import { TimelineTab } from './TimelineTab';
import { RecordTab, MEDICATION_KEYS, LAB_KEYS } from './RecordTab';
import { MedicalRequestList } from './MedicalRequests';
import { AllocationPanel } from './AllocationPanel';
import { MedTranscriptionTab } from './MedTranscriptionTab';
import { ClinIcon, ClinTile } from './ClinIcons';
import { CareContactTab } from './CareContactTab';

const TABS = [['visao', 'Visão geral'], ['alertas', 'Alertas'], ['tarefas', 'Tarefas'], ['preciclo', 'Pré-ciclo'], ['linha', 'Linha do tempo'], ['prontuario', 'Prontuário'], ['medicamentos', 'Medicamentos'], ['exame', 'Exame'], ['solicitacoes', 'Solicitações médicas'], ['transcricao', 'Transcrição de medicamentos'], ['contato', 'Check-in e mensagens']] as const;
type Tab = (typeof TABS)[number][0];
export function PatientView({ id }: { id: string }) {
  const [d, setD] = useState<PatientData | null>(null), [err, setErr] = useState(''), [tab, setTab] = useState<Tab>('alertas'), [ask, setAsk] = useState(0);
  const load = useCallback(async () => { try { setD(await work<PatientData>(`patients/${id}`)); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('aba') === 'contato') setTab('contato'); }, []); // M25: vindo da caixa de mensagens
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : -1;
    if (n >= 0) { e.preventDefault(); setTab(TABS[n][0]); document.getElementById(`tab-${TABS[n][0]}`)?.focus(); }
  };
  if (err) return <section className="clin-card" role="alert"><h1>Paciente indisponível</h1><p>{err}</p><Link href="/clinical/pacientes">Voltar para a lista de pacientes</Link></section>;
  if (!d) return <p role="status">Carregando paciente…</p>;
  const openAlerts = d.alerts.filter((a) => !a.final).length, openTasks = d.tasks.filter((t) => t.status === 'open' || t.status === 'received').length;
  const cur = d.allocation.current, urgent = d.alerts.some((a) => !a.final && a.level === 'urgent_review');
  // Faixa do paciente do mockup v3h: só campos existentes (nome, prontuário, alocação). nascimento, superfície corporal e protocolo não vêm da API (não exibidos).
  const strip: [string, string][] = [['Paciente', d.patient.name], ['Prontuário', d.patient.record ?? 'Sem prontuário'], ['Unidade', cur ? [cur.unit, cur.floor].filter(Boolean).join(' · ') : 'Sem alocação'], ['Leito', cur ? roomLabel(cur) || '—' : '—']];
  return <article aria-labelledby="pac-nome" className="cv-pv">
    <dl className="cv-pstrip">{strip.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <nav aria-label="Navegação" className="vg-crumb"><Link href="/clinical/pacientes" className="clin-back">Lista de pacientes</Link>{cur && <> › {cur.floor ?? cur.unit}{cur.room ? ` › ${roomLabel(cur)}` : ''}</>}</nav>
    <header className="pac-header cv-head"><div><p className="cv-kicker">Detalhe do paciente</p><h1 id="pac-nome">{d.patient.name}</h1><p>{d.patient.record ? `Prontuário ${d.patient.record}` : 'Sem prontuário'} · {openAlerts} {openAlerts === 1 ? 'alerta aberto' : 'alertas abertos'} · {openTasks} {openTasks === 1 ? 'tarefa aberta' : 'tarefas abertas'}</p></div>
      <div className="cv-head-act">{openAlerts > 0 && <span className={urgent ? 'sev sev-urgent' : 'sev sev-review'}><ClinIcon name={urgent ? 'siren' : 'warn'} />{urgent ? 'Alerta' : 'Atenção'}</span>}
        <button type="button" className="btn-secondary cv-btn-outline" onClick={() => { setTab('solicitacoes'); setAsk((n) => n + 1); }}><ClinIcon name="mail" />Pedir alteração ao médico</button></div></header>
    <AllocationPanel id={id} data={d.allocation} onChange={load} />
    <div role="tablist" aria-label="Informações do paciente" className="tabs">
      {TABS.map(([k, label], i) => <button key={k} id={`tab-${k}`} role="tab" type="button" aria-selected={tab === k} aria-controls={`painel-${k}`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} onKeyDown={(e) => onKey(e, i)}>{label}</button>)}
    </div>
    <section id={`painel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel" tabIndex={0}>
      {tab === 'alertas' && <AlertsTab data={d} reload={load} />}
      {tab === 'tarefas' && <TasksTab data={d} reload={load} />}
      {tab === 'preciclo' && <PreCycleTab id={id} />}
      {tab === 'linha' && <TimelineTab id={id} />}
      {tab === 'solicitacoes' && <MedicalRequestList key={ask} patientId={id} startOpen={ask > 0} />}
      {tab === 'transcricao' && <MedTranscriptionTab patientId={id} />}
      {tab === 'contato' && <CareContactTab patientId={id} />}
      {tab === 'prontuario' && <RecordTab id={id} />}
      {tab === 'medicamentos' && <RecordTab id={id} only={MEDICATION_KEYS} />}
      {tab === 'exame' && <RecordTab id={id} only={LAB_KEYS} />}
      {tab === 'visao' && <div className="clin-overview">
        <section className={`clin-card cv-alerts${urgent ? ' is-urgent' : ''}`} aria-labelledby="vg-pend"><h2 id="vg-pend"><ClinTile name="siren" gold />Alertas ativos <span className="cv-count">{openAlerts}</span></h2><p>{openAlerts} {openAlerts === 1 ? 'alerta aberto' : 'alertas abertos'} · {openTasks} {openTasks === 1 ? 'tarefa aberta' : 'tarefas abertas'}</p>
          {d.alerts.filter((a) => !a.final).slice(0, 3).map((a) => <p key={a.id}><span className={a.level === 'urgent_review' ? 'sev sev-urgent' : 'sev sev-review'}>{a.level === 'urgent_review' ? 'Urgente' : 'Revisão'}</span> {a.description ?? a.code} · {a.statusLabel}</p>)}
          <button type="button" className="btn-secondary" onClick={() => setTab('alertas')}>Ver alertas</button></section>
        <section className="clin-card" aria-labelledby="vg-pront"><h2 id="vg-pront"><ClinTile name="clip" />Prontuário (resumo)</h2><RecordTab id={id} summary /></section>
      </div>}
    </section>
  </article>;
}
