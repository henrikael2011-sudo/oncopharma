import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('Care não publica endpoint de revisão clínica',()=>assert.equal(fs.existsSync('apps/care-web/app/api/workflow/patients/[id]/interventions/route.ts'),false));
test('Clinical não publica endpoint de sintomas do paciente',()=>assert.equal(fs.existsSync('apps/clinical-web/app/api/workflow/patients/[id]/symptoms/route.ts'),false));
test('Admin não possui rotas de prontuário',()=>assert.equal(fs.existsSync('apps/admin-web/app/api/clinical'),false));
test('portal legado preservado',()=>assert.ok(fs.existsSync('apps/portal/app/care/page.tsx')));
test('planejamento v3 mantido',()=>assert.ok(fs.readFileSync('docs/product/PLANO_DIRETOR_V3_BASELINE.md','utf8').includes('ONCOPHARMA')));
test('sem marca registrada na assinatura',()=>assert.ok(!fs.readFileSync('packages/design-system/components/Brand.tsx','utf8').includes('®')));
