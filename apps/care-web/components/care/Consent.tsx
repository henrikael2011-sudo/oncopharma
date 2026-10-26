'use client';
// M15.2 — consentimento de uso do Care. Texto PROVISÓRIO pendente de revisão jurídica/LGPD da instituição
// (registrado em docs/product/DECISOES_M15.md); a versão aceita fica gravada e auditada.
// M18 — PROPOSTA de revisão do termo care-termos-2026-10 alinhada ao PR #12 (sem "equipe avisada"; app não é
// acompanhado em tempo real). NÃO VALIDADA: aguarda revisão profissional do Henrikael e jurídica/LGPD (docs/revisao-clinica-pr12.md).
// Versão mantida em care-termos-2026-10 até decisão; se o texto for aprovado, avaliar nova versão para reaceite.
import { useState } from 'react';
import { care } from '../../lib/care-client';
import { Tile } from './Icons';
export function Consent({ version, onDone }: { version: string; onDone: () => Promise<void> }) {
  const [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function accept(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); try { await care('me/consent', { method: 'PUT', body: { termsVersion: version, accept: true } }); await onDone(); } catch (x) { setErr(x instanceof Error ? x.message : 'Erro'); } finally { setBusy(false); } }
  return <section className="care-panel cm-card cm-consent" aria-labelledby="consent-title">
    <p className="cm-consent-kicker">Termo de uso do Care · versão {version}</p>
    <h1 id="consent-title">Antes de começar</h1>
    <ul className="care-list cm-consent-list">
      <li><Tile name="notebook" /><span>O que você registrar aqui fica salvo no sistema para a sua equipe de cuidado avaliar depois.</span></li>
      <li><Tile name="clock" /><span>Este aplicativo não é acompanhado em tempo real: a equipe não recebe aviso imediato do que você registra.</span></li>
      <li><Tile name="shield" /><span>Somente pessoas da equipe ligadas ao seu tratamento podem ver seus registros. Todo acesso fica registrado.</span></li>
      <li><Tile name="siren" gold /><span>Este aplicativo não substitui consulta nem atendimento de urgência. Se piorar ou em uma emergência, não espere resposta pelo app: ligue 192 (SAMU) ou para o seu hospital.</span></li>
      <li><Tile name="user" /><span>Você pode pedir à equipe, a qualquer momento, para encerrar o uso.</span></li>
    </ul>
    <form onSubmit={accept} className="workflow-form">
      <label className="choice"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Li e concordo</label>
      <button type="submit" className="btn-primary" disabled={!ok || busy}>Continuar</button>
    </form>
    {err && <p role="alert" className="cm-consent-err">{err}</p>}
  </section>;
}
