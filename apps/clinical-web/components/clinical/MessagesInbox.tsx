'use client';
// M25 — caixa de entrada das mensagens do Care (somente pacientes vinculados). Abrir leva à aba "Check-in e mensagens".
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { when, work } from '../../lib/work-client';
import { ClinTile } from './ClinIcons';
type T = { patientId: string; name: string; record: string | null; lastAt: string; unread: number; total: number };
export function MessagesInbox() {
  const [d, setD] = useState<{ disclaimer: string; threads: T[] } | null>(null), [err, setErr] = useState('');
  useEffect(() => { work<{ disclaimer: string; threads: T[] }>('messages/inbox').then(setD).catch((e) => setErr(e.message)); }, []);
  return <section aria-labelledby="inbox-h">
    <p className="cv-kicker">Care → equipe</p>
    <h1 id="inbox-h"><ClinTile name="msg" />Mensagens do Care</h1>
    <p className="clin-warn" role="note">{d?.disclaimer ?? 'Mensagens não são para urgência.'} Dados fictícios.</p>
    {err && <p role="alert" className="clin-error">{err}</p>}
    {!d && !err && <p role="status">Carregando mensagens…</p>}
    {d && (d.threads.length ? <ul className="clin-list" aria-label="Conversas">{d.threads.map((t) => <li key={t.patientId} className="clin-card" data-thread={t.patientId}>
      <p><Link href={`/clinical/pacientes/${t.patientId}?aba=contato`}><strong>{t.name}</strong></Link>{t.record ? ` · Prontuário ${t.record}` : ''}</p>
      <p>{t.unread > 0 ? <span className="sev sev-review">{t.unread} {t.unread === 1 ? 'não lida' : 'não lidas'}</span> : 'Todas lidas'} · {t.total} {t.total === 1 ? 'mensagem' : 'mensagens'} · última {when(t.lastAt)}</p></li>)}</ul>
      : <p data-inbox-empty>Nenhuma mensagem dos seus pacientes.</p>)}
  </section>;
}
