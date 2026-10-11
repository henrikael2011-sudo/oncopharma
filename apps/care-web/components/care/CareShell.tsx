'use client';
// M15.2 — estrutura do Care: entrada, vínculo, consentimento e preferências antes de qualquer conteúdo.
// Uma tarefa por tela, linguagem simples, alvos de toque ≥48 px (Plano v3 §4.1).
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from '../Brand';
import { care, CareError, type Me } from '../../lib/care-client';
import { Consent } from './Consent';

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'nolink' } | { kind: 'error'; message: string } | { kind: 'ready'; me: Me };
const Ctx = createContext<{ me: Me; reload: () => Promise<void> } | null>(null);
export const useMe = () => { const v = useContext(Ctx); if (!v) throw Error('CareShell ausente'); return v; };
export const SIGNATURE = 'Um passo de cada vez. Juntos no cuidado.';
const NAV = [['/care', 'Início'], ['/care/jornada', 'Minha jornada'], ['/care/medicamentos', 'Meus medicamentos'], ['/care/ajuda', 'Preciso de ajuda'], ['/care/preferencias', 'Preferências']] as const;

export function CareShell({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const path = usePathname();
  const load = useCallback(async () => {
    try { setState({ kind: 'ready', me: await care<Me>('me') }); }
    catch (e) { if (e instanceof CareError && e.status === 401) setState({ kind: 'anon' }); else if (e instanceof CareError && e.status === 403) setState({ kind: 'nolink' }); else setState({ kind: 'error', message: e instanceof Error ? e.message : 'Erro inesperado' }); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const me = state.kind === 'ready' ? state.me : null;
  const loggedIn = state.kind === 'ready' || state.kind === 'nolink';
  let content: React.ReactNode;
  if (state.kind === 'loading') content = <p role="status" className="care-lead">Carregando…</p>;
  else if (state.kind === 'anon') content = <Welcome />;
  else if (state.kind === 'nolink') content = <section className="care-panel"><h1>Seu acesso ainda não foi liberado</h1><p className="care-lead">Sua conta ainda não está ligada a um acompanhamento. Fale com a equipe do hospital para liberar o acesso.</p></section>;
  else if (state.kind === 'error') content = <section className="care-panel" role="alert"><h1>Não foi possível abrir agora</h1><p className="care-lead">{state.message}</p><button className="btn-primary" onClick={() => void load()}>Tentar de novo</button></section>;
  else if (!state.me.consent.accepted) content = <Consent version={state.me.consent.required} onDone={load} />;
  else content = <Ctx.Provider value={{ me: state.me, reload: load }}>{children}</Ctx.Provider>;
  return <div className="care-page" data-font={me?.preferences.fontScale ?? 'normal'} data-contrast={me?.preferences.highContrast ? 'high' : 'normal'}>
    <header className="care-header"><Brand variant="care" />{loggedIn && <form action="/api/auth/logout" method="post"><button type="submit" className="btn-on-dark">Sair</button></form>}</header>
    {me?.consent.accepted && <nav className="care-nav" aria-label="Menu principal"><ul>{NAV.map(([href, label]) => <li key={href}><Link href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link></li>)}</ul></nav>}
    <main id="conteudo" className="care-main">{content}</main>
  </div>;
}

function Welcome() {
  return <section>
    <p className="kicker">ONCOPHARMA Care</p>
    <h1>Seu cuidado, no seu ritmo.</h1>
    <p className="care-signature">{SIGNATURE}</p>
    <p className="care-lead">Registre como você está, acompanhe sua jornada e veja as orientações da sua equipe.</p>
    <a className="btn-primary btn-large" href="/api/auth/login">Entrar</a>
    <p className="care-note">Em uma emergência, ligue 192 (SAMU).</p>
  </section>;
}
