import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('CI usa banco DEV permitido pelas migrações',()=>{ const y=read('.github/workflows/quality.yml'); assert.match(y,/POSTGRES_DB: oncopharma_dev/); assert.doesNotMatch(y,/oncopharma_ci/); });
test('CI provisiona role antes do teste real de RLS',()=>{const y=read('.github/workflows/quality.yml'); assert.ok(y.indexOf('bootstrap-ci-db.sh')<y.indexOf('npm run test:db:required'));assert.ok(y.includes('DATABASE_URL: postgres://oncopharma_app:'));assert.match(y,/secrets.ONCO_CI_DB_APP_PASSWORD/);});
test('migração inclui política INSERT de auditoria com tenant',()=>{const s=read('infra/migrations/0003_runtime_permissions.sql');assert.match(s,/CREATE POLICY audit_events_insert_tenant/);assert.match(s,/FOR INSERT/);assert.match(s,/organization_id = nullif/);});
test('testes obrigatórios recusam conexão administrativa',()=>{assert.match(read('tests/require-postgres.mjs'),/role.stdout.trim\(\)!=='oncopharma_app'/);});
test('bootstrap exige ambiente test e não usa seeds',()=>{const s=read('infra/scripts/bootstrap-ci-db.sh');assert.match(s,/NODE_ENV:-/);assert.match(s,/oncopharma_dev/);assert.doesNotMatch(s,/seed-dev\.sh/);});
