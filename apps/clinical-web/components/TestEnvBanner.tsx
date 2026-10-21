// M16 — faixa de ambiente de teste autorizado (somente ONCO_ENVIRONMENT=test|hml; nunca em prod). Paleta M14.4 (tokens gold).
export const TEST_ENV_BANNER = 'Ambiente de teste autorizado — sem dados reais · não liberado para uso clínico';
export function isAuthorizedTestEnv(env: string | undefined): boolean { return ['test', 'hml'].includes((env || '').trim().toLowerCase()); }
export function TestEnvBanner() {
  return <p role="note" data-testid="test-env-banner" style={{ margin: 0, padding: '8px 16px', background: 'var(--gold-50)', color: 'var(--gold-ink-strong)', borderBottom: '3px solid var(--gold-600)', fontWeight: 700, fontSize: '.95rem', textAlign: 'center' }}>⚠️ {TEST_ENV_BANNER}</p>;
}
