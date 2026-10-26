'use client';
// M25 — check-in diário enviado à equipe (me/checkins/today): como está hoje, temperatura opcional e observação.
// Um por dia, editável no mesmo dia. Temperatura >= 37,8 °C segue a regra de febre existente (alerta urgente + 192).
// O app só registra e encaminha: quem avalia e decide é a equipe. Dados fictícios.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { care } from '../../lib/care-client';
import { Icon } from './Icons';
import { FEVER_THRESHOLD_LABEL } from '../../lib/care-guidance';
type Feeling = 'bem' | 'mais_ou_menos' | 'mal';
export type Checkin = { id: string; date: string; feeling: Feeling; feelingLabel: string; celsius: number | null; fever: boolean; note: string | null; createdAt: string; updatedAt: string; edited: boolean; canEdit: boolean };
type Saved = { checkin: Checkin; updated: boolean; urgent: boolean; message: string };
const FEEL: [Feeling, string][] = [['bem', 'Estou bem'], ['mais_ou_menos', 'Mais ou menos'], ['mal', 'Não estou bem']];
const hhmm = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const br = (n: number) => n.toFixed(1).replace('.', ',');
/** variant "hero": abre o formulário completo; "quick": "Estou bem hoje" envia direto (um toque) e permite alterar. */
export function DailyCheckin({ variant, who }: { variant: 'hero' | 'quick'; who?: string | null }) {
  const [ck, setCk] = useState<Checkin | null | undefined>(undefined), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [feeling, setFeeling] = useState<Feeling>('bem'), [temp, setTemp] = useState(''), [note, setNote] = useState('');
  const [err, setErr] = useState(''), [msg, setMsg] = useState(''), [urgent, setUrgent] = useState(false);
  const load = useCallback(() => care<{ checkin: Checkin | null }>('me/checkins/today').then((r) => setCk(r.checkin)).catch((e) => { setCk(null); setErr(e.message); }), []);
  useEffect(() => { void load(); }, [load]);
  const fill = (c: Checkin | null | undefined) => { setFeeling(c?.feeling ?? 'bem'); setTemp(c?.celsius != null ? br(c.celsius) : ''); setNote(c?.note ?? ''); };
  async function send(body: { feeling: Feeling; celsius?: string; note?: string }) {
    setBusy(true); setErr(''); setMsg('');
    try { const r = await care<Saved>('me/checkins/today', { method: 'PUT', body: { ...body, requestId: crypto.randomUUID() } }); setCk(r.checkin); setMsg(r.message); setUrgent(r.urgent); setOpen(false); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível enviar agora.'); } finally { setBusy(false); }
  }
  const submit = () => {
    const t = temp.trim();
    if (t && !/^\d{2}([.,]\d)?$/.test(t)) { setErr('Temperatura: use o formato 36,5 (34,0 a 43,0 °C).'); return; }
    void send({ feeling, ...(t ? { celsius: t.replace(',', '.') } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
  };
  const start = () => { fill(ck); setOpen(true); setErr(''); };
  const sentLine = ck && <p className="cm-checkin-done" role="status" data-checkin-sent={ck.id}><Icon name="circleCheck" size={18} />Check-in de hoje enviado às {hhmm(ck.updatedAt)}{ck.edited ? ' (alterado)' : ''} · <b>{ck.feelingLabel}</b>{ck.celsius != null ? ` · ${br(ck.celsius)} °C` : ''}</p>;
  const primary = variant === 'hero'
    ? <button type="button" className="btn-hero" onClick={start} aria-expanded={open} aria-controls="ck-form" disabled={ck === undefined}>{ck ? 'Alterar check-in →' : 'Enviar check-in →'}</button>
    : ck ? <button type="button" className="btn-secondary" onClick={start} aria-expanded={open}><Icon name="notebook" />Alterar check-in</button>
      : <button type="button" className="btn-primary" onClick={() => void send({ feeling: 'bem' })} disabled={busy || ck === undefined} data-checkin-quick><Icon name="circleCheck" />Estou bem hoje</button>;
  return <>
    {variant === 'hero' ? primary : <div className="care-actions">{primary}{!ck && <button type="button" className="btn-secondary" onClick={start}><Icon name="notebook" />Outra resposta</button>}<Link className="btn-secondary" href="/care/sintoma"><Icon name="notebook" />Registrar sintoma</Link></div>}
    <div className="cm-checkin" aria-live="polite">
      {sentLine}
      {msg && <p className={urgent ? 'cm-checkin-msg is-urgent' : 'cm-checkin-msg'} role={urgent ? 'alert' : 'status'} data-checkin-msg>{msg}{urgent && <> <a className="btn-danger cm-inline-btn" href="tel:192"><Icon name="phone" />Ligar 192</a></>}</p>}
      {err && <p role="alert" className="cm-checkin-err">{err}</p>}
      {open && <form id="ck-form" className="cm-checkin-form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Check-in diário">
        <fieldset className="choices"><legend>{who ? `Como ${who} está hoje?` : 'Como você está hoje?'}</legend>
          {FEEL.map(([k, l]) => <label key={k} className="choice"><input type="radio" name="ck-feeling" value={k} checked={feeling === k} onChange={() => setFeeling(k)} /> {l}</label>)}</fieldset>
        <label htmlFor="ck-temp">Temperatura (°C, opcional)</label>
        <input id="ck-temp" inputMode="decimal" placeholder="Ex.: 36,5" maxLength={4} value={temp} onChange={(e) => setTemp(e.target.value)} aria-describedby="ck-temp-help" />
        <p id="ck-temp-help" className="cm-sub">Febre: {FEVER_THRESHOLD_LABEL} ou mais — nesse caso o app mostra o que fazer agora.</p>
        <label htmlFor="ck-note">Quer contar algo para a equipe? (opcional)</label>
        <textarea id="ck-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="care-actions"><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Enviando…' : ck ? 'Salvar alteração' : 'Enviar check-in'}</button><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
        <p className="cm-sub">Você pode alterar o check-in até o fim do dia. Em emergência, ligue 192 (SAMU).</p>
      </form>}
    </div>
  </>;
}
