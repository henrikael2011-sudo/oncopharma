'use client';
// M15.4 — tarefas/encaminhamentos: responsável por papel, prazo, confirmação de recebimento e desfecho obrigatório.
import { useState } from 'react';
import { work, when, ROLE_LABEL, type PatientData, type Role, type Task } from '../../lib/work-client';

const STATUS: Record<Task['status'], string> = { open: 'Aguardando recebimento', received: 'Recebida', done: 'Concluída', cancelled: 'Cancelada' };
export function TasksTab({ data, reload }: { data: PatientData; reload: () => Promise<void> }) {
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [form, setForm] = useState({ title: '', role: 'nurse' as Role, due: '', details: '' }), [show, setShow] = useState(false);
  const done = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); await reload(); setMsg(ok); return true; } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); return false; } };
  return <div>
    {msg && <p role="status" className="clin-ok">{msg}</p>}{err && <p role="alert" className="clin-error">{err}</p>}
    {data.role !== 'clinical_manager' && <button type="button" className="btn-primary" aria-expanded={show} onClick={() => setShow(!show)}>Nova tarefa</button>}
    {show && <form className="workflow-form" onSubmit={async (e) => { e.preventDefault(); if (await done(() => work(`patients/${data.patient.id}/tasks`, { method: 'POST', body: { kind: 'task', title: form.title, details: form.details || undefined, assigneeRole: form.role, dueAt: form.due ? new Date(form.due).toISOString() : undefined } }), 'Tarefa criada.')) { setShow(false); setForm({ title: '', role: 'nurse', due: '', details: '' }); } }}>
      <label htmlFor="t-title">O que precisa ser feito</label><input id="t-title" required minLength={3} maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label htmlFor="t-role">Responsável</label><select id="t-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{(['nurse', 'pharmacist', 'physician'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      <label htmlFor="t-due">Prazo (opcional)</label><input id="t-due" type="datetime-local" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
      <label htmlFor="t-det">Detalhes (opcional)</label><textarea id="t-det" rows={2} maxLength={2000} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
      <button type="submit" className="btn-primary">Criar tarefa</button>
    </form>}
    {data.tasks.length === 0 ? <p className="clin-empty">Nenhuma tarefa.</p> : <ul className="clin-list">{data.tasks.map((t) => <TaskItem key={t.id} t={t} done={done} />)}</ul>}
  </div>;
}
function TaskItem({ t, done }: { t: Task; done: (fn: () => Promise<unknown>, ok: string) => Promise<boolean> }) {
  const [text, setText] = useState(''), [mode, setMode] = useState<'complete' | 'cancel' | null>(null);
  return <li className="clin-card" aria-label={`${t.kind === 'referral' ? 'Encaminhamento' : 'Tarefa'}: ${t.title}`}>
    <header><strong>{t.kind === 'referral' ? 'Encaminhamento' : 'Tarefa'}: {t.title}</strong> <span className="sev sev-none">{STATUS[t.status]}</span></header>
    <p>Responsável: {t.assigneeLabel}{t.dueAt ? ` · Prazo ${when(t.dueAt)}` : ''} · Criada em {when(t.createdAt)}{t.receivedAt ? ` · Recebida em ${when(t.receivedAt)}` : ''}</p>
    {t.details && <p>{t.details}</p>}{t.outcome && <p><strong>{t.status === 'cancelled' ? 'Motivo' : 'Desfecho'}:</strong> {t.outcome}</p>}
    <div className="clin-actions">
      {t.canReceive && <button type="button" className="btn-primary" onClick={() => void done(() => work(`tasks/${t.id}/receive`, { method: 'POST', body: {} }), 'Recebimento confirmado.')}>Confirmar recebimento</button>}
      {t.canComplete && <button type="button" className="btn-primary" onClick={() => setMode('complete')}>Concluir</button>}
      {t.canCancel && <button type="button" className="btn-secondary" onClick={() => setMode('cancel')}>Cancelar</button>}
    </div>
    {mode && <form className="workflow-form" onSubmit={async (e) => { e.preventDefault(); if (await done(() => work(`tasks/${t.id}/${mode}`, { method: 'POST', body: mode === 'complete' ? { outcome: text } : { reason: text } }), mode === 'complete' ? 'Tarefa concluída.' : 'Tarefa cancelada.')) setMode(null); }}>
      <label htmlFor={`tt-${t.id}`}>{mode === 'complete' ? 'Desfecho' : 'Motivo do cancelamento'}</label>
      <textarea id={`tt-${t.id}`} rows={2} required minLength={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn-primary">{mode === 'complete' ? 'Registrar desfecho' : 'Confirmar cancelamento'}</button>
    </form>}
  </li>;
}
