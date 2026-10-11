// M15.1: modo sintético explícito (substitui a dependência de NODE_ENV).
// Ambiente vem de ONCO_ENVIRONMENT (dev|hml|test); sem ele, build de produção é tratado como 'prod'.
// Em 'prod' (ou valor desconhecido) o modo sintético NUNCA é habilitado, mesmo com a flag.
export const SYNTHETIC_ENVIRONMENTS = ['dev', 'hml', 'test'];
export function oncoEnvironment(): string {
  return (process.env.ONCO_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'prod' : 'dev')).trim().toLowerCase();
}
export function syntheticApiEnabled(): boolean {
  return process.env.ALLOW_SYNTHETIC_API === 'true' && SYNTHETIC_ENVIRONMENTS.includes(oncoEnvironment());
}
