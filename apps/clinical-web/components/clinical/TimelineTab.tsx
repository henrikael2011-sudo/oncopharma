'use client';
// M15.4 — linha do tempo multiprofissional: cada registro com origem e horário.
import { useEffect, useState } from 'react';
import { work, when } from '../../lib/work-client';

type Item = { at: string; kind: string; title: string; detail: string | null; source: string; urgent?: boolean };
export function TimelineTab({ id }: { id: string }) {
  const [items, setItems] = useState<Item[] | null>(null), [err, setErr] = useState('');
  useEffect(() => { work<{ items: Item[] }>(`patients/${id}/timeline`).then((r) => setItems(r.items)).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p role="alert" className="clin-error">{err}</p>;
  if (!items) return <p role="status">Carregando linha do tempo…</p>;
  if (!items.length) return <p className="clin-empty">Sem registros.</p>;
  return <ol className="timeline" aria-label="Linha do tempo">{items.map((i, n) => <li key={n} className={i.urgent ? 'is-urgent' : undefined}>
    <time dateTime={i.at}>{when(i.at)}</time> <strong>{i.title}</strong>{i.detail ? <span> — {i.detail}</span> : null}<small>Origem: {i.source}</small>
  </li>)}</ol>;
}
