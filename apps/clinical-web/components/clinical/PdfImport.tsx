'use client';
// M15.4c — importação da lista diária de pacientes (PDF exportado pelo hospital). Fluxo: enviar → prévia → confirmação humana.
// Nada é gravado em pacientes/alocação antes de "Confirmar importação". Lista mínima; detalhes da linha somente ao abrir (clique).
import Link from 'next/link';
import { useState } from 'react';
import { when, work, type ImportPreview, type ImportResult } from '../../lib/work-client';
import { useStaff } from './ClinicalShell';

const ACTION: Record<string, string> = { create: 'Novo paciente', update: 'Atualizar alocação', unchanged: 'Sem alteração', conflict: 'Divergência com o hospital', not_linked: 'Sem vínculo com você', invalid: 'Linha não importável' };
const MAX = 2 * 1024 * 1024;
const toB64 = (f: File) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onerror = () => no(new Error('Não foi possível ler o arquivo')); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.readAsDataURL(f); });

export function PdfImport() {
  const me = useStaff();
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [prev, setPrev] = useState<ImportPreview | null>(null), [done, setDone] = useState<ImportResult | null>(null), [apply, setApply] = useState<string[]>([]);
  const allowed = me.role !== 'physician';
  const send = async () => {
    if (!file) return; setErr(''); setDone(null); setPrev(null); setApply([]);
    if (file.size > MAX) { setErr('Arquivo maior que 2 MB.'); return; }
    if (file.type && file.type !== 'application/pdf') { setErr('Selecione um arquivo PDF.'); return; }
    setBusy(true);
    try { setPrev(await work<ImportPreview>('imports/pdf', { method: 'POST', body: { fileName: file.name, contentBase64: await toB64(file) } })); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  };
  const decide = async (kind: 'confirm' | 'discard') => {
    if (!prev) return; setBusy(true); setErr('');
    try {
      const r = await work<ImportResult>(`imports/${prev.importId}/${kind}`, { method: 'POST', body: kind === 'confirm' ? { applyConflicts: apply } : {} });
      setDone(r); setPrev(null);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  };
  if (!allowed) return <section aria-labelledby="imp-titulo"><h1 id="imp-titulo">Importar lista do hospital</h1>
    <p role="note">A importação está disponível para Farmácia, Enfermagem e Gestão clínica.</p><Link href="/clinical/pacientes">Voltar para pacientes</Link></section>;
  const c = prev?.counts;
  return <section aria-labelledby="imp-titulo">
    <p className="kicker">ONCOPHARMA Clinical · {me.roleLabel}</p>
    <h1 id="imp-titulo">Importar lista do hospital</h1>
    <p>Envie o PDF da lista diária de pacientes exportado pelo sistema do hospital. Você verá uma prévia e decide o que aplicar.</p>
    {!prev && <form className="workflow-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <label htmlFor="imp-file">Arquivo PDF (até 2 MB)</label>
      <input id="imp-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="clin-actions"><button type="submit" className="btn-primary" disabled={!file || busy}>{busy ? 'Lendo arquivo…' : 'Gerar prévia'}</button>
        <Link className="btn-secondary" href="/clinical/pacientes">Voltar para pacientes</Link></div>
    </form>}
    {err && <p role="alert" className="clin-error">{err}</p>}
    {prev && c && <section aria-labelledby="prev-titulo" className="imp-preview">
      <h2 id="prev-titulo">Prévia da importação</h2>
      <p className="clin-src">{prev.fileName} · {prev.layout} · enviado {when(prev.uploadedAt)} · arquivo {prev.sha256.slice(0, 12)}</p>
      {prev.previouslyImportedAt && <p className="clin-warn" role="note">Este mesmo arquivo já foi importado em {when(prev.previouslyImportedAt)}.</p>}
      <p role="status">{c.create} novos, {c.update} com alocação a atualizar, {c.unchanged} sem alteração, {c.conflict} com divergência, {c.not_linked} sem vínculo, {c.invalid} não importáveis.</p>
      <ul className="patient-list" aria-label="Linhas do arquivo">{prev.rows.map((r) => <li key={r.id}><details className="imp-row">
        <summary><span className="pr-name">{r.name ?? 'Sem nome'}</span> <span className="pr-record">{r.record ? `Prontuário ${r.record}` : 'Sem prontuário'}</span> <span className={`imp-act imp-${r.action}`}>{ACTION[r.action]}</span></summary>
        <dl className="imp-detail">
          <dt>Linha do arquivo</dt><dd>{r.line}</dd>
          <dt>Alocação no arquivo</dt><dd>{r.allocation ?? '—'}</dd>
          {r.current && <><dt>Alocação atual</dt><dd>{r.current}</dd></>}
          {r.nameDivergent && <><dt>Nome cadastrado</dt><dd>{r.currentName} (nome diferente no arquivo; confira a identificação)</dd></>}
          {r.error && <><dt>Motivo</dt><dd>{r.error}</dd></>}
        </dl>
        {r.action === 'conflict' && <label className="clin-toggle"><input type="checkbox" checked={apply.includes(r.id)} onChange={(e) => setApply(e.target.checked ? [...apply, r.id] : apply.filter((x) => x !== r.id))} /> Aplicar a alocação do arquivo mesmo assim</label>}
      </details></li>)}</ul>
      <p className="clin-src">Nada foi gravado ainda. Divergências com o hospital só são aplicadas se você marcar cada uma.</p>
      <div className="clin-actions"><button type="button" className="btn-primary" disabled={busy || c.create + c.update + apply.length === 0} onClick={() => void decide('confirm')}>Confirmar importação</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void decide('discard')}>Descartar</button></div>
    </section>}
    <div aria-live="polite">{done && <p role="status" className="clin-ok">{done.status === 'discarded' ? 'Importação descartada. Nada foi alterado.'
      : `Importação confirmada: ${done.created ?? 0} novos, ${done.updated ?? 0} atualizados, ${done.conflicts ?? 0} divergências aplicadas, ${done.skipped ?? 0} não aplicados.`}</p>}</div>
    {done && <p><Link href="/clinical/pacientes" className="clin-back">Ver lista de pacientes</Link></p>}
  </section>;
}
