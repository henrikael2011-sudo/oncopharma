import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
test('runtime sem permissões de alteração clínica',()=>{
 const sql=read('infra/migrations/0003_runtime_permissions.sql');
 assert.match(sql,/GRANT SELECT ON organizations, memberships, patients, care_assignments TO oncopharma_app/);
 assert.match(sql,/GRANT INSERT ON audit_events TO oncopharma_app/);
 assert.doesNotMatch(sql,/GRANT (UPDATE|DELETE|TRUNCATE) ON/i);
});
test('reset limitado a dev e sem apagar auditoria',()=>{
 const s=read('infra/scripts/reset-synthetic-dev.sh');
 assert.match(s,/current_database\(\)/);
 assert.match(s,/CONFIRM_SYNTHETIC_RESET/);
 assert.doesNotMatch(s,/DELETE FROM audit_events/);
});
test('login mantém PKCE e cookie HttpOnly',()=>{
 const login=read('apps/portal/app/api/auth/login/route.ts');
 const cb=read('apps/portal/app/api/auth/callback/route.ts');
 assert.match(login,/code_challenge/);
 assert.match(cb,/cookieOptions/);
 assert.match(read('apps/portal/lib/auth.ts'),/httpOnly/);
});
