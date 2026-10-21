'use client';
// M22 — transcrição da prescrição médica + conferência/liberação pela farmácia. Alterar a prescrição é do médico:
// esta tela só registra o que foi prescrito (com a referência da prescrição) e a farmácia libera antes de chegar ao Care.
// Nenhuma decisão automática/IA. Toda ação fica na trilha (quem transcreveu, quem liberou/devolveu, quando, observação).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { work, when } from '../../lib/work-client';
type Item = { id: string; lineageId: string; version: number; kind: 'new' | 'update' | 'discontinue'; kindLabel: string; medication: string; dose: string; route: string; routeLabel: string; times: string[]; frequency: string; startDate: string; endDate: string | null; instructions: string; prescriptionRef: string; status: 'pending_release' | 'released' | 'rejected' | 'superseded' | 'discontinued'; statusLabel: string; enteredBy: string; enteredAt: string; reviewedAt: string | null; reviewNote: string | null; mine: boolean };
type Data = { role: string; canEnter: boolean; canRelease: boolean; routes: Record<string, string>; items: Item[] };
type Form = { lineageId?: string; medication: string; dose: string; route: string; times: string[]; frequency: string; startDate: string; endDate: string; instructions: string; prescriptionRef: string };
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const EMPTY: Form = { medication: '', dose: '', route: 'VO', times: ['08:00'], frequency: '', startDate: today(), endDate: '', instructions: '', prescriptionRef: '' };
const br = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const SEV: Record<Item['status'], string> = { pending_release: 'sev sev-review', released: 'sev sev-none', rejected: 'sev sev-urgent', superseded: 'sev sev-none', discontinued: 'sev sev-none' };
export function MedTranscriptionTab({ patientId }: { patientId: string }) {
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState(''), [msg, setMsg] = useState(''), [form, setForm] = useState<Form | null>(null), [stop, setStop] = useState<string | null>(null);
  const load = useCallback(() => work<Data>(`patients/${patientId}/med-transcriptions`).then(setD).catch((e) => setErr(e.message)), [patientId]);
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); await load(); return true; } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); return false; } };
  const lineages = useMemo(() => { const m = new Map<string, Item[]>(); for (const i of d?.items ?? []) m.set(i.lineageId, [...(m.get(i.lineageId) ?? []), i]); return [...m.values()].map((v) => v.sort((a, b) => b.version - a.version)); }, [d]);
  const pending = (d?.items ?? []).filter((i) => i.status === 'pending_release');
  if (!d) return err ? <p role="alert" className="clin-error">{err}</p> : <p role="status">Carregando…</p>;
  return <div className="clin-transcr">
    <p className="clin-notice" role="note">Transcrição da prescrição médica. Alterar a prescrição é atribuição do médico; aqui a equipe registra o que foi prescrito e a <strong>farmácia confere e libera</strong> antes de chegar ao paciente no Care. Nenhuma decisão automática. A dose não é exibida ao paciente.</p>
    {msg && <p role="status" className="clin-ok">{msg}</p>}{err && <p role="alert" className="clin-error">{err}</p>}
    {d.canEnter && !form && <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>Transcrever prescrição</button>}
    {form && <TranscriptionForm form={form} setForm={setForm} routes={d.routes} onCancel={() => setForm(null)} onSubmit={async (f) => { if (await act(() => work(`patients/${patientId}/med-transcriptions`, { method: 'POST', body: { ...f, endDate: f.endDate || undefined, times: f.times.filter(Boolean) } }), 'Transcrição registrada. Aguardando liberação da farmácia.')) setForm(null); }} />}
    {d.canRelease && <section aria-labelledby="tr-pend" className="clin-card"><h2 id="tr-pend">Aguardando liberação da farmácia ({pending.length})</h2>
      {pending.length === 0 ? <p className="clin-empty">Nenhuma transcrição pendente.</p> : pending.map((i) => <ReleaseCard key={i.id} i={i} act={act} />)}</section>}
    <section aria-labelledby="tr-list"><h2 id="tr-list">Medicamentos transcritos</h2>
      {lineages.length === 0 ? <p className="clin-empty">Nenhuma transcrição registrada.</p> : <ul className="clin-list">{lineages.map((v) => { const cur = v.find((x) => x.status === 'released') ?? v[0]; const hasPending = v.some((x) => x.status === 'pending_release');
        return <li key={cur.lineageId} className="clin-card" aria-label={`Medicamento ${cur.medication}`}>
          <header><strong>{cur.medication}</strong> <span className={SEV[cur.status]}>{cur.statusLabel}</span>{hasPending && cur.status !== 'pending_release' && <> <span className="sev sev-review">Nova versão aguardando liberação</span></>}</header>
          <Summary i={cur} />
          {d.canEnter && cur.status === 'released' && !hasPending && <div className="clin-actions">
            <button type="button" className="btn-secondary" onClick={() => setForm({ lineageId: cur.lineageId, medication: cur.medication, dose: cur.dose, route: cur.route, times: cur.times, frequency: cur.frequency, startDate: cur.startDate, endDate: cur.endDate ?? '', instructions: cur.instructions, prescriptionRef: '' })}>Transcrever atualização</button>
            <button type="button" className="btn-secondary" onClick={() => setStop(cur.lineageId)}>Transcrever suspensão</button></div>}
          {stop === cur.lineageId && <StopForm onCancel={() => setStop(null)} onSubmit={async (b) => { if (await act(() => work(`patients/${patientId}/med-transcriptions/${cur.lineageId}/discontinue`, { method: 'POST', body: b }), 'Suspensão registrada. Aguardando liberação da farmácia.')) setStop(null); }} />}
          <details className="clin-more"><summary>Histórico ({v.length} {v.length === 1 ? 'versão' : 'versões'})</summary><ol className="clin-trail">{v.map((x) => <li key={x.id}>v{x.version} · {x.kindLabel} · <span className={SEV[x.status]}>{x.statusLabel}</span> — transcrito por {x.enteredBy} em {when(x.enteredAt)}{x.reviewedAt ? ` · conferido pela farmácia em ${when(x.reviewedAt)}` : ''}{x.reviewNote ? ` · obs.: ${x.reviewNote}` : ''} · ref.: {x.prescriptionRef}</li>)}</ol></details>
        </li>; })}</ul>}
    </section>
  </div>;
}
function Summary({ i }: { i: Item }) {
  return <dl className="clin-dl"><dt>Dose (como prescrita)</dt><dd>{i.dose}</dd><dt>Via</dt><dd>{i.routeLabel}</dd><dt>Horários</dt><dd>{i.times.join(' · ')} — {i.frequency}</dd><dt>Período</dt><dd>{br(i.startDate)} a {i.endDate ? br(i.endDate) : 'sem término definido'}</dd><dt>Orientações ao paciente</dt><dd>{i.instructions}</dd><dt>Prescrição</dt><dd>{i.prescriptionRef}</dd></dl>;
}
function ReleaseCard({ i, act }: { i: Item; act: (fn: () => Promise<unknown>, ok: string) => Promise<boolean> }) {
  const [ok, setOk] = useState(false), [note, setNote] = useState('');
  return <article className="clin-card clin-release" aria-label={`Conferir ${i.medication}`}>
    <header><strong>{i.kindLabel}: {i.medication}</strong> <span className="sev sev-review">v{i.version}</span></header>
    <Summary i={i} /><p className="clin-meta">Transcrito por {i.enteredBy} em {when(i.enteredAt)}{i.mine ? ' (por você)' : ''}</p>
    <label className="choice"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Conferi esta transcrição com a prescrição médica</label>
    <label htmlFor={`n-${i.id}`}>Observação da farmácia (obrigatória para devolver)</label><textarea id={`n-${i.id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
    <div className="clin-actions"><button type="button" className="btn-primary" disabled={!ok} onClick={() => void act(() => work(`med-transcriptions/${i.id}/release`, { method: 'POST', body: { confirm: true, note: note || undefined } }), `${i.medication}: liberado para o paciente.`)}>{i.kind === 'discontinue' ? 'Liberar suspensão' : 'Liberar para o paciente'}</button>
      <button type="button" className="btn-secondary" disabled={note.trim().length < 3} onClick={() => void act(() => work(`med-transcriptions/${i.id}/reject`, { method: 'POST', body: { note } }), `${i.medication}: devolvido para correção.`)}>Devolver para correção</button></div>
  </article>;
}
function TranscriptionForm({ form, setForm, routes, onSubmit, onCancel }: { form: Form; setForm: (f: Form) => void; routes: Record<string, string>; onSubmit: (f: Form) => Promise<void>; onCancel: () => void }) {
  const set = (k: keyof Form, v: string) => setForm({ ...form, [k]: v });
  return <form className="workflow-form clin-card" aria-label="Transcrever prescrição" onSubmit={(e) => { e.preventDefault(); void onSubmit(form); }}>
    <h2>{form.lineageId ? `Transcrever atualização: ${form.medication}` : 'Transcrever prescrição médica'}</h2>
    <label htmlFor="tr-med">Medicamento</label><input id="tr-med" required minLength={2} maxLength={120} value={form.medication} onChange={(e) => set('medication', e.target.value)} />
    <label htmlFor="tr-dose">Dose (como prescrita)</label><input id="tr-dose" required maxLength={80} value={form.dose} onChange={(e) => set('dose', e.target.value)} />
    <label htmlFor="tr-route">Via</label><select id="tr-route" value={form.route} onChange={(e) => set('route', e.target.value)}>{Object.entries(routes).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    <fieldset className="clin-times"><legend>Horários</legend>{form.times.map((t, n) => <span key={n}><input type="time" aria-label={`Horário ${n + 1}`} required value={t} onChange={(e) => setForm({ ...form, times: form.times.map((x, j) => (j === n ? e.target.value : x)) })} />{form.times.length > 1 && <button type="button" className="btn-secondary" aria-label={`Remover horário ${n + 1}`} onClick={() => setForm({ ...form, times: form.times.filter((_, j) => j !== n) })}>Remover</button>}</span>)}
      {form.times.length < 8 && <button type="button" className="btn-secondary" onClick={() => setForm({ ...form, times: [...form.times, '12:00'] })}>Adicionar horário</button>}</fieldset>
    <label htmlFor="tr-freq">Frequência (como prescrita)</label><input id="tr-freq" required minLength={2} maxLength={120} value={form.frequency} onChange={(e) => set('frequency', e.target.value)} />
    <label htmlFor="tr-start">Início</label><input id="tr-start" type="date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
    <label htmlFor="tr-end">Término (opcional)</label><input id="tr-end" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
    <label htmlFor="tr-ins">Orientações da equipe ao paciente (aparecem no Care; sem dose)</label><textarea id="tr-ins" required minLength={2} maxLength={500} rows={2} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
    <label htmlFor="tr-ref">Referência da prescrição médica</label><input id="tr-ref" required minLength={3} maxLength={160} placeholder="Ex.: prescrição do médico responsável, data" value={form.prescriptionRef} onChange={(e) => set('prescriptionRef', e.target.value)} />
    <div className="clin-actions"><button type="submit" className="btn-primary">Registrar transcrição</button><button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button></div>
  </form>;
}
function StopForm({ onSubmit, onCancel }: { onSubmit: (b: { prescriptionRef: string; reason: string }) => Promise<void>; onCancel: () => void }) {
  const [ref, setRef] = useState(''), [reason, setReason] = useState('');
  return <form className="workflow-form" aria-label="Transcrever suspensão" onSubmit={(e) => { e.preventDefault(); void onSubmit({ prescriptionRef: ref, reason }); }}>
    <label htmlFor="st-ref">Referência da prescrição médica de suspensão</label><input id="st-ref" required minLength={3} maxLength={160} value={ref} onChange={(e) => setRef(e.target.value)} />
    <label htmlFor="st-why">Motivo (conforme prescrição)</label><input id="st-why" required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
    <div className="clin-actions"><button type="submit" className="btn-primary">Registrar suspensão</button><button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button></div>
  </form>;
}
