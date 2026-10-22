'use client';
// M24 — painel base do farmacêutico hospitalar. Atualização quase em tempo real por consulta periódica (intervalo da API,
// pausa com a aba oculta). Fila: gravidade e depois tempo de espera. Somente leitura e priorização visual:
// o ONCOPHARMA não decide conduta — a equipe avalia. Integração hospitalar SIMULADA, rotulada em toda a tela.
// Mockup aprovado clinical-visao-geral-farmaceutico-marca-v3h: menu lateral verde-petróleo com logo dourado e bloco
// 'Resumo com IA · rascunho' (IA SIMULADA: texto montado no navegador a partir dos dados fictícios; a IA não decide).
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { when, work } from '../../lib/work-client';
import { useStaff } from './ClinicalShell';

type Meta = { simulated: true; integrationNotice: string; teamNotice: string; feverThresholdC: number; pollSeconds: number; lastSync: { source: string; at: string } | null; generatedAt: string };
type QItem = { id: string; patientId: string; patientName: string; record: string | null; location: string | null; locationSource: string | null; code: string; level: string; levelLabel: string; status: string; statusLabel: string; explanation: string; description: string | null; reportedBy: string | null; createdAt: string; waitingMinutes: number };
type Queue = Meta & { roleLabel: string; counts: { urgent: number; review: number }; items: QItem[] };
type Detail = Meta & { patient: { id: string; name: string; record: string | null; location: string | null; locationSource: string | null };
  alerts: { id: string; level: string; levelLabel: string; statusLabel: string; open: boolean; explanation: string; createdAt: string }[];
  checkins: { kind: 'symptom' | 'temperature' | 'adherence'; id: string; at: string; label: string; detail: string; flagged: boolean; by: string | null }[];
  medications: { id: string; medication: string; route: string | null; schedule: string | null; origin: string }[];
  hospitalMeds: { available: boolean; simulated: true; source?: string; reason?: string; items: { ref: string; medication: string; route: string; times: string[]; frequency: string }[] } };
const wait = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d`);
const celsius = (n: number) => `${n.toFixed(1).replace('.', ',')} °C`;
const hhmmss = (d: string) => new Date(d).toLocaleTimeString('pt-BR');

function SimBadge({ text }: { text: string }) { return <p className="hp-sim" role="note"><b>Integração simulada</b> · {text}</p>; }

const DAY = 24 * 3600e3;
type Change = { at: string; kind: string; text: string; flagged: boolean };
function changes(d: Detail, now: number): Change[] {
  const out: Change[] = [];
  for (const a of d.alerts) if (now - Date.parse(a.createdAt) <= DAY) out.push({ at: a.createdAt, kind: a.open ? 'Alerta aberto' : 'Alerta', text: `${a.levelLabel} · ${a.explanation}`, flagged: a.level === 'urgent_review' });
  for (const c of d.checkins) if (now - Date.parse(c.at) <= DAY) out.push({ at: c.at, kind: c.label, text: c.detail, flagged: c.flagged });
  return out.sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
}
// Rascunho SIMULADO: texto montado por regras simples a partir dos dados fictícios (nenhum modelo é chamado aqui).
function aiDraft(d: Detail, ch: Change[]): string {
  const first = d.patient.name.split(' ')[0];
  if (!ch.length) return `Nas últimas 24 h não há registros novos de ${first}. A equipe confere o histórico abaixo.`;
  const temps = d.checkins.filter((c) => c.kind === 'temperature' && Date.now() - Date.parse(c.at) <= DAY);
  const flaggedTemps = temps.filter((c) => c.flagged).length;
  const symptoms = d.checkins.filter((c) => c.kind === 'symptom' && Date.now() - Date.parse(c.at) <= DAY).map((c) => c.detail.toLowerCase());
  const adh = d.checkins.filter((c) => c.kind === 'adherence' && Date.now() - Date.parse(c.at) <= DAY).length;
  const open = d.alerts.filter((a) => a.open).length;
  const parts = [`Nas últimas 24 h, ${first} teve ${ch.length} registro${ch.length === 1 ? '' : 's'} novo${ch.length === 1 ? '' : 's'}.`];
  if (temps.length) parts.push(`${temps.length} medida${temps.length === 1 ? '' : 's'} de temperatura, ${flaggedTemps ? `${flaggedTemps} igual ou acima de ${celsius(d.feverThresholdC)}` : `nenhuma igual ou acima de ${celsius(d.feverThresholdC)}`}.`);
  if (symptoms.length) parts.push(`Sintomas relatados: ${[...new Set(symptoms)].slice(0, 3).join('; ')}.`);
  if (adh) parts.push(`${adh} registro${adh === 1 ? '' : 's'} de adesão aos orais.`);
  parts.push(`${open} alerta${open === 1 ? '' : 's'} aguardando a equipe. Pontos para a equipe conferir no prontuário.`);
  return parts.join(' ');
}

function SideNav({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const me = useStaff();
  return <aside className={`hp-nav${open ? ' is-open' : ''}`} aria-label="Menu do painel">
    <div className="hp-nav-top">
      <Link href="/clinical" className="hp-nav-brand"><img src="/brand/mark.svg" width={40} height={40} alt="" /><span><strong>ONCOPHARMA</strong><small>Farmácia hospitalar</small></span></Link>
      <button type="button" className="hp-nav-toggle" aria-expanded={open} aria-controls="hp-nav-links" onClick={() => setOpen(!open)}>{open ? 'Fechar menu' : 'Menu'}</button>
    </div>
    <nav id="hp-nav-links" className="hp-nav-links" aria-label="Áreas do Clinical">
      <p className="hp-nav-sec">Neste painel</p>
      <a href="#hp-q-title" onClick={() => setOpen(false)}>Fila priorizada</a>
      <a href="#hp-ia" onClick={() => setOpen(false)}>Resumo com IA</a>
      <p className="hp-nav-sec">Clinical</p>
      <Link href="/clinical/painel" aria-current="page">Painel hospitalar</Link>
      <Link href="/clinical">Pacientes</Link>
      {me.role !== 'clinical_manager' && <Link href="/clinical/cadastros">Cadastros por convite</Link>}
      {me.roles?.includes('physician') && <Link href="/clinical/solicitacoes">Solicitações recebidas</Link>}
      <p className="hp-nav-foot">Dados fictícios · integração simulada</p>
    </nav>
  </aside>;
}

export function HospitalPanel() {
  const [q, setQ] = useState<Queue | null>(null), [err, setErr] = useState(''), [sel, setSel] = useState<string | null>(null);
  const [d, setD] = useState<Detail | null>(null), [dErr, setDErr] = useState(''), [menu, setMenu] = useState(false);
  const selRef = useRef<string | null>(null); selRef.current = sel;
  
  const loadQueue = useCallback(async () => { try { setQ(await work<Queue>('panel/queue')); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }, []);
  const loadDetail = useCallback(async (id: string) => { try { const x = await work<Detail>(`panel/patients/${id}`); if (selRef.current === id) { setD(x); setDErr(''); } } catch (e) { setDErr(e instanceof Error ? e.message : 'Erro'); } }, []);
  useEffect(() => { void loadQueue(); }, [loadQueue]);
  const every = (q?.pollSeconds ?? 15) * 1000;
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') { void loadQueue(); if (selRef.current) void loadDetail(selRef.current); } }, every);
    return () => clearInterval(t);
  }, [every, loadQueue, loadDetail]);
  const open = useCallback((id: string) => {
    selRef.current = id; setSel(id); setD(null); void loadDetail(id);
  }, [loadDetail]);
  // Primeiro paciente da fila selecionado por padrão.
  useEffect(() => { if (!selRef.current && q?.items.length) open(q.items[0].patientId); }, [q, open]);
  return <div className={`hp-shell${menu ? ' menu-open' : ''}`}>
    <SideNav open={menu} setOpen={setMenu} />
    <section aria-labelledby="hp-title" className="hp">
    <div className="hp-head">
      <div><p className="kicker">ONCOPHARMA Clinical · Farmácia hospitalar</p><h1 id="hp-title">Painel de alertas</h1></div>
      <p className="hp-live" aria-live="polite">{q ? <>Atualizado às {hhmmss(q.generatedAt)} · atualiza a cada {q.pollSeconds} s</> : 'Carregando…'}</p>
    </div>
    <p className="hp-team" role="note"><b>A equipe avalia.</b> {q?.teamNotice ?? 'O ONCOPHARMA não decide conduta: a equipe assistencial avalia cada alerta.'} A ordem da fila é só para leitura: gravidade, depois tempo de espera. Febre: a partir de {celsius(q?.feverThresholdC ?? 37.8)}.</p>
    <SimBadge text={q?.integrationNotice ?? 'Integração hospitalar SIMULADA (FHIR R4 fictício) — não é Tasy/MV nem sistema real.'} />
    {err && <p className="clin-error" role="alert">{err}</p>}
    <div className="hp-grid">
      <div className="hp-queue" aria-labelledby="hp-q-title">
        <h2 id="hp-q-title">Fila priorizada {q && <span className="hp-counts">{q.counts.urgent} urgente{q.counts.urgent === 1 ? '' : 's'} · {q.counts.review} em revisão</span>}</h2>
        {q && !q.items.length && <p className="hp-empty">Nenhum alerta aberto nos pacientes vinculados a você.</p>}
        <ol className="hp-list">{q?.items.map((a, i) => <li key={a.id}>
          <button type="button" className={`hp-item ${a.level === 'urgent_review' ? 'is-urgent' : 'is-review'}${sel === a.patientId ? ' is-selected' : ''}`} aria-pressed={sel === a.patientId} onClick={() => open(a.patientId)}>
            <span className="hp-pos" aria-label={`Posição ${i + 1}`}>{i + 1}</span>
            <span className="hp-main"><span className="hp-name">{a.patientName}</span>
              <span className="hp-meta">{a.record ? `Prontuário ${a.record}` : 'Sem prontuário'}{a.location ? ` · ${a.location}` : ''}{a.locationSource === 'hospital' ? ' (hospital simulado)' : ''}</span>
              <span className="hp-desc">{a.description ?? a.explanation}</span></span>
            <span className="hp-side"><span className={a.level === 'urgent_review' ? 'sev sev-urgent' : 'sev sev-review'}>{a.levelLabel}</span><span className="hp-wait">espera {wait(a.waitingMinutes)}</span><span className="hp-status">{a.statusLabel}</span></span>
          </button></li>)}</ol>
      </div>
      <div className="hp-col">
      {d && <section id="hp-ia" className="hp-ai" aria-labelledby="hp-ia-title">
        <h2 id="hp-ia-title" className="hp-ai-label">Resumo com IA · rascunho <span className="hp-sim-tag">rascunho</span></h2>
        <p className="hp-ai-text">{aiDraft(d, changes(d, Date.now()))}</p>
        <p className="hp-ai-notice">IA não decide — revisão e decisão são do farmacêutico e da equipe médica. IA simulada na demonstração (dados fictícios).</p>
      </section>}
      <div className="hp-detail" aria-live="polite">
        {!sel && <p className="hp-empty">Selecione um paciente na fila para ver check-ins, alertas e medicamentos.</p>}
        {sel && dErr && <p className="clin-error" role="alert">{dErr}</p>}
        {sel && !d && !dErr && <p role="status">Carregando paciente…</p>}
        {d && <article aria-labelledby="hp-d-title">
          <header className="hp-d-head"><h2 id="hp-d-title">{d.patient.name}</h2><p>{d.patient.record ? `Prontuário ${d.patient.record}` : 'Sem prontuário'}{d.patient.location ? ` · ${d.patient.location}` : ''}{d.patient.locationSource === 'hospital' ? ' · alocação do hospital simulado' : ''}</p>
            <Link href={`/clinical/pacientes/${d.patient.id}`} className="btn-secondary">Abrir paciente (registrar avaliação)</Link></header>
          <section><h3>Alertas</h3>{!d.alerts.length ? <p className="hp-empty">Sem alertas.</p> : <ul className="hp-rows">{d.alerts.map((a) => <li key={a.id} className={a.open ? '' : 'is-closed'}><span className={a.level === 'urgent_review' ? 'sev sev-urgent' : 'sev sev-review'}>{a.levelLabel}</span> <b>{a.statusLabel}</b> · {when(a.createdAt)}<br />{a.explanation}</li>)}</ul>}</section>
          <section><h3>Check-ins recentes (14 dias)</h3>{!d.checkins.length ? <p className="hp-empty">Nenhum check-in no período.</p> : <ul className="hp-rows">{d.checkins.map((c) => <li key={`${c.kind}-${c.id}`} className={c.flagged ? 'is-flagged' : ''}><b>{c.label}</b> · {when(c.at)}{c.by ? ` · ${c.by === 'caregiver' ? 'cuidador' : 'paciente'}` : ''}<br />{c.detail}{c.flagged && c.kind === 'temperature' ? ` — igual ou acima de ${celsius(d.feverThresholdC)} (para avaliação da equipe)` : ''}</li>)}</ul>}</section>
          <section><h3>Medicamentos ativos</h3>{!d.medications.length ? <p className="hp-empty">Nenhum medicamento ativo registrado.</p> : <ul className="hp-rows">{d.medications.map((m) => <li key={m.id}><b>{m.medication}</b>{m.route ? ` · ${m.route}` : ''}{m.schedule ? ` · ${m.schedule}` : ''}<br /><span className="hp-meta">{m.origin}</span></li>)}</ul>}</section>
          <section><h3>Orais no sistema do hospital <span className="hp-sim-tag">simulado</span></h3>
            {!d.hospitalMeds.available ? <p className="hp-empty">{d.hospitalMeds.reason}</p> : !d.hospitalMeds.items.length ? <p className="hp-empty">Nenhuma medicação oral ativa no hospital simulado.</p>
              : <ul className="hp-rows">{d.hospitalMeds.items.map((m) => <li key={m.ref}><b>{m.medication}</b> · {m.route}{m.times.length ? ` · ${m.times.join(', ')}` : ''}{m.frequency ? ` · ${m.frequency}` : ''}</li>)}</ul>}
            <p className="hp-meta">Fonte: {d.hospitalMeds.source ?? 'Hospital simulado'} (dados fictícios). Conferência e conduta são da equipe.</p></section>
        </article>}
      </div>
      </div>
    </div>
    <p className="hp-foot">Dados fictícios · ambiente de teste · não liberado para uso clínico.{q?.lastSync ? ` Última sincronização de alocação: ${when(q.lastSync.at)} (${q.lastSync.source}).` : ''}</p>
  </section>
  </div>;
}
