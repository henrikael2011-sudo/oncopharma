// M14.5 — IdP de TESTE local (Keycloak em modo dev), exclusivamente para validação técnica com contas sintéticas.
// NÃO é o IdP de homologação/produção (decisão D-008 em aberto). Segredos somente por variáveis de ambiente.
// Uso: KC_URL=http://localhost:8080 KC_BOOTSTRAP_ADMIN_USERNAME=... KC_BOOTSTRAP_ADMIN_PASSWORD=... \
//      E2E_USER_PASSWORD=... E2E_STATE_FILE=/caminho/fora/do/repo.json node infra/idp-test/setup-keycloak-test.mjs
import { writeFileSync } from 'node:fs';
const need = (n) => { const v = process.env[n]; if (!v) { console.error(`BLOQUEADO: ${n} ausente`); process.exit(2); } return v; };
if (process.env.NODE_ENV === 'production') { console.error('Proibido em produção'); process.exit(1); }
const KC = need('KC_URL').replace(/\/$/, '');
const REALM = process.env.KC_REALM || 'oncopharma-test';
const USER_PW = need('E2E_USER_PASSWORD');
const STATE = need('E2E_STATE_FILE');
const APPS = { care: 'http://localhost:3001', clinical: 'http://localhost:3002' };
const AUDIENCE = process.env.OIDC_AUDIENCE || 'oncopharma-api';

async function adminToken() {
  const r = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: need('KC_BOOTSTRAP_ADMIN_USERNAME'), password: need('KC_BOOTSTRAP_ADMIN_PASSWORD') }) });
  if (!r.ok) throw new Error(`admin token ${r.status}`); return (await r.json()).access_token;
}
const token = await adminToken();
async function api(method, path, body, okStatuses = [200, 201, 204]) {
  const r = await fetch(`${KC}/admin${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!okStatuses.includes(r.status)) throw new Error(`${method} ${path} -> ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

// Realm novo a cada execução (efêmero). Tokens curtos para permitir teste real de expiração.
await api('DELETE', `/realms/${REALM}`, null, [204, 404]);
await api('POST', '/realms', { realm: REALM, enabled: true, displayName: 'ONCOPHARMA TESTE (sintético)', accessTokenLifespan: Number(process.env.KC_ACCESS_TOKEN_LIFESPAN || 120),
  ssoSessionIdleTimeout: 900, ssoSessionMaxLifespan: 3600, bruteForceProtected: true, failureFactor: 10, registrationAllowed: false, resetPasswordAllowed: false,
  otpPolicyType: 'totp', otpPolicyAlgorithm: 'HmacSHA1', otpPolicyDigits: 6, otpPolicyPeriod: 30, otpPolicyLookAheadWindow: 1, internationalizationEnabled: true, supportedLocales: ['pt-BR'], defaultLocale: 'pt-BR' });

// AMR: referências por autenticador no fluxo browser (pwd / otp) para o claim amr do token de acesso.
const execs = await api('GET', `/realms/${REALM}/authentication/flows/browser/executions`);
for (const [provider, ref] of [['auth-username-password-form', 'pwd'], ['auth-otp-form', 'otp']]) {
  const e = execs.find((x) => x.providerId === provider); if (!e) throw new Error(`execução ${provider} ausente`);
  await api('POST', `/realms/${REALM}/authentication/executions/${e.id}/config`, { alias: `amr-${ref}`, config: { 'default.reference.value': ref, 'default.reference.maxAge': '0' } });
}

const mappers = [
  { name: 'aud-oncopharma-api', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper', config: { 'included.custom.audience': AUDIENCE, 'access.token.claim': 'true', 'id.token.claim': 'false', 'introspection.token.claim': 'true' } },
  { name: 'amr', protocol: 'openid-connect', protocolMapper: 'oidc-amr-mapper', config: { 'access.token.claim': 'true', 'id.token.claim': 'true', 'introspection.token.claim': 'true' } },
];
for (const [app, origin] of Object.entries(APPS)) {
  await api('POST', `/realms/${REALM}/clients`, { clientId: `oncopharma-${app}-web`, name: ({ care: 'ONCOPHARMA Care', clinical: 'ONCOPHARMA Clinical', admin: 'ONCOPHARMA Admin' })[app] || 'ONCOPHARMA', enabled: true, publicClient: true, standardFlowEnabled: true,
    implicitFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false, redirectUris: [`${origin}/api/auth/callback`], webOrigins: [origin], rootUrl: origin,
    attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': `${origin}/` }, protocolMappers: mappers });
}

// Contas 100% sintéticas (domínio .invalid). Profissionais com TOTP obrigatório no primeiro acesso.
const users = [
  ['paciente.a', 'patient', false], ['paciente.b', 'patient', false], ['cuidador.a', 'caregiver', false],
  ['farmaceutico', 'pharmacist', true], ['enfermeira', 'nurse', true], ['medico', 'physician', true],
  ['admin.tecnico', 'technical_admin', true], ['farmaceutico.semmfa', 'pharmacist', false],
];
const state = { realm: REALM, issuer: `${KC}/realms/${REALM}`, users: {} };
for (const [username, role, mfa] of users) {
  await api('POST', `/realms/${REALM}/users`, { username, enabled: true, emailVerified: true, firstName: ({ 'paciente.a': 'Ana', 'paciente.b': 'Bruno', 'cuidador.a': 'Carla' })[username] || 'Sintético', lastName: username.replace('.', ' '), email: `${username}@synthetic.invalid`,
    credentials: [{ type: 'password', value: USER_PW, temporary: false }], requiredActions: mfa ? ['CONFIGURE_TOTP'] : [] });
  const [u] = await api('GET', `/realms/${REALM}/users?exact=true&username=${encodeURIComponent(username)}`);
  state.users[username] = { sub: u.id, role, mfaEnrollment: mfa };
}
writeFileSync(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });
console.log(`Realm ${REALM} pronto: ${Object.keys(state.users).length} contas sintéticas; estado em arquivo fora do repositório.`);
