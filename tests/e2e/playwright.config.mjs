// M14.5 — E2E real: API NestJS + PostgreSQL (role restrita) + care-web + clinical-web + admin-web + IdP de teste.
// Fail-closed: sem as variáveis abaixo, a suíte não roda (BLOQUEADO), nunca "passa" vazia.
import { defineConfig } from '@playwright/test';
const required = ['DATABASE_URL', 'DATABASE_URL_ADMIN', 'E2E_STATE_FILE', 'E2E_USER_PASSWORD', 'E2E_SESSION_KEY', 'KC_URL', 'INTEGRATION_GATEWAY_TOKEN', 'IMPORT_ENCRYPTION_KEY'];
const missing = required.filter((n) => !process.env[n]);
if (missing.length) { console.error(`BLOQUEADO: variáveis ausentes para E2E: ${missing.join(', ')}`); process.exit(2); }
const KC = process.env.KC_URL.replace(/\/$/, '');
const REALM = process.env.KC_REALM || 'oncopharma-test';
const ISSUER = `${KC}/realms/${REALM}`;
const ORG = '11111111-1111-4111-8111-111111111111';
const GATEWAY = 'http://127.0.0.1:4310';
const common = { NODE_ENV: 'development', ONCO_ENVIRONMENT: 'test', NEXT_TELEMETRY_DISABLED: '1', ALLOW_SYNTHETIC_API: 'true', NEXT_PUBLIC_ALLOW_SYNTHETIC_UI: 'true', DEV_ORGANIZATION_ID: ORG,
  API_INTERNAL_URL: 'http://127.0.0.1:4000', SESSION_ENCRYPTION_KEY: process.env.E2E_SESSION_KEY, OIDC_ISSUER: ISSUER,
  OIDC_AUTHORIZATION_ENDPOINT: `${ISSUER}/protocol/openid-connect/auth`, OIDC_TOKEN_ENDPOINT: `${ISSUER}/protocol/openid-connect/token`, OIDC_END_SESSION_ENDPOINT: `${ISSUER}/protocol/openid-connect/logout`, OIDC_JWKS_URI: `${ISSUER}/protocol/openid-connect/certs`, OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'oncopharma-api', PATH: process.env.PATH };
const app = (name, port, extra = {}, cmd = 'dev') => ({
  command: `node ../../node_modules/next/dist/bin/next ${cmd} -p ${port}`, cwd: `apps/${name}`, url: `http://localhost:${port}/`, timeout: 180_000, reuseExistingServer: false,
  stdout: 'pipe', stderr: 'pipe', env: { ...common, PORTAL_ORIGIN: `http://localhost:${port}`, ...extra } });
export default defineConfig({
  testDir: '.', testMatch: /.*\.spec\.mjs/, timeout: 240_000, workers: 1, fullyParallel: false, retries: 0,
  outputDir: '../../artifacts/validation/m14_5/playwright-output',
  reporter: [['list'], ['json', { outputFile: '../../artifacts/validation/m14_5/e2e-results.json' }]],
  use: { launchOptions: { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] }, headless: true,
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', video: 'retain-on-failure', trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 30_000, navigationTimeout: 90_000 },
  webServer: [
    { command: 'node services/api/dist/main.js', cwd: '../..', url: 'http://127.0.0.1:4000/v1/health', timeout: 60_000, reuseExistingServer: false, stdout: 'pipe', stderr: 'pipe',
      env: { NODE_ENV: 'test', ONCO_ENVIRONMENT: 'test', PORT: '4000', ALLOW_SYNTHETIC_API: 'true', DATABASE_URL: process.env.DATABASE_URL, OIDC_ISSUER: ISSUER, OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'oncopharma-api',
        OIDC_JWKS_URI: `${ISSUER}/protocol/openid-connect/certs`, INTEGRATION_GATEWAY_URL: GATEWAY, INTEGRATION_GATEWAY_TOKEN: process.env.INTEGRATION_GATEWAY_TOKEN, IMPORT_ENCRYPTION_KEY: process.env.IMPORT_ENCRYPTION_KEY, PATH: process.env.PATH } },
    // M15.4b — integration-gateway com hospital simulado (somente sintético).
    { command: 'node services/integration-gateway/src/server.mjs', cwd: '../..', url: `${GATEWAY}/health`, timeout: 30_000, reuseExistingServer: false, stdout: 'pipe', stderr: 'pipe',
      env: { ONCO_ENVIRONMENT: 'test', GATEWAY_PORT: '4310', INTEGRATION_GATEWAY_TOKEN: process.env.INTEGRATION_GATEWAY_TOKEN, PATH: process.env.PATH } },
    app('care-web', 3001, { OIDC_CLIENT_ID: 'oncopharma-care-web' }),
    app('clinical-web', 3002, { OIDC_CLIENT_ID: 'oncopharma-clinical-web' }),
    app('admin-web', 3003, { NODE_ENV: 'production' }, 'start'),
  ].map((s) => ({ ...s, cwd: s.cwd.startsWith('apps/') ? `../../${s.cwd}` : s.cwd })),
});
