import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const f = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
test('endpoints clínicos falham fechados sem habilitação e em produção', () => {
  const s=f('services/api/src/clinical.controller.ts');
  // M15.1: verificação centralizada no helper de modo sintético.
  assert.match(s,/!syntheticApiEnabled\(\)/); const m=f('services/api/src/synthetic-mode.ts'); assert.match(m,/NODE_ENV === 'production' \? 'prod'/); assert.match(m,/ALLOW_SYNTHETIC_API === 'true'/);
  assert.match(s,/req\.principal\.mfa/); assert.match(s,/STAFF\.includes/);
  assert.match(s,/care_assignments/); assert.match(s,/audit_events/);
});
test('JWT usa JWKS remoto, valida issuer, audience e assinatura', () => {
  const s=f('services/api/src/auth.guard.ts');
  assert.match(s,/createRemoteJWKSet/); assert.match(s,/jwtVerify/); assert.match(s,/issuer, audience/);
  assert.doesNotMatch(s,/decodeJwt\(/);
});
test('RLS FORCE e isolamento de transação', () => {
  const sql=f('infra/migrations/0002_identity_and_audit.sql');
  assert.match(sql,/patients FORCE ROW LEVEL SECURITY/); assert.match(sql,/care_assignments FORCE ROW LEVEL SECURITY/);
  const db=f('services/api/src/database.service.ts');
  assert.match(db,/set_config\(\$1, \$2, true\)/); assert.match(db,/COMMIT/); assert.match(db,/ROLLBACK/);
});
test('seed não contém paciente real e usa sub do provedor', () => {
  const s=f('infra/seeds/seed_two_synthetic_patients.sql');
  assert.match(s,/TESTE-FOLFOX-001/); assert.match(s,/TESTE-ACT-002/);
  assert.match(s,/:'oidc_sub'/); assert.doesNotMatch(s,/CPF|telefone|nascimento/i);
});
test('segredos e bancos não estão embutidos no app', () => {
  assert.ok(existsSync(new URL('../.gitignore',import.meta.url)));
  const git=f('.gitignore'); assert.match(git,/\.env/);
  assert.match(f('services/api/src/module.ts'),/clinicalOperationsEnabled: false/);
});
