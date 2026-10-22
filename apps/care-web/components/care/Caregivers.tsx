'use client';
// M15.3 — Cuidador e privacidade (P-R4): só o paciente convida; tudo desligado por padrão; prazo até 90 dias;
// revogação imediata; histórico de acessos do cuidador visível ao paciente.
import { useCallback, useEffect, useState } from 'react';
import { care, dateBR, type Scope } from '../../lib/care-client';
type Link = { id: string; name: string | null; scopes: Scope[]; createdAt: string; expiresAt: string; active: boolean; revokedAt: string | null };
type Data = { links: Link[]; invites: { id: string; termDays: number; expiresAt: string }[]; accessLog: { action: string; at: string; name: string | null }[] };
const SCOPES: [Scope, string][] = [['ver_jornada', 'Ver minha jornada (sessões e relatos)'], ['ver_medicamentos', 'Ver meus medicamentos'], ['registrar_sintoma', 'Registrar sintomas por mim']];
const ACTION: Record<string, string> = { 'care.me.read': 'Entrou no aplicativo', 'care.home.read': 'Abriu o início', 'care.journey.read': 'Viu a jornada', 'care.medications.read': 'Viu os medicamentos', 'care.symptom.created': 'Registrou um sintoma', 'care.temperature.created': 'Registrou uma temperatura', 'care.temperature.read': 'Viu as temperaturas' };
const when = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export function Caregivers() {
  const [d, setD] = useState<Data | null>(null), [term, setTerm] = useState(30), [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const load = useCallback(() => care<Data>('me/caregivers').then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); } };
  async function invite(e: React.FormEvent) { e.preventDefault(); setErr(''); try { setCode(await care('me/caregivers/invites', { method: 'POST', body: { termDays: term } })); await load(); } catch (x) { setErr(x instanceof Error ? x.message : 'Erro'); } }
  const toggle = (l: Link, s: Scope, on: boolean) => act(() => care(`me/caregivers/${l.id}/scopes`, { method: 'PUT', body: { scopes: on ? [...l.scopes, s] : l.scopes.filter((x) => x !== s) } }), 'Permissões atualizadas.');
  return <section aria-labelledby="cg-title"><h1 id="cg-title">Cuidador e privacidade</h1>
    <p className="care-lead">Você decide quem acompanha seu cuidado e o que essa pessoa pode ver. Tudo começa desligado.</p>
    {err && <p role="alert">{err}</p>}{msg && <p role="status">{msg}</p>}
    <section className="care-panel" aria-labelledby="cg-inv"><h2 id="cg-inv">Convidar um cuidador</h2>
      {code ? <div className="care-review"><p>Entregue este código pessoalmente à pessoa que vai acompanhar você. Ele vale até {when(code.expiresAt)} e só pode ser usado uma vez.</p><p className="care-code" aria-label="Código de convite">{code.code}</p><button type="button" className="btn-secondary" onClick={() => setCode(null)}>Pronto</button></div>
        : <form className="workflow-form" onSubmit={invite}><fieldset className="choices"><legend>Por quanto tempo?</legend>{[30, 60, 90].map((t) => <label key={t} className="choice"><input type="radio" name="term" checked={term === t} onChange={() => setTerm(t)} /> {t} dias</label>)}</fieldset><button type="submit" className="btn-primary">Criar código de convite</button></form>}
      {d && d.invites.length > 0 && <ul className="care-list">{d.invites.map((i) => <li key={i.id}>Convite pendente ({i.termDays} dias) — vale até {when(i.expiresAt)} <button type="button" className="btn-secondary" onClick={() => void act(() => care(`me/caregivers/invites/${i.id}/cancel`, { method: 'POST', body: {} }), 'Convite cancelado.')}>Cancelar convite</button></li>)}</ul>}
    </section>
    {d && <section className="care-panel" aria-labelledby="cg-list"><h2 id="cg-list">Quem acompanha você</h2>
      {d.links.filter((l) => l.active).length === 0 ? <p>Ninguém por enquanto.</p> : d.links.filter((l) => l.active).map((l) => <article key={l.id} className="care-review" aria-label={`Cuidador ${l.name ?? ''}`}>
        <h3>{l.name ?? 'Cuidador'}</h3><p>Acesso até {dateBR(l.expiresAt)}.</p>
        <fieldset className="choices"><legend>O que {l.name ?? 'essa pessoa'} pode fazer</legend>{SCOPES.map(([k, t]) => <label key={k} className="choice"><input type="checkbox" checked={l.scopes.includes(k)} onChange={(e) => void toggle(l, k, e.target.checked)} /> {t}</label>)}</fieldset>
        <button type="button" className="btn-secondary" onClick={() => void act(() => care(`me/caregivers/${l.id}/revoke`, { method: 'POST', body: {} }), 'Acesso encerrado.')}>Encerrar acesso agora</button>
      </article>)}
      {d.links.some((l) => !l.active) && <p className="care-note">Acessos encerrados: {d.links.filter((l) => !l.active).map((l) => `${l.name ?? 'Cuidador'} (${l.revokedAt ? 'encerrado' : 'prazo vencido'})`).join(', ')}.</p>}
    </section>}
    {d && <section className="care-panel" aria-labelledby="cg-log"><h2 id="cg-log">Histórico de acessos do cuidador</h2>
      {d.accessLog.length ? <ul className="care-list">{d.accessLog.map((e, i) => <li key={i}>{when(e.at)} — {e.name ?? 'Cuidador'}: {ACTION[e.action] ?? 'Acesso'}</li>)}</ul> : <p>Nenhum acesso registrado.</p>}</section>}
  </section>;
}
