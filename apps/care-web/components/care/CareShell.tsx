'use client';
// M15.2 — estrutura do Care: entrada, vínculo, consentimento e preferências antes de qualquer conteúdo.
// Uma tarefa por tela, linguagem simples, alvos de toque ≥48 px (Plano v3 §4.1).
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TestEnvBanner } from '../TestEnvBanner';
import { care, CareError, type Me } from '../../lib/care-client';
import { Consent } from './Consent';
import { AcceptInvite } from './AcceptInvite';
import { RoleSelector, useRoleIntent } from './RoleSelector';
import { Tile, type IconName } from './Icons';
import { DEMO_TAG } from '../DemoLabels';
export { DEMO_TAG };

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'nolink' } | { kind: 'error'; message: string } | { kind: 'ready'; me: Me };
const Ctx = createContext<{ me: Me; reload: () => Promise<void>; testEnv: boolean } | null>(null);
export const useMe = () => { const v = useContext(Ctx); if (!v) throw Error('CareShell ausente'); return v; };
export const SIGNATURE = 'Um passo de cada vez. Juntos no cuidado.';
// Cuidador vê só o que o paciente liberou (P-R4); gestão de cuidadores e preferências são do paciente.
const NAV: [string, string, (m: Me) => boolean][] = [
  ['/care', 'Início', () => true],
  ['/care/jornada', 'Minha jornada', (m) => m.actor === 'patient' || m.scopes.includes('ver_jornada')],
  ['/care/medicamentos', 'Meus medicamentos', (m) => m.actor === 'patient' || m.scopes.includes('ver_medicamentos')],
  ['/care/ajuda', 'Preciso de ajuda', () => true],
  ['/care/cuidador', 'Cuidador e privacidade', (m) => m.actor === 'patient'],
  ['/care/preferencias', 'Preferências', (m) => m.actor === 'patient'],
];
// M21 — barra inferior de abas (identidade Care mobile aprovada). Mapeada às funções existentes; Equipe e Alertas
// reúnem conteúdo existente (ajuda/contatos, orientações) + exemplos estáticos fictícios rotulados.
export const TABS: [string, string, IconName, (m: Me) => boolean][] = [
  ['/care', 'Início', 'house', () => true],
  ['/care/sintoma', 'Sintomas', 'thermo', (m) => m.actor === 'patient' || m.scopes.includes('registrar_sintoma')],
  ['/care/medicamentos', 'Remédios', 'pill', (m) => m.actor === 'patient' || m.scopes.includes('ver_medicamentos')],
  ['/care/equipe', 'Equipe', 'doctor', () => true],
  ['/care/alertas', 'Alertas', 'bell', () => true],
];
export const TEAM_DECIDES = 'O app só organiza e registra. Sua equipe de saúde avalia e decide.';
export function Skeleton({ label = 'Carregando…' }: { label?: string }) {
  return <div className="cm-sk" role="status" aria-live="polite"><div className="cm-skl"><i />{label}</div><div className="cm-sb h" /><div className="cm-sb w8" /><div className="cm-sb w6" /></div>;
}

export function CareShell({ children, testEnv = false }: { children: React.ReactNode; testEnv?: boolean }) {
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
  if (state.kind === 'loading') content = <Skeleton label="Carregando seus dados…" />;
  else if (state.kind === 'anon') content = <Welcome />;
  else if (state.kind === 'nolink') content = <NoLink onDone={load} />;
  else if (state.kind === 'error') content = <section className="care-panel" role="alert"><h1>Não foi possível abrir agora</h1><p className="care-lead">{state.message}</p><button className="btn-primary" onClick={() => void load()}>Tentar de novo</button></section>;
  else if (!state.me.consent.accepted) content = <Consent version={state.me.consent.required} onDone={load} />;
  else content = <Ctx.Provider value={{ me: state.me, reload: load, testEnv }}>{children}</Ctx.Provider>;
  return <div className="care-page" data-font={me?.preferences.fontScale ?? 'normal'} data-contrast={me?.preferences.highContrast ? 'high' : 'normal'}>
    {testEnv && <TestEnvBanner />}
    <header className="care-header"><div className="cm-head-row"><CareLogo />{me && <p className="cm-who"><b>{me.actor === 'caregiver' ? (me.patientName ?? 'Paciente') : (me.displayName ?? 'Você')}</b>{me.actor === 'caregiver' ? `Cuidador(a): ${me.displayName ?? 'você'}` : 'Paciente'}</p>}{loggedIn && <form action="/api/auth/logout" method="post"><button type="submit" className="btn-on-dark">Sair</button></form>}</div>{testEnv && <span className="cm-demo">{DEMO_TAG}</span>}</header>
    {me?.consent.accepted && <nav className="care-nav" aria-label="Menu principal"><ul>{NAV.filter(([, , ok]) => ok(me)).map(([href, label]) => <li key={href}><Link href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link></li>)}</ul></nav>}
    <main id="conteudo" className="care-main">{content}</main>
    {me?.consent.accepted && <TabBar me={me} path={path} />}
  </div>;
}

function NoLink({ onDone }: { onDone: () => Promise<void> }) {
  const [role, setRole] = useRoleIntent('caregiver');
  return <section className="care-panel"><h1>Seu acesso ainda não foi liberado</h1><p className="care-lead">Sua conta ainda não está ligada a um acompanhamento.</p>
    <RoleSelector role={role} onChange={setRole} />
    {role === 'patient' ? <p className="care-lead">Se você é paciente, fale com a equipe do hospital para liberar o acesso.</p> : <AcceptInvite onDone={onDone} />}</section>;
}

function Welcome() {
  const [role, setRole] = useRoleIntent(null);
  return <section>
    <p className="kicker">ONCOPHARMA Care</p>
    <h1>Seu cuidado, no seu ritmo.</h1>
    <p className="care-signature">{SIGNATURE}</p>
    <p className="care-lead">Registre como você está, acompanhe sua jornada e veja as orientações da sua equipe.</p>
    <RoleSelector role={role} onChange={setRole} />
    {role === 'patient' && <p className="care-lead">Entre com a conta liberada pela equipe do hospital.</p>}
    {role === 'caregiver' && <p className="care-lead">Entre com a sua conta e informe o código de convite que o paciente gerou. Você verá apenas o que ele liberar.</p>}
    <a className="btn-primary btn-large" href="/api/auth/login">Entrar</a>
    <p className="care-note">Em uma emergência, ligue 192 (SAMU).</p>
  </section>;
}

// Logotipo Care dourado (care-gold.svg, aprovado). Brand.tsx canônico segue intacto para os demais apps.
function CareLogo() {
  return <Link href="/care" className="brand" aria-label="ONCOPHARMA Care — página inicial"><img src="/brand/care-gold.svg" width={40} height={40} alt="" /><span><strong>ONCO<span>PHARMA</span></strong><small>CARE</small></span></Link>;
}
function TabBar({ me, path }: { me: Me; path: string }) {
  const tabs = TABS.filter(([, , , ok]) => ok(me));
  return <nav className="cm-tabs" aria-label="Navegação principal"><ul style={{ '--cm-n': tabs.length } as React.CSSProperties}>{tabs.map(([href, label, icon]) => { const on = href === '/care' ? path === href : path.startsWith(href); return <li key={href}><Link href={href} aria-current={on ? 'page' : undefined}><Tile name={icon} gold={on} />{label}</Link></li>; })}</ul></nav>;
}
