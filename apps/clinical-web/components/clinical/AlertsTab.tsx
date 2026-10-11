'use client';
// M15.4 — alertas com estados §5.1: somente as transições permitidas ao papel aparecem; descartar exige justificativa.
import { useState } from 'react';
import { work, when, ROLE_LABEL, type Alert, type PatientData, type Role } from '../../lib/work-client';

export function AlertsTab({ data, reload }: { data: PatientData; reload: () => Promise<void> }) {
  const [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const done = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); await reload(); setMsg(ok); return true; } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); return false; } };
  const open = data.alerts.filter((a) => !a.final), closed = data.alerts.filter((a) => a.final);
  return <div>
    {msg && <p role="status" className="clin-ok">{msg}</p>}{err && <p role="alert" className="clin-error">{err}</p>}
    {open.length === 0 && <p className="clin-empty">Nenhum alerta aberto.</p>}
    {open.map((a) => <AlertCard key={a.id} a={a} data={data} done={done} />)}
    {closed.length > 0 && <details className="clin-more"><summary>Alertas encerrados ({closed.length})</summary>{closed.map((a) => <AlertCard key={a.id} a={a} data={data} done={done} />)}</details>}
  </div>;
}
function AlertCard({ a, data, done }: { a: Alert; data: PatientData; done: (fn: () => Promise<unknown>, ok: string) => Promise<boolean> }) {
  const [act, setAct] = useState<string | null>(null), [just, setJust] = useState(''), [dup, setDup] = useState(''), [note, setNote] = useState('');
  const [ref, setRef] = useState<{ role: Role; title: string; due: string } | null>(null);
  const others = data.alerts.filter((x) => x.id !== a.id && x.status !== 'duplicate');
  const label = a.actions.find((x) => x.to === act)?.label;
  return <article className={`clin-card alert-card ${a.level === 'urgent_review' ? 'is-urgent' : ''}`} aria-label={`Alerta ${a.code}`}>
    <header><span className={a.level === 'urgent_review' ? 'sev sev-urgent' : 'sev sev-review'}>{a.level === 'urgent_review' ? 'Urgente' : 'Revisão'}</span> <strong>{a.statusLabel}</strong> <small>· {when(a.createdAt)}</small></header>
    <h3>{a.description || a.code}</h3>
    <p>{a.explanation}</p>
    <p className="clin-src">Origem: {a.reportedBy === 'caregiver' ? 'Care — cuidador' : a.description ? 'Care — paciente' : 'Regra de dados'} · regra {a.ruleVersion}</p>
    {!a.final && <div className="clin-actions">
      {a.actions.map((x) => <button key={x.to} type="button" className={x.to === 'dismissed' ? 'btn-secondary' : 'btn-primary'} aria-pressed={act === x.to} onClick={() => { setAct(act === x.to ? null : x.to); setRef(null); }}>{x.label}</button>)}
      {['in_evaluation', 'monitoring'].includes(a.status) && <button type="button" className="btn-secondary" onClick={() => { setAct(null); setRef(ref ? null : { role: 'physician', title: '', due: '' }); }}>Encaminhar</button>}
    </div>}
    {act && <form className="workflow-form" onSubmit={async (e) => { e.preventDefault(); if (await done(() => work(`alerts/${a.id}/transition`, { method: 'POST', body: { to: act, justification: just || undefined, duplicateOf: act === 'duplicate' ? dup : undefined } }), `Alerta: ${label}.`)) { setAct(null); setJust(''); } }}>
      {act === 'duplicate' && <><label htmlFor={`dup-${a.id}`}>Alerta original</label><select id={`dup-${a.id}`} required value={dup} onChange={(e) => setDup(e.target.value)}><option value="">Selecione</option>{others.map((o) => <option key={o.id} value={o.id}>{o.description || o.code} · {when(o.createdAt)}</option>)}</select></>}
      <label htmlFor={`just-${a.id}`}>{act === 'dismissed' ? 'Justificativa (obrigatória)' : 'Justificativa'}</label>
      <textarea id={`just-${a.id}`} rows={2} maxLength={2000} required={act === 'dismissed'} minLength={act === 'dismissed' ? 10 : undefined} value={just} onChange={(e) => setJust(e.target.value)} />
      <button type="submit" className="btn-primary">Confirmar: {label}</button>
    </form>}
    {ref && <form className="workflow-form" onSubmit={async (e) => { e.preventDefault(); if (await done(() => work(`patients/${data.patient.id}/tasks`, { method: 'POST', body: { kind: 'referral', alertId: a.id, title: ref.title, assigneeRole: ref.role, dueAt: ref.due ? new Date(ref.due).toISOString() : undefined } }), 'Encaminhamento criado. Aguarda confirmação de recebimento.')) setRef(null); }}>
      <label htmlFor={`refr-${a.id}`}>Encaminhar para</label>
      <select id={`refr-${a.id}`} value={ref.role} onChange={(e) => setRef({ ...ref, role: e.target.value as Role })}>{(['physician', 'pharmacist', 'nurse'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      <label htmlFor={`reft-${a.id}`}>Motivo do encaminhamento</label><input id={`reft-${a.id}`} required minLength={3} maxLength={160} value={ref.title} onChange={(e) => setRef({ ...ref, title: e.target.value })} />
      <label htmlFor={`refd-${a.id}`}>Prazo (opcional)</label><input id={`refd-${a.id}`} type="datetime-local" value={ref.due} onChange={(e) => setRef({ ...ref, due: e.target.value })} />
      <button type="submit" className="btn-primary">Criar encaminhamento</button>
    </form>}
    {!a.final && data.interventionAllowed && <form className="workflow-form" onSubmit={async (e) => { e.preventDefault(); if (await done(async () => { const r = await fetch(`/api/workflow/patients/${data.patient.id}/interventions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ alertId: a.id, note, decision: 'pending' }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Error(j.error || 'Não foi possível registrar'); }, 'Intervenção farmacêutica registrada. Nenhuma orientação foi enviada ao paciente.')) setNote(''); }}>
      <label htmlFor={`note-${a.id}`}>Intervenção farmacêutica (nota)</label>
      <textarea id={`note-${a.id}`} rows={2} maxLength={2000} required value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" className="btn-secondary">Registrar intervenção</button>
    </form>}
  </article>;
}
