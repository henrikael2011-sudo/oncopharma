import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('ambientes Care e Clinical existem',()=>{
 assert.ok(existsSync(new URL('../apps/portal/app/care/page.tsx',import.meta.url)));
 assert.ok(existsSync(new URL('../apps/portal/app/clinical/page.tsx',import.meta.url)));
});
test('marca sem símbolo de registro não confirmado',()=>{
 for(const p of ['apps/portal/app/page.tsx','apps/portal/app/care/page.tsx','apps/portal/app/clinical/page.tsx'])assert.ok(!read(p).includes('®'));
});
test('API não expõe prontuários sem controle de acesso',()=>{
 const api=read('services/api/src/module.ts');assert.ok(api.includes('health'));assert.ok(!api.includes('patients'));
});
test('produção não possui seed de pacientes',()=>{
 assert.ok(!existsSync(new URL('../infra/seed.production.sql',import.meta.url)));
});
