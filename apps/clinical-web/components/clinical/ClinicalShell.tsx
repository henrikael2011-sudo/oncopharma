'use client';
// M15.4 — estrutura do Clinical: sessão institucional, MFA e vínculo profissional antes de qualquer dado de paciente.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Brand } from '../Brand';
import { DemoTag } from './DemoTag';
import { TestEnvBanner } from '../TestEnvBanner';
import { work, WorkError, type StaffMe } from '../../lib/work-client';

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'nomfa' } | { kind: 'norole' } | { kind: 'error'; message: string } | { kind: 'ready'; me: StaffMe };
const Ctx = createContext<StaffMe | null>(null);
export const useStaff = () => { const v = useContext(Ctx); if (!v) throw Error('ClinicalShell ausente'); return v; };

export function ClinicalShell({ children, testEnv = false }: { children: React.ReactNode; testEnv?: boolean }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const path = usePathname() || '/clinical';
  const load = useCallback(async () => {
    try { setState({ kind: 'ready', me: await work<StaffMe>('me') }); }
    catch (e) {
      if (e instanceof WorkError && e.status === 401) setState({ kind: 'anon' });
      else if (e instanceof WorkError && e.status === 403) setState({ kind: /MFA/.test(e.message) ? 'nomfa' : 'norole' });
      else setState({ kind: 'error', message: e instanceof Error ? e.message : 'Erro inesperado' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const me = state.kind === 'ready' ? state.me : null;
  const loggedIn = !['loading', 'anon'].includes(state.kind);
  let content: React.ReactNode;
  if (state.kind === 'loading') content = <p role="status">Carregando…</p>;
  else if (state.kind === 'anon') content = <section className="clin-intro"><p className="kicker">Ambiente profissional</p><h1>ONCOPHARMA Clinical</h1>
    <p className="clin-lead">Acompanhamento oncológico multiprofissional: pacientes vinculados, alertas, tarefas e pré-ciclo, com cada ação registrada.</p>
    <a className="btn-primary" href="/api/auth/login">Entrar com identidade institucional</a></section>;
  else if (state.kind === 'nomfa') content = <section className="clin-card" role="alert"><h1>Confirme o login com o aplicativo autenticador</h1><p>Seu login não comprovou autenticação em dois fatores (MFA). O acesso a pacientes exige o aplicativo autenticador.</p><p>Se você acabou de cadastrar o aplicativo, confirme uma vez com o código de 6 dígitos.</p><a className="btn-primary" href="/api/auth/login?mfa=1">Confirmar com o código do aplicativo</a></section>;
  else if (state.kind === 'norole') content = <section className="clin-card" role="alert"><h1>Seu perfil não tem acesso clínico</h1><p>O acesso a pacientes depende de vínculo profissional ativo (farmácia, medicina, enfermagem ou gestão clínica) nesta instituição.</p></section>;
  else if (state.kind === 'error') content = <section className="clin-card" role="alert"><h1>Não foi possível abrir agora</h1><p>{state.message}</p><button className="btn-primary" onClick={() => void load()}>Tentar de novo</button></section>;
  else content = <Ctx.Provider value={state.me}>{children}</Ctx.Provider>;
  return <div className="clinical-page">
    {testEnv && <TestEnvBanner />}
    <header className="clinical-header"><Brand variant="clinical" />
      {me && <nav className="clin-nav" aria-label="Seções do Clinical">{[
        ...(me.role === 'pharmacist' ? [['/clinical', 'Visão geral']] : []), ['/clinical/pacientes', 'Pacientes'],
        ...(me.role !== 'physician' ? [['/clinical/conferencia-ia', 'Conferência com IA']] : []),
        ...(me.roles?.includes('physician') ? [['/clinical/solicitacoes', 'Pedidos ao médico']] : [])].map(([href, label]) => {
        const on = href === '/clinical' ? path === '/clinical' : path.startsWith(href) || (href === '/clinical/pacientes' && me.role !== 'pharmacist' && path === '/clinical');
        return <Link key={href} href={href} aria-current={on ? 'page' : undefined}>{label}</Link>; })}</nav>}
      <DemoTag />
      {loggedIn && <div className="clin-user">{me && <span>{me.name ? `${me.name} · ` : ''}{me.roleLabel} · MFA confirmado</span>}<form action="/api/auth/logout" method="post"><button type="submit" className="btn-on-dark">Sair</button></form></div>}
    </header>
    <main id="conteudo" className="clinical-main">{me?.roles?.includes('physician') && <nav aria-label="Solicitações médicas"><Link href="/clinical/solicitacoes">Solicitações recebidas</Link></nav>}{content}</main>
  </div>;
}
