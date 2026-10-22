'use client';
// M19 — Conferência de prescrição com IA (rascunho). A IA não decide: o farmacêutico valida. Dados fictícios apenas.
// O navegador só fala com /api/ia/conferencia (servidor); nenhuma chave ou provedor é chamado daqui.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStaff } from './ClinicalShell';

type Status = 'ok' | 'divergente' | 'incerto';
type Check = { status: Status; rule: string; suggestion: string };
type Item = { drug: string; doseMg: number; diluent: string; volumeMl: number; order: number };
type Input = { fictional: true; protocol: string; patient: { name: string; weightKg: number; heightCm: number }; items: Item[] };
type Result = { provider: string; model: string | null; fallbackFrom?: string; fallbackReason?: string; bsaM2: number; disclaimer: string; items: { drug: string; checks: Record<string, Check> }[] };
const LABEL: Record<string, string> = { dose_vs_bsa: 'Dose × superfície corporal', protocol: 'Protocolo', dilution: 'Diluição', infusion_order: 'Ordem de infusão' };
const ST: Record<Status, [string, string]> = { ok: ['clin-ok', 'OK'], divergente: ['clin-warn', 'Divergente'], incerto: ['clin-warn', 'Incerto'] };
const PROV: Record<string, string> = { gemini: 'Google Gemini', groq: 'Groq', mock: 'Simulação local (mock)' };

export function PrescriptionCheck() {
  const me = useStaff();
  const [input, setInput] = useState<Input | null>(null), [res, setRes] = useState<Result | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { fetch('/api/ia/conferencia', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.demo ? setInput(j.demo) : setErr(j.error ?? 'Erro')).catch(() => setErr('Não foi possível carregar a prescrição fictícia.')); }, []);
  const run = async () => {
    if (!input) return; setBusy(true); setErr(''); setRes(null);
    try { const r = await fetch('/api/ia/conferencia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`); setRes(j); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  };
  const setItem = (i: number, k: keyof Item, v: string) => input && setInput({ ...input, items: input.items.map((it, j) => j === i ? { ...it, [k]: k === 'drug' || k === 'diluent' ? v : Number(v) } : it) });
  return <section aria-labelledby="ia-titulo">
    <p className="kicker">ONCOPHARMA Clinical · {me.roleLabel}</p>
    <h1 id="ia-titulo">Conferência de prescrição · Resumo com IA</h1>
    <p className="clin-warn" role="note"><strong>IA não decide.</strong> Rascunho de apoio para o farmacêutico conferir. Demonstração não clínica: use apenas dados fictícios; dados reais e documentos (CPF/CNS) são recusados.</p>
    {input && <form className="workflow-form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
      <p>Paciente fictícia <strong>{input.patient.name}</strong> · {input.patient.weightKg} kg · {input.patient.heightCm} cm · protocolo <strong>{input.protocol}</strong></p>
      <table className="ia-table"><caption>Itens da prescrição fictícia (editáveis para testar divergências)</caption>
        <thead><tr><th scope="col">Ordem</th><th scope="col">Fármaco</th><th scope="col">Dose (mg)</th><th scope="col">Diluente</th><th scope="col">Volume (mL)</th></tr></thead>
        <tbody>{input.items.map((it, i) => <tr key={i}>
          <td><input aria-label={`Ordem de ${it.drug}`} type="number" min={1} value={it.order} onChange={(e) => setItem(i, 'order', e.target.value)} style={{ width: 64 }} /></td>
          <th scope="row">{it.drug}</th>
          <td><input aria-label={`Dose de ${it.drug}`} type="number" value={it.doseMg} onChange={(e) => setItem(i, 'doseMg', e.target.value)} style={{ width: 96 }} /></td>
          <td><input aria-label={`Diluente de ${it.drug}`} value={it.diluent} onChange={(e) => setItem(i, 'diluent', e.target.value)} /></td>
          <td>{it.volumeMl}</td></tr>)}</tbody></table>
      <div className="clin-actions"><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Conferindo…' : 'Gerar resumo com IA'}</button>
        <Link className="btn-secondary" href="/clinical/visao-geral">Voltar para a visão geral</Link></div>
    </form>}
    {err && <p role="alert" className="clin-error">{err}</p>}
    <div aria-live="polite">{res && <section aria-labelledby="ia-res" className="clin-card">
      <h2 id="ia-res">Resumo com IA · rascunho</h2>
      <p className="clin-src" data-provider={res.provider}>Respondido por: <strong>{PROV[res.provider] ?? res.provider}</strong>{res.model ? ` (${res.model})` : ''} · SC {res.bsaM2} m²{res.fallbackFrom && ` · ${PROV[res.fallbackFrom] ?? res.fallbackFrom} indisponível (${res.fallbackReason}); usado mock`}</p>
      {res.items.map((it) => <details key={it.drug} open className="imp-row"><summary><strong>{it.drug}</strong></summary>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>{Object.entries(it.checks).map(([k, c]) => <li key={k}><strong>{LABEL[k] ?? k} <span className={ST[c.status][0]} style={{ padding: '2px 8px', marginLeft: 6 }}>{ST[c.status][1]}</span></strong>
          <p style={{ margin: '4px 0 0' }}>Regra: {c.rule}<br />Sugestão: {c.suggestion}</p></li>)}</ul></details>)}
      <p className="clin-warn" role="note">{res.disclaimer}</p>
    </section>}</div>
  </section>;
}
