'use client';
// M15.4b — alocação do paciente aberto: origem (hospital/manual), autor e horário; manual só quando o hospital não informa;
// divergência hospital × manual exige decisão humana explícita (nada é sobrescrito em silêncio).
import { useState } from 'react';
import { when, work, type AllocationView } from '../../lib/work-client';

export function AllocationPanel({ id, data, onChange }: { id: string; data: AllocationView; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState(false), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const cur = data.current;
  const [f, setF] = useState({ unit: cur?.unit ?? '', floor: cur?.floor ?? '', room: cur?.room ?? '', bed: cur?.bed ?? '' });
  const act = async (path: string, body: unknown, ok: string) => {
    setBusy(true); setErr(''); setMsg('');
    try { await work(path, { method: 'POST', body }); setEditing(false); await onChange(); setMsg(ok); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  };
  return <section className="clin-alloc" aria-labelledby="aloc-titulo">
    <h2 id="aloc-titulo">Alocação</h2>
    {cur ? <p><strong>{cur.label}</strong> <span className="clin-src">{cur.source === 'manual' ? 'Registro manual' : 'Hospital'} — {cur.origin}, {when(cur.at)}</span></p>
      : <p>Sem alocação informada pelo hospital.</p>}
    {data.conflict && <div className="clin-warn" role="note" aria-label="Divergência de alocação">
      <p><strong>Divergência com o hospital.</strong> O hospital informa: {data.conflict.label} ({data.conflict.origin}, {when(data.conflict.at)}). O registro manual foi mantido.</p>
      <div className="clin-actions">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void act(`patients/${id}/allocation/conflict`, { resolution: 'accepted_hospital' }, 'Alocação do hospital adotada.')}>Usar dado do hospital</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act(`patients/${id}/allocation/conflict`, { resolution: 'kept_manual' }, 'Registro manual mantido.')}>Manter registro manual</button>
      </div></div>}
    {data.manualAllowed && !editing && <button type="button" className="btn-secondary" onClick={() => { setF({ unit: cur?.unit ?? '', floor: cur?.floor ?? '', room: cur?.room ?? '', bed: cur?.bed ?? '' }); setMsg(''); setEditing(true); }}>{cur ? 'Corrigir alocação manual' : 'Informar alocação manual'}</button>}
    {editing && <form className="workflow-form" onSubmit={(e) => { e.preventDefault(); void act(`patients/${id}/allocation`, f, 'Alocação manual registrada.'); }}>
      <p className="clin-src">Use somente quando o hospital não informa. O registro fica marcado como manual, com seu nome de papel e horário.</p>
      <label htmlFor="al-unit">Unidade</label><input id="al-unit" required minLength={2} maxLength={80} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
      <label htmlFor="al-floor">Andar</label><input id="al-floor" maxLength={40} value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} />
      <label htmlFor="al-room">Quarto</label><input id="al-room" maxLength={40} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} />
      <label htmlFor="al-bed">Leito</label><input id="al-bed" maxLength={20} value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })} />
      <div className="clin-actions"><button type="submit" className="btn-primary" disabled={busy}>Salvar alocação manual</button><button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button></div>
    </form>}
    <div aria-live="polite">{msg && <p role="status" className="clin-ok">{msg}</p>}</div>
    {err && <p role="alert" className="clin-error">{err}</p>}
  </section>;
}
