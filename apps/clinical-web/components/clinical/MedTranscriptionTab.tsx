'use client';
// M22 — transcrição da prescrição médica + conferência/liberação pela farmácia. Alterar a prescrição é do médico:
// esta tela só registra o que foi prescrito (com a referência da prescrição) e a farmácia libera antes de chegar ao Care.
// Três formas de entrada — foto (rascunho por IA ou extrator simulado), sistema do hospital (orais, simulado) e manual —
// todas só PRÉ-PREENCHEM o formulário: a equipe revisa/edita e registra; nada chega ao paciente sem a liberação da farmácia.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { work, when } from '../../lib/work-client';
type Status = 'pending_release' | 'released' | 'rejected' | 'superseded' | 'discontinued';
type Item = { id: string; lineageId: string; version: number; kind: 'new' | 'update' | 'discontinue'; kindLabel: string; medication: string; dose: string; route: string; routeLabel: string; times: string[]; frequency: string; startDate: string; endDate: string | null; instructions: string; prescriptionRef: string; status: Status; statusLabel: string; enteredBy: string; enteredAt: string; reviewedAt: string | null; reviewNote: string | null; mine: boolean; entrySource: Source; entrySourceLabel: string; sourceDetail: string | null };
type Data = { role: string; canEnter: boolean; canRelease: boolean; routes: Record<string, string>; items: Item[] };
type Source = 'manual' | 'foto_ia' | 'hospital';
type Draft = { medication: string; dose: string; route: string; times: string[]; frequency: string; startDate: string; endDate: string; instructions: string; warnings?: string[]; ref?: string };
type Form = { lineageId?: string; medication: string; dose: string; route: string; times: string[]; frequency: string; startDate: string; endDate: string; instructions: string; prescriptionRef: string; entrySource: Source; sourceDetail?: string; warnings?: string[] };
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const EMPTY: Form = { medication: '', dose: '', route: 'VO', times: ['08:00'], frequency: '', startDate: today(), endDate: '', instructions: '', prescriptionRef: '', entrySource: 'manual' };
const br = (d: string | null) => (d ? d.split('-').reverse().join('/') : '');
const SEV: Record<Status, string> = { pending_release: 'sev sev-review', released: 'sev sev-none', rejected: 'sev sev-urgent', superseded: 'sev sev-none', discontinued: 'sev sev-none' };
const ORIGIN: Record<Source, string> = { manual: 'Manual', foto_ia: 'Foto (rascunho IA)', hospital: 'Hospital' };
const fromDraft = (d: Draft, entrySource: Source, sourceDetail: string, prescriptionRef = ''): Form => ({ ...EMPTY, ...d, route: d.route || 'VO', times: d.times.length ? d.times : ['08:00'], startDate: d.startDate || today(), endDate: d.endDate || '', prescriptionRef, entrySource, sourceDetail, warnings: d.warnings });

export function MedTranscriptionTab({ patientId }: { patientId: string }) {
  const [d, setD] = useState<Data | null>(null), [err, setErr] = useState(''), [msg, setMsg] = useState(''), [form, setForm] = useState<Form | null>(null), [stop, setStop] = useState<string | null>(null), [mode, setMode] = useState<'foto' | 'hospital' | null>(null);
  const load = useCallback(() => work<Data>(`patients/${patientId}/med-transcriptions`).then(setD).catch((e) => setErr(e.message)), [patientId]);
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); await load(); return true; } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); return false; } };
  const lineages = useMemo(() => { const m = new Map<string, Item[]>(); for (const i of d?.items ?? []) m.set(i.lineageId, [...(m.get(i.lineageId) ?? []), i]); return [...m.values()].map((v) => v.sort((a, b) => b.version - a.version)); }, [d]);
  const pending = (d?.items ?? []).filter((i) => i.status === 'pending_release');
  if (!d) return err ? <p role="alert" className="clin-error">{err}</p> : <p role="status">Carregando…</p>;
  // Para a farmácia, itens só pendentes aparecem uma vez (na conferência), não repetidos na lista.
  const listed = lineages.filter((v) => !(d.canRelease && v.every((x) => x.status === 'pending_release')));
  const use = (f: Form) => { setMode(null); setForm(f); };
  return <div className="clin-transcr">
    <p className="clin-meta">Transcrição da prescrição médica: alterar a prescrição é do médico. A <strong>farmácia confere e libera</strong> antes de aparecer no Care; a dose não é exibida ao paciente.</p>
    {msg && <p role="status" className="clin-ok">{msg}</p>}{err && <p role="alert" className="clin-error">{err}</p>}
    {d.canEnter && !form && <div className="tr-entry" role="group" aria-label="Forma de entrada">
      <button type="button" className={mode === 'foto' ? 'btn-primary' : 'btn-secondary'} aria-pressed={mode === 'foto'} onClick={() => setMode(mode === 'foto' ? null : 'foto')}>Foto da prescrição</button>
      <button type="button" className={mode === 'hospital' ? 'btn-primary' : 'btn-secondary'} aria-pressed={mode === 'hospital'} onClick={() => setMode(mode === 'hospital' ? null : 'hospital')}>Importar do hospital (orais)</button>
      <button type="button" className="btn-secondary" onClick={() => use({ ...EMPTY })}>Adicionar manualmente</button></div>}
    {!form && mode === 'foto' && <PhotoPanel patientId={patientId} onUse={use} />}
    {!form && mode === 'hospital' && <HospitalPanel patientId={patientId} onUse={use} />}
    {form && <TranscriptionForm form={form} setForm={setForm} routes={d.routes} onCancel={() => setForm(null)} onSubmit={async (f) => { const { warnings: _w, ...b } = f; if (await act(() => work(`patients/${patientId}/med-transcriptions`, { method: 'POST', body: { ...b, endDate: f.endDate || undefined, times: f.times.filter(Boolean) } }), 'Transcrição registrada. Aguardando liberação da farmácia.')) setForm(null); }} />}
    {d.canRelease && pending.length > 0 && <section aria-labelledby="tr-pend"><h2 id="tr-pend">Aguardando liberação da farmácia ({pending.length})</h2>
      {pending.map((i) => <ReleaseCard key={i.id} i={i} act={act} />)}</section>}
    <section aria-labelledby="tr-list"><h2 id="tr-list">Medicamentos transcritos</h2>
      {listed.length === 0 ? <p className="clin-empty">{lineages.length ? 'Todos aguardam a liberação da farmácia.' : 'Nenhuma transcrição registrada.'}</p> : <ul className="clin-list">{listed.map((v) => { const cur = v.find((x) => x.status === 'released') ?? v[0]; const hasPending = v.some((x) => x.status === 'pending_release');
        return <li key={cur.lineageId} className="clin-card" aria-label={`Medicamento ${cur.medication}`}>
          <div className="tr-head"><strong>{cur.medication}</strong><span className={SEV[cur.status]}>{cur.statusLabel}</span>{hasPending && cur.status !== 'pending_release' && <span className="sev sev-review">Nova versão aguardando liberação</span>}</div>
          <Summary i={cur} />
          {d.canEnter && cur.status === 'released' && !hasPending && <div className="clin-actions">
            <button type="button" className="btn-secondary" onClick={() => use({ lineageId: cur.lineageId, medication: cur.medication, dose: cur.dose, route: cur.route, times: cur.times, frequency: cur.frequency, startDate: cur.startDate, endDate: cur.endDate ?? '', instructions: cur.instructions, prescriptionRef: '', entrySource: 'manual' })}>Transcrever atualização</button>
            <button type="button" className="btn-secondary" onClick={() => setStop(cur.lineageId)}>Transcrever suspensão</button></div>}
          {stop === cur.lineageId && <StopForm onCancel={() => setStop(null)} onSubmit={async (b) => { if (await act(() => work(`patients/${patientId}/med-transcriptions/${cur.lineageId}/discontinue`, { method: 'POST', body: b }), 'Suspensão registrada. Aguardando liberação da farmácia.')) setStop(null); }} />}
          <details className="clin-more"><summary>Histórico ({v.length} {v.length === 1 ? 'versão' : 'versões'})</summary><ol className="clin-trail">{v.map((x) => <li key={x.id}>v{x.version} · {x.kindLabel} · {x.statusLabel} · origem: {x.entrySourceLabel}{x.sourceDetail ? ` (${x.sourceDetail})` : ''} — transcrito por {x.enteredBy} em {when(x.enteredAt)}{x.reviewedAt ? ` · conferido pela farmácia em ${when(x.reviewedAt)}` : ''}{x.reviewNote ? ` · obs.: ${x.reviewNote}` : ''} · ref.: {x.prescriptionRef}</li>)}</ol></details>
        </li>; })}</ul>}
    </section>
  </div>;
}
/** Resumo compacto: horários e frequência em destaque; dose/via/período numa linha; orientação ao paciente; referência discreta. */
function Summary({ i }: { i: Item }) {
  return <div className="tr-sum">
    <p className="tr-times"><b>{i.times.join(' · ')}</b> — {i.frequency}</p>
    <p className="clin-meta">Dose (como prescrita): {i.dose} · {i.routeLabel} · {br(i.startDate)}{i.endDate ? ` a ${br(i.endDate)}` : ' · sem término definido'}</p>
    <p>Orientações ao paciente: {i.instructions}</p>
    <p className="clin-meta">Prescrição: {i.prescriptionRef} · origem: {ORIGIN[i.entrySource] ?? i.entrySourceLabel}</p>
  </div>;
}
function ReleaseCard({ i, act }: { i: Item; act: (fn: () => Promise<unknown>, ok: string) => Promise<boolean> }) {
  const [ok, setOk] = useState(false), [note, setNote] = useState('');
  return <article className="clin-card" aria-label={`Conferir ${i.medication}`}>
    <div className="tr-head"><strong>{i.medication}</strong><span className="sev sev-review">{i.kindLabel} · v{i.version}</span></div>
    <Summary i={i} /><p className="clin-meta">Transcrito por {i.enteredBy} em {when(i.enteredAt)}{i.mine ? ' (por você)' : ''}</p>
    <label className="choice"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Conferi esta transcrição com a prescrição médica</label>
    <div className="clin-actions"><button type="button" className="btn-primary" disabled={!ok} onClick={() => void act(() => work(`med-transcriptions/${i.id}/release`, { method: 'POST', body: { confirm: true } }), `${i.medication}: liberado para o paciente.`)}>{i.kind === 'discontinue' ? 'Liberar suspensão' : 'Liberar para o paciente'}</button></div>
    <details className="clin-more"><summary>Devolver para correção</summary>
      <label htmlFor={`n-${i.id}`}>Motivo da devolução</label><textarea id={`n-${i.id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="clin-actions"><button type="button" className="btn-secondary" disabled={note.trim().length < 3} onClick={() => void act(() => work(`med-transcriptions/${i.id}/reject`, { method: 'POST', body: { note } }), `${i.medication}: devolvido para correção.`)}>Devolver para correção</button></div></details>
  </article>;
}
type Extract = { provider: string; simulated: boolean; notice?: string; disclaimer: string; fallbackFrom?: string[]; items: Draft[] };
function PhotoPanel({ patientId, onUse }: { patientId: string; onUse: (f: Form) => void }) {
  const [file, setFile] = useState<File | null>(null), [fict, setFict] = useState(false), [busy, setBusy] = useState(false), [res, setRes] = useState<Extract | null>(null), [err, setErr] = useState('');
  async function extract() {
    if (!file) return; setBusy(true); setErr(''); setRes(null);
    try {
      const b64 = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => no(new Error('Falha ao ler a imagem')); r.readAsDataURL(file); });
      const r = await fetch('/api/ia/extrair-prescricao', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientId, fictional: fict, mimeType: file.type, imageBase64: b64 }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Extração indisponível'); setRes(j);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  }
  const detail = res ? (res.simulated ? 'extrator simulado' : res.provider) : '';
  return <section className="clin-card" aria-label="Foto da prescrição">
    <label htmlFor="tr-foto">Foto da prescrição médica (PNG, JPEG ou WEBP, até 4 MB)</label>
    <input id="tr-foto" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    <label className="choice"><input type="checkbox" checked={fict} onChange={(e) => setFict(e.target.checked)} /> A imagem é fictícia (sem dados reais de paciente)</label>
    <div className="clin-actions"><button type="button" className="btn-primary" disabled={!file || !fict || busy} onClick={() => void extract()}>{busy ? 'Extraindo…' : 'Extrair rascunho'}</button></div>
    {err && <p role="alert" className="clin-error">{err}</p>}
    {res && <div role="status" data-extract={res.provider}>
      <p className="clin-warn">{res.simulated ? res.notice : `Rascunho por IA (${res.provider}). `}{res.disclaimer}</p>
      {res.items.length === 0 ? <p className="clin-empty">Nenhum medicamento legível na imagem.</p> : <ul className="clin-list">{res.items.map((x, n) => <li key={n}><div className="tr-head"><strong>{x.medication}</strong><span className="clin-meta">{x.times.join(' · ') || 'sem horário'}</span></div>
        {x.warnings?.map((w) => <p key={w} className="clin-meta">{w}</p>)}
        <button type="button" className="btn-secondary" onClick={() => onUse(fromDraft(x, 'foto_ia', detail))}>Revisar e usar</button></li>)}</ul>}
    </div>}
  </section>;
}
type Hosp = { source: string; items: (Draft & { ref: string })[]; skippedNonOral: number };
function HospitalPanel({ patientId, onUse }: { patientId: string; onUse: (f: Form) => void }) {
  const [res, setRes] = useState<Hosp | null>(null), [err, setErr] = useState('');
  useEffect(() => { work<Hosp>(`patients/${patientId}/med-transcriptions/hospital-oral`).then(setRes).catch((e) => setErr(e.message)); }, [patientId]);
  return <section className="clin-card" aria-label="Importar do hospital">
    {err ? <p role="alert" className="clin-error">{err}</p> : !res ? <p role="status">Consultando o sistema do hospital…</p> : <>
      <p className="clin-meta">{res.source} · somente medicações orais ativas{res.skippedNonOral ? ` (${res.skippedNonOral} de outras vias não importadas)` : ''}. Cada item vira rascunho para revisão.</p>
      {res.items.length === 0 ? <p className="clin-empty">Nenhuma medicação oral ativa no hospital.</p> : <ul className="clin-list">{res.items.map((x) => <li key={x.ref} data-hosp={x.ref}><div className="tr-head"><strong>{x.medication}</strong><span className="clin-meta">{x.times.join(' · ')} — {x.frequency}</span></div>
        <button type="button" className="btn-secondary" onClick={() => onUse(fromDraft(x, 'hospital', `${res.source} · ${x.ref}`, `${res.source} · pedido ${x.ref}`))}>Revisar e usar</button></li>)}</ul>}</>}
  </section>;
}
function TranscriptionForm({ form, setForm, routes, onSubmit, onCancel }: { form: Form; setForm: (f: Form) => void; routes: Record<string, string>; onSubmit: (f: Form) => Promise<void>; onCancel: () => void }) {
  const set = (k: keyof Form, v: string) => setForm({ ...form, [k]: v });
  return <form className="workflow-form clin-card" aria-label="Transcrever prescrição" onSubmit={(e) => { e.preventDefault(); void onSubmit(form); }}>
    <div className="tr-head"><h2>{form.lineageId ? `Transcrever atualização: ${form.medication}` : 'Transcrever prescrição médica'}</h2>{form.entrySource !== 'manual' && <span className="sev sev-review">Rascunho · {ORIGIN[form.entrySource]} — revise todos os campos</span>}</div>
    {form.warnings?.map((w) => <p key={w} className="clin-meta">{w}</p>)}
    <div className="tr-grid">
      <div><label htmlFor="tr-med">Medicamento</label><input id="tr-med" required minLength={2} maxLength={120} value={form.medication} onChange={(e) => set('medication', e.target.value)} /></div>
      <div><label htmlFor="tr-dose">Dose (como prescrita)</label><input id="tr-dose" required maxLength={80} value={form.dose} onChange={(e) => set('dose', e.target.value)} /></div>
      <div><label htmlFor="tr-route">Via</label><select id="tr-route" value={form.route} onChange={(e) => set('route', e.target.value)}>{Object.entries(routes).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label htmlFor="tr-freq">Frequência (como prescrita)</label><input id="tr-freq" required minLength={2} maxLength={120} value={form.frequency} onChange={(e) => set('frequency', e.target.value)} /></div>
      <div><label htmlFor="tr-start">Início</label><input id="tr-start" type="date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
      <div><label htmlFor="tr-end">Término (opcional)</label><input id="tr-end" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
    </div>
    <fieldset className="clin-times"><legend>Horários</legend>{form.times.map((t, n) => <span key={n}><input type="time" aria-label={`Horário ${n + 1}`} required value={t} onChange={(e) => setForm({ ...form, times: form.times.map((x, j) => (j === n ? e.target.value : x)) })} />{form.times.length > 1 && <button type="button" className="tr-x" aria-label={`Remover horário ${n + 1}`} onClick={() => setForm({ ...form, times: form.times.filter((_, j) => j !== n) })}>×</button>}</span>)}
      {form.times.length < 8 && <button type="button" className="btn-secondary" onClick={() => setForm({ ...form, times: [...form.times, '12:00'] })}>Adicionar horário</button>}</fieldset>
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
