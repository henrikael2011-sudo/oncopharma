'use client';
// M15.4 — estrutura do Clinical: sessão institucional, MFA e vínculo profissional antes de qualquer dado de paciente.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Brand } from '../Brand';
import { DemoTag } from './DemoTag';
import { ClinTile } from './ClinIcons';
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
  // Menu lateral do mockup marca-nova-v3h (Visão geral, Pacientes, Prescrições, Conferência com IA, Pedidos ao médico, Relatórios).
  // Itens sem tela neste PR ficam desabilitados com "em breve" (nada de botão morto).
  const ICON: Record<string, string> = { 'Visão geral': 'hosp', Pacientes: 'bed', 'Prescrições': 'memo', 'Conferência com IA': 'robot', 'Pedidos ao médico': 'mail', 'Painel hospitalar': 'siren', 'Cadastros por convite': 'qr', 'Mensagens do Care': 'msg', 'Relatórios': 'bar' };
  const items: string[][] = me ? [
    ...(me.role === 'pharmacist' ? [['/clinical/visao-geral', 'Visão geral']] : []), ['/clinical/pacientes', 'Pacientes'], ['', 'Prescrições'],
    me.role !== 'physician' ? ['/clinical/conferencia-ia', 'Conferência com IA'] : ['', 'Conferência com IA'],
    me.roles?.includes('physician') ? ['/clinical/solicitacoes', 'Pedidos ao médico'] : ['', 'Pedidos ao médico'],
    ['/clinical/painel', 'Painel hospitalar'], ...(me.role !== 'clinical_manager' ? [['/clinical/cadastros', 'Cadastros por convite']] : []), ['/clinical/mensagens', 'Mensagens do Care'], ['', 'Relatórios']] : [];
  return <div className="clinical-page cv-app">
    {testEnv && <TestEnvBanner />}
    <header className={`clinical-header${me?.role === 'pharmacist' && path === '/clinical/visao-geral' ? ' clinical-header--overview' : ''}`}><Brand variant="clinical" />
      {me && <nav className="clin-nav" aria-label="Seções do Clinical">{items.map(([href, label]) => { const icon = ICON[label];
        if (!href) return <span key={label} className="cv-soon" aria-disabled="true" title="Em breve: tela ainda não disponível nesta versão"><ClinTile name={icon} />{label}<small> · em breve</small></span>;
        const on = path.startsWith(href) || (href === '/clinical/pacientes' && path === '/clinical');
        return <Link key={href} href={href} aria-current={on ? 'page' : undefined}><ClinTile name={icon} />{label}</Link>; })}</nav>}
      {loggedIn && <div className="clin-user">{me && <span>{me.name ? `${me.name} · ` : ''}{me.roleLabel} · MFA confirmado</span>}<form action="/api/auth/logout" method="post"><button type="submit" className="btn-on-dark">Sair</button></form></div>}
    </header>
    <div className="cv-body">
      <div className="cv-top"><DemoTag /></div>
      <main id="conteudo" className="clinical-main">{me?.roles?.includes('physician') && <nav aria-label="Solicitações médicas"><Link href="/clinical/solicitacoes">Solicitações recebidas</Link></nav>}{content}</main>
    </div>
  </div>;
}
