'use client';
// M25 — "Falar com a equipe": mensagens do paciente/cuidador para a equipe (me/messages) e respostas da equipe.
// NÃO é canal de urgência: aviso fixo + 192 (SAMU). Texto cifrado em repouso e envio auditado na API. Dados fictícios.
import { useCallback, useEffect, useState } from 'react';
import { care } from '../../lib/care-client';
import { Icon, Tile } from './Icons';
export type Topic = 'geral' | 'remedios' | 'consulta' | 'outro';
type Msg = { id: string; fromTeam: boolean; authorRole: string; author: string | null; topicLabel: string; body: string; at: string; readByTeam?: boolean };
type Thread = { disclaimer: string; topics: Record<Topic, string>; messages: Msg[] };
const when = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const WHO: Record<string, string> = { patient: 'Você', caregiver: 'Cuidador(a)' };
export function TeamMessages({ topic: initial, focusKey }: { topic: Topic; focusKey: number }) {
  const [t, setT] = useState<Thread | null>(null), [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState<Topic>(initial), [body, setBody] = useState('');
  const load = useCallback(() => care<Thread>('me/messages').then(setT).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setTopic(initial); if (focusKey > 0) document.getElementById('msg-body')?.focus(); }, [initial, focusKey]);
  async function send() {
    const b = body.trim(); setOk(''); setErr('');
    if (b.length < 2) { setErr('Escreva sua mensagem (pelo menos 2 caracteres).'); return; }
    setBusy(true);
    try { await care('me/messages', { method: 'POST', body: { body: b, topic, requestId: crypto.randomUUID() } }); setBody(''); setOk('Mensagem enviada para a equipe. A resposta aparece aqui, em horário de atendimento.'); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível enviar agora.'); } finally { setBusy(false); }
  }
  return <section className="care-card cm-msgs" id="t-msg" aria-labelledby="t-msg-h">
    <h2 id="t-msg-h"><Tile name="message" />Mensagens com a equipe</h2>
    <p className="cm-soon" role="note" data-msg-disclaimer>{t?.disclaimer ?? 'Mensagens não são para urgência. Em emergência, ligue 192 (SAMU).'}</p>
    {!t && !err && <p role="status">Carregando mensagens…</p>}
    {t && (t.messages.length ? <ol className="cm-msg-list" aria-label="Conversa com a equipe">{t.messages.map((m) => <li key={m.id} className={m.fromTeam ? 'cm-msg is-team' : 'cm-msg'} data-msg-id={m.id}>
      <div className="cm-sub"><b>{m.fromTeam ? (m.author ?? 'Equipe') : WHO[m.authorRole] ?? 'Você'}</b> · {when(m.at)}{!m.fromTeam && ` · ${m.topicLabel}`}{!m.fromTeam && (m.readByTeam ? ' · lida pela equipe' : ' · enviada')}</div>
      <p>{m.body}</p></li>)}</ol> : <p data-msg-empty>Nenhuma mensagem ainda. Escreva abaixo para falar com a sua equipe.</p>)}
    <form className="workflow-form cm-msg-form" noValidate onSubmit={(e) => { e.preventDefault(); void send(); }} aria-label="Nova mensagem para a equipe">
      <label htmlFor="msg-topic">Assunto</label>
      <select id="msg-topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>{Object.entries(t?.topics ?? { geral: 'Dúvida geral', remedios: 'Remédios', consulta: 'Consulta ou sessão', outro: 'Outro assunto' }).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <label htmlFor="msg-body">Mensagem</label>
      <textarea id="msg-body" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} aria-describedby="msg-help" />
      <p id="msg-help" className="cm-sub">Até 1000 caracteres. Não use para urgência.</p>
      <div className="care-actions"><button type="submit" className="btn-primary" disabled={busy}><Icon name="message" />{busy ? 'Enviando…' : 'Enviar mensagem'}</button></div>
      {ok && <p role="status" data-msg-ok>{ok}</p>}
      {err && <p role="alert">{err}</p>}
    </form>
    <p className="care-note">Em uma emergência, ligue 192 (SAMU).</p>
  </section>;
}
