// M15.1: modo sintético explícito (ver services/api/src/synthetic-mode.ts). Em 'prod' nunca habilita.
const ENVS = ['dev', 'hml', 'test'];
export function oncoEnvironment(): string {
  return (process.env.ONCO_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'prod' : 'dev')).trim().toLowerCase();
}
export function syntheticUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_SYNTHETIC_UI === 'true' && process.env.ALLOW_SYNTHETIC_API === 'true' && ENVS.includes(oncoEnvironment());
}
