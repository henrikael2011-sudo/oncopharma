'use client';
// M25 — aba "Check-in e mensagens" do paciente: check-ins diários do Care (14 dias; febre >= 37,8 °C destacada) e
// conversa paciente/cuidador ↔ equipe com resposta. Leitura e resposta auditadas na API. Não é canal de urgência.
import { useCallback, useEffect, useState } from 'react';
import { celsius, when, work } from '../../lib/work-client';
import { ClinIcon, ClinTile } from './ClinIcons';
type Checkin = { id: string; date: string; feeling: 'bem' | 'mais_ou_menos' | 'mal'; feelingLabel: string; celsius: number | null; fever: boolean; note: string | null; recordedBy: string; updatedAt: string; edited: boolean };
type Msg = { id: string; fromTeam: boolean; authorRole: string; author: string | null; topicLabel: string; body: string; at: string; readAt: string | null };
const WHO: Record<string, string> = { patient: 'Paciente', caregiver: 'Cuidador(a)' };
const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export function CareContactTab({ patientId, onRead }: { patientId: string; onRead?: () => void }) {
  const [ck, setCk] = useState<Checkin[] | null>(null), [th, setTh] = useState<{ disclaimer: string; messages: Msg[] } | null>(null);
  const [err, setErr] = useState(''), [body, setBody] = useState(''), [busy, setBusy] = useState(false), [ok, setOk] = useState('');
  const load = useCallback(async () => {
    try { const [a, b] = await Promise.all([work<{ checkins: Checkin[] }>(`patients/${patientId}/checkins`), work<{ disclaimer: string; messages: Msg[] }>(`patients/${patientId}/messages`)]); setCk(a.checkins); setTh(b);
      if (b.messages.some((m) => !m.fromTeam && !m.readAt)) { await work(`patients/${patientId}/messages/read`, { method: 'POST', body: {} }); onRead?.(); } }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); }
  }, [patientId, onRead]);
  useEffect(() => { void load(); }, [load]);
  async function reply() {
    const b = body.trim(); setOk(''); setErr('');
    if (b.length < 2) { setErr('Escreva a resposta (pelo menos 2 caracteres).'); return; }
    setBusy(true);
    try { await work(`patients/${patientId}/messages`, { method: 'POST', body: { body: b, requestId: crypto.randomUUID() } }); setBody(''); setOk('Resposta enviada ao paciente pelo Care.'); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  }
  return <div className="clin-overview cv-contact">
    {err && <p role="alert" className="clin-error">{err}</p>}
    <section className="clin-card" aria-labelledby="ck-h"><h2 id="ck-h"><ClinTile name="thermo" />Check-in diário (Care)</h2>
      {!ck ? <p role="status">Carregando check-ins…</p> : ck.length ? <ul className="clin-list" aria-label="Check-ins dos últimos dias">{ck.map((c) => <li key={c.id} className="clin-card" data-checkin-id={c.id}>
        <p><strong>{day(c.date)}</strong> · {c.feeling === 'mal' ? <span className="sev sev-review">{c.feelingLabel}</span> : c.feelingLabel}{c.celsius != null && <> · {c.fever ? <span className="sev sev-urgent"><ClinIcon name="thermo" />{celsius(c.celsius)} · febre</span> : celsius(c.celsius)}</>}</p>
        {c.note && <p>“{c.note}”</p>}
        <p className="clin-src">{WHO[c.recordedBy] ?? c.recordedBy} · {when(c.updatedAt)}{c.edited ? ' · alterado no mesmo dia' : ''}</p></li>)}</ul>
        : <p>Nenhum check-in diário enviado nos últimos 14 dias.</p>}
      <p className="clin-src">Febre: 37,8 °C ou mais gera alerta urgente (aba Alertas). “Não estou bem” gera alerta de revisão. A equipe avalia e decide.</p></section>
    <section className="clin-card" aria-labelledby="msg-h"><h2 id="msg-h"><ClinTile name="msg" />Mensagens do Care</h2>
      <p className="clin-warn" role="note">{th?.disclaimer ?? 'Mensagens não são para urgência.'}</p>
      {!th ? <p role="status">Carregando mensagens…</p> : th.messages.length ? <ol className="cv-msg-list" aria-label="Conversa com o paciente">{th.messages.map((m) => <li key={m.id} className={m.fromTeam ? 'cv-msg is-team' : 'cv-msg'} data-msg-id={m.id}>
        <p className="clin-src"><strong>{m.fromTeam ? (m.author ?? 'Equipe') : `${WHO[m.authorRole] ?? m.authorRole}${m.author ? ` (${m.author})` : ''}`}</strong> · {when(m.at)}{!m.fromTeam && ` · ${m.topicLabel}`}</p><p>{m.body}</p></li>)}</ol>
        : <p>Nenhuma mensagem deste paciente.</p>}
      <form className="workflow-form" noValidate onSubmit={(e) => { e.preventDefault(); void reply(); }} aria-label="Responder ao paciente">
        <label htmlFor="msg-reply">Responder ao paciente</label>
        <textarea id="msg-reply" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="clin-actions"><button type="submit" className="btn-primary" disabled={busy}><ClinIcon name="mail" />{busy ? 'Enviando…' : 'Enviar resposta'}</button></div>
        {ok && <p role="status">{ok}</p>}
      </form></section>
  </div>;
}
