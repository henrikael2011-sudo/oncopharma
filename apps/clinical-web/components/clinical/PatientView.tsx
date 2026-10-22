'use client';
// M15.4 — paciente aberto: dados carregados SOB DEMANDA por aba (cada leitura auditada na API).
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { work, type PatientData } from '../../lib/work-client';
import { AlertsTab } from './AlertsTab';
import { TasksTab } from './TasksTab';
import { PreCycleTab } from './PreCycleTab';
import { TimelineTab } from './TimelineTab';
import { RecordTab, MEDICATION_KEYS, LAB_KEYS } from './RecordTab';
import { MedicalRequestList } from './MedicalRequests';
import { AllocationPanel } from './AllocationPanel';
import { MedTranscriptionTab } from './MedTranscriptionTab';

const TABS = [['visao', 'Visão geral'], ['alertas', 'Alertas'], ['tarefas', 'Tarefas'], ['preciclo', 'Pré-ciclo'], ['linha', 'Linha do tempo'], ['prontuario', 'Prontuário'], ['medicamentos', 'Medicamentos'], ['exame', 'Exame'], ['solicitacoes', 'Solicitações médicas'], ['transcricao', 'Transcrição de medicamentos']] as const;
type Tab = (typeof TABS)[number][0];
export function PatientView({ id }: { id: string }) {
  const [d, setD] = useState<PatientData | null>(null), [err, setErr] = useState(''), [tab, setTab] = useState<Tab>('alertas');
  const load = useCallback(async () => { try { setD(await work<PatientData>(`patients/${id}`)); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : -1;
    if (n >= 0) { e.preventDefault(); setTab(TABS[n][0]); document.getElementById(`tab-${TABS[n][0]}`)?.focus(); }
  };
  if (err) return <section className="clin-card" role="alert"><h1>Paciente indisponível</h1><p>{err}</p><Link href="/clinical">Voltar para a lista de pacientes</Link></section>;
  if (!d) return <p role="status">Carregando paciente…</p>;
  const openAlerts = d.alerts.filter((a) => !a.final).length, openTasks = d.tasks.filter((t) => t.status === 'open' || t.status === 'received').length;
  return <article aria-labelledby="pac-nome">
    <nav aria-label="Navegação"><Link href="/clinical" className="clin-back">Lista de pacientes</Link></nav>
    <header className="pac-header"><h1 id="pac-nome">{d.patient.name}</h1><p>{d.patient.record ? `Prontuário ${d.patient.record}` : 'Sem prontuário'} · {openAlerts} {openAlerts === 1 ? 'alerta aberto' : 'alertas abertos'} · {openTasks} {openTasks === 1 ? 'tarefa aberta' : 'tarefas abertas'}</p></header>
    <AllocationPanel id={id} data={d.allocation} onChange={load} />
    <div role="tablist" aria-label="Informações do paciente" className="tabs">
      {TABS.map(([k, label], i) => <button key={k} id={`tab-${k}`} role="tab" type="button" aria-selected={tab === k} aria-controls={`painel-${k}`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} onKeyDown={(e) => onKey(e, i)}>{label}</button>)}
    </div>
    <section id={`painel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel" tabIndex={0}>
      {tab === 'alertas' && <AlertsTab data={d} reload={load} />}
      {tab === 'tarefas' && <TasksTab data={d} reload={load} />}
      {tab === 'preciclo' && <PreCycleTab id={id} />}
      {tab === 'linha' && <TimelineTab id={id} />}
      {tab === 'solicitacoes' && <MedicalRequestList patientId={id} />}
      {tab === 'transcricao' && <MedTranscriptionTab patientId={id} />}
      {tab === 'prontuario' && <RecordTab id={id} />}
      {tab === 'medicamentos' && <RecordTab id={id} only={MEDICATION_KEYS} />}
      {tab === 'exame' && <RecordTab id={id} only={LAB_KEYS} />}
      {tab === 'visao' && <div className="clin-overview">
        <section className="clin-card" aria-labelledby="vg-pend"><h2 id="vg-pend">Pendências</h2><p>{openAlerts} {openAlerts === 1 ? 'alerta aberto' : 'alertas abertos'} · {openTasks} {openTasks === 1 ? 'tarefa aberta' : 'tarefas abertas'}</p>
          {d.alerts.filter((a) => !a.final).slice(0, 3).map((a) => <p key={a.id}><span className={a.level === 'urgent_review' ? 'sev sev-urgent' : 'sev sev-review'}>{a.level === 'urgent_review' ? 'Urgente' : 'Revisão'}</span> {a.description ?? a.code} · {a.statusLabel}</p>)}
          <button type="button" className="btn-secondary" onClick={() => setTab('alertas')}>Ver alertas</button></section>
        <section className="clin-card" aria-labelledby="vg-pront"><h2 id="vg-pront">Prontuário (resumo)</h2><RecordTab id={id} summary /></section>
      </div>}
    </section>
  </article>;
}
