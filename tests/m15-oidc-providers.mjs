// M15 (D-009): regras de MFA por provedor e identificador estável — com JWT assinado real e JWKS local.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { AuthGuard, mfaSatisfied } = require('../services/api/dist/auth.guard.js');
const ENV = ['OIDC_MFA_AMR', 'OIDC_MFA_ACR', 'OIDC_MFA_ACRS', 'OIDC_SUBJECT_CLAIM', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI'];
const withEnv = (vars, fn) => { const old = Object.fromEntries(ENV.map(k => [k, process.env[k]])); for (const k of ENV) delete process.env[k]; Object.assign(process.env, vars); try { return fn(); } finally { for (const k of ENV) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } } };

test('padrão (IdP de teste Keycloak): otp/mfa aceitos; pwd sozinho recusado', () => withEnv({}, () => {
  assert.equal(mfaSatisfied({ amr: ['otp'] }), true);
  assert.equal(mfaSatisfied({ amr: ['pwd', 'mfa'] }), true);
  assert.equal(mfaSatisfied({ amr: ['pwd'] }), false);
  assert.equal(mfaSatisfied({}), false);
}));

test('Entra ID: OIDC_MFA_AMR=mfa não aceita "otp" (no Entra significa SMS/e-mail)', () => withEnv({ OIDC_MFA_AMR: 'mfa' }, () => {
  assert.equal(mfaSatisfied({ amr: ['pwd', 'mfa'] }), true);
  assert.equal(mfaSatisfied({ amr: ['pwd', 'otp'] }), false);
  assert.equal(mfaSatisfied({ amr: ['pwd', 'rsa'] }), false);
}));

test('Entra ID com Authentication Context: exige acrs=c1 além de amr=mfa', () => withEnv({ OIDC_MFA_AMR: 'mfa', OIDC_MFA_ACRS: 'c1' }, () => {
  assert.equal(mfaSatisfied({ amr: ['pwd', 'mfa'], acrs: ['c1'] }), true);
  assert.equal(mfaSatisfied({ amr: ['pwd', 'mfa'] }), false, 'MFA sem o contexto (ex.: SMS) é recusado');
  assert.equal(mfaSatisfied({ amr: ['pwd'], acrs: ['c1'] }), false);
  assert.equal(mfaSatisfied({ amr: ['pwd', 'mfa'], acrs: ['c2'] }), false);
}));

test('Google Workspace direto (sem amr): MFA nunca é inferido — fail closed', () => withEnv({}, () => {
  assert.equal(mfaSatisfied({ hd: 'instituicao.org.br', email_verified: true }), false);
  assert.equal(withEnv({ OIDC_MFA_AMR: 'none' }, () => mfaSatisfied({ amr: ['mfa'] })), false);
  assert.equal(withEnv({ OIDC_MFA_AMR: '' }, () => mfaSatisfied({ amr: ['otp'] })), true, 'vazio = padrão, não desabilita');
}));

test('AuthGuard: assinatura real; OIDC_SUBJECT_CLAIM=oid usa oid como identificador; ausência do claim => 401', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const server = http.createServer((_q, r) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ keys: [jwk] })); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const iss = 'https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0';
  const sign = (claims) => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(iss).setAudience('api-client-id').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const ctx = (token) => { const req = { headers: { authorization: `Bearer ${token}` } }; return { req, c: { switchToHttp: () => ({ getRequest: () => req }) } }; };
  const vars = { OIDC_ISSUER: iss, OIDC_AUDIENCE: 'api-client-id', OIDC_JWKS_URI: `http://127.0.0.1:${server.address().port}/keys`, OIDC_SUBJECT_CLAIM: 'oid', OIDC_MFA_AMR: 'mfa', OIDC_MFA_ACRS: 'c1' };
  const old = Object.fromEntries(ENV.map(k => [k, process.env[k]])); Object.assign(process.env, vars);
  try {
    const a = ctx(await sign({ sub: 'pareado-por-app', oid: '11111111-2222-3333-4444-555555555555', amr: ['pwd', 'mfa'], acrs: ['c1'] }));
    assert.equal(await new AuthGuard().canActivate(a.c), true);
    assert.equal(a.req.principal.sub, '11111111-2222-3333-4444-555555555555'); assert.equal(a.req.principal.mfa, true);
    const b = ctx(await sign({ sub: 'x', oid: 'y', amr: ['pwd', 'mfa'] }));
    await new AuthGuard().canActivate(b.c); assert.equal(b.req.principal.mfa, false, 'sem acrs=c1 não há MFA');
    const c = ctx(await sign({ sub: 'somente-sub', amr: ['mfa'], acrs: ['c1'] }));
    await assert.rejects(new AuthGuard().canActivate(c.c), /Sujeito ausente/);
  } finally { for (const k of ENV) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } server.close(); }
});
