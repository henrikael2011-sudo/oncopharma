'use client';
import { useState } from 'react';
import { care } from '../../lib/care-client';
import { useMe } from './CareShell';
const SIZES: [string, string][] = [['normal', 'Normal'], ['large', 'Grande'], ['xlarge', 'Muito grande']];
export function Preferences() {
  const { me, reload } = useMe();
  const [fontScale, setFont] = useState(me.preferences.fontScale), [highContrast, setHc] = useState(me.preferences.highContrast), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  async function save(e: React.FormEvent) { e.preventDefault(); setErr(''); try { await care('me/preferences', { method: 'PUT', body: { fontScale, highContrast } }); await reload(); setMsg('Preferências salvas.'); } catch (x) { setErr(x instanceof Error ? x.message : 'Erro'); } }
  return <section aria-labelledby="p-title"><h1 id="p-title">Preferências</h1>
    <form className="workflow-form" onSubmit={save}>
      <fieldset className="choices"><legend>Tamanho do texto</legend>{SIZES.map(([k, l]) => <label key={k} className="choice"><input type="radio" name="font" checked={fontScale === k} onChange={() => setFont(k as typeof fontScale)} /> {l}</label>)}</fieldset>
      <label className="choice"><input type="checkbox" checked={highContrast} onChange={(e) => setHc(e.target.checked)} /> Mais contraste</label>
      <button type="submit" className="btn-primary">Salvar</button>
    </form>{msg && <p role="status">{msg}</p>}{err && <p role="alert">{err}</p>}
    <p className="care-note">Termos aceitos em {me.consent.acceptedAt ? new Date(me.consent.acceptedAt).toLocaleDateString('pt-BR') : '—'}.</p>
  </section>;
}
