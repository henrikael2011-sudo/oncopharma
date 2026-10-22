'use client';
// M24 — convites de autocadastro (link + QR de uso único) e conferência dos cadastros enviados.
// Nada entra no acompanhamento sem a conferência da equipe; a confirmação cria o paciente com os dados enviados
// (sem redigitação) e o prontuário informado pela equipe.
import { useCallback, useEffect, useState } from 'react';
import { when, work } from '../../lib/work-client';

type Invite = { inviteId: string; expiresAt: string; link: string; qrSvg: string; singleUse: true };
type Reg = { id: string; name: string; birthDate: string; age: number; phone: string; email: string | null; submittedByLabel: string; caregiver: { name: string; relationship: string; phone: string } | null;
  diagnosis: string; regimen: string | null; treatmentStart: string | null; hospitalName: string | null; status: 'pending_review' | 'confirmed' | 'rejected'; statusLabel: string; createdAt: string; reviewedAt: string | null; reviewNote: string | null; patientId: string | null };
type List = { openInvites: number; items: Reg[] };
const br = (d: string) => d.split('-').reverse().join('/');

function RegCard({ r, onDone }: { r: Reg; onDone: () => Promise<void> }) {
  const [record, setRecord] = useState(''), [ok, setOk] = useState(false), [note, setNote] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const act = async (path: string, body: unknown) => { setBusy(true); setErr(''); try { await work(path, { method: 'POST', body }); await onDone(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); } };
  return <article className={`rg-card is-${r.status}`} aria-label={`Cadastro de ${r.name}`}>
    <header><h3>{r.name}</h3><span className={`rg-status rg-${r.status}`}>{r.statusLabel}</span></header>
    <dl className="rg-dl">
      <dt>Nascimento</dt><dd>{br(r.birthDate)} ({r.age} anos)</dd><dt>Telefone</dt><dd>{r.phone}</dd>{r.email && <><dt>E-mail</dt><dd>{r.email}</dd></>}
      <dt>Preenchido por</dt><dd>{r.submittedByLabel}</dd>
      {r.caregiver && <><dt>Cuidador(a)</dt><dd>{r.caregiver.name} · {r.caregiver.relationship} · {r.caregiver.phone}</dd></>}
      <dt>Diagnóstico (informado)</dt><dd>{r.diagnosis}</dd>{r.regimen && <><dt>Tratamento (informado)</dt><dd>{r.regimen}</dd></>}
      {r.treatmentStart && <><dt>Início</dt><dd>{br(r.treatmentStart)}</dd></>}{r.hospitalName && <><dt>Hospital/clínica</dt><dd>{r.hospitalName}</dd></>}
      <dt>Enviado em</dt><dd>{when(r.createdAt)}</dd>{r.reviewNote && <><dt>Motivo da devolução</dt><dd>{r.reviewNote}</dd></>}
    </dl>
    {r.status === 'pending_review' && <div className="rg-actions">
      <form onSubmit={(e) => { e.preventDefault(); void act(`registrations/${r.id}/confirm`, { record, confirm: ok }); }}>
        <label htmlFor={`rec-${r.id}`}>Prontuário no hospital</label><input id={`rec-${r.id}`} value={record} onChange={(e) => setRecord(e.target.value)} placeholder="PR-10031" maxLength={30} required />
        <label className="choice"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Conferi os dados com o paciente/documento</label>
        <button type="submit" className="btn-primary" disabled={busy || !ok || record.trim().length < 3}>Confirmar cadastro</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); void act(`registrations/${r.id}/reject`, { note }); }}>
        <label htmlFor={`note-${r.id}`}>Devolver com motivo</label><input id={`note-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        <button type="submit" className="btn-secondary" disabled={busy || note.trim().length < 3}>Devolver</button>
      </form>
      {err && <p className="clin-error" role="alert">{err}</p>}
    </div>}
  </article>;
}

export function Registrations() {
  const [inv, setInv] = useState<Invite | null>(null), [hours, setHours] = useState(72), [list, setList] = useState<List | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const load = useCallback(async () => { try { setList(await work<List>('registrations')); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const issue = async () => { setBusy(true); setErr(''); setCopied(false); try { setInv(await work<Invite>('registration-invites', { method: 'POST', body: { hours } })); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); } };
  const pending = list?.items.filter((r) => r.status === 'pending_review') ?? [], done = list?.items.filter((r) => r.status !== 'pending_review') ?? [];
  return <section aria-labelledby="rg-title" className="rg">
    <div className="hp-head"><div><p className="kicker">ONCOPHARMA Clinical · Cadastro</p><h1 id="rg-title">Cadastros por convite</h1></div></div>
    <p className="hp-team" role="note">O paciente ou cuidador preenche pelo link ou QR. O cadastro chega <b>pendente de conferência</b>: a equipe confere e confirma. Dados fictícios neste ambiente.</p>
    <div className="rg-invite">
      <div><h2>Novo convite</h2><p>Uso único. Expira no prazo escolhido.</p>
        <label htmlFor="rg-hours">Validade</label>
        <select id="rg-hours" value={hours} onChange={(e) => setHours(Number(e.target.value))}><option value={24}>24 horas</option><option value={72}>72 horas</option><option value={168}>7 dias</option></select>
        <button type="button" className="btn-primary" onClick={() => void issue()} disabled={busy}>{busy ? 'Gerando…' : 'Gerar convite (link + QR)'}</button>
        {list && <p className="hp-meta">{list.openInvites} convite(s) em aberto.</p>}
      </div>
      {inv && <div className="rg-qr" aria-live="polite">
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(inv.qrSvg)}`} width={220} height={220} alt="QR code do convite de cadastro" />
        <div><p><b>Link de uso único</b> · válido até {when(inv.expiresAt)}</p><input readOnly value={inv.link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn-secondary" onClick={() => { void navigator.clipboard?.writeText(inv.link).then(() => setCopied(true)); }}>{copied ? 'Copiado' : 'Copiar link'}</button>
          <p className="hp-meta">Envie ao paciente ou mostre o QR na tela. Depois de usado, o link deixa de funcionar.</p></div>
      </div>}
    </div>
    {err && <p className="clin-error" role="alert">{err}</p>}
    <h2>Pendentes de conferência ({pending.length})</h2>
    {list && !pending.length && <p className="hp-empty">Nenhum cadastro aguardando conferência.</p>}
    <div className="rg-cards">{pending.map((r) => <RegCard key={r.id} r={r} onDone={load} />)}</div>
    {!!done.length && <><h2>Conferidos recentemente</h2><div className="rg-cards">{done.slice(0, 20).map((r) => <RegCard key={r.id} r={r} onDone={load} />)}</div></>}
  </section>;
}
