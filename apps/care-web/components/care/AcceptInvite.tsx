'use client';
// M15.3 — cuidador informa o código de convite recebido do paciente (uso único, 72 h).
import { useState } from 'react';
import { care } from '../../lib/care-client';
export function AcceptInvite({ onDone }: { onDone: () => Promise<void> }) {
  const [code, setCode] = useState(''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function send(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); try { await care('caregiver/accept', { method: 'POST', body: { code, acceptTerms: true } }); await onDone(); } catch (x) { setErr(x instanceof Error ? x.message : 'Erro'); } finally { setBusy(false); } }
  return <form className="workflow-form care-review" onSubmit={send} aria-labelledby="inv-title">
    <h2 id="inv-title">Sou cuidador e recebi um código</h2>
    <label htmlFor="invite-code">Código de convite</label>
    <input id="invite-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" maxLength={20} placeholder="XXXX-XXXX-XXXX" required />
    <label className="choice"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Entendo que verei apenas o que o paciente liberar, que meus acessos ficam registrados e que o paciente pode encerrar o acesso a qualquer momento.</label>
    <button type="submit" className="btn-primary" disabled={!ok || busy || code.trim().length < 12}>Usar código</button>
    {err && <p role="alert">{err}</p>}
  </form>;
}
