// M15.1 — fundação: contrato OpenAPI cobre todas as rotas; modo sintético explícito; sem duplicação Care/Clinical.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function routes() {
  const out = [];
  for (const f of readdirSync(new URL('../services/api/src', import.meta.url)).filter((x) => x.endsWith('.ts'))) {
    const s = read('services/api/src/' + f); let base = '';
    for (const line of s.split('\n')) {
      const c = line.match(/@Controller\((?:'([^']*)')?\)/); if (c) base = c[1] || '';
      const m = line.match(/@(Get|Post|Patch|Put|Delete)\((?:'([^']*)')?\)/);
      if (m) out.push([m[1].toLowerCase(), '/' + [base, m[2] || ''].filter(Boolean).join('/').replace(/:([A-Za-z]+)/g, '{$1}')]);
    }
  }
  return out;
}
test('OpenAPI documenta exatamente as rotas da API', () => {
  const spec = JSON.parse(read('services/api/openapi.json'));
  const documented = Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m} ${p}`)).sort();
  const actual = routes().map(([m, p]) => `${m} ${p}`).sort();
  assert.deepEqual(documented, actual);
  for (const [p, ops] of Object.entries(spec.paths)) for (const [m, op] of Object.entries(ops))
    if (!['/health', '/ready'].includes(p)) assert.deepEqual(op.security, [{ oidc: [] }], `${m} ${p} sem segurança`);
});
test('modo sintético: nunca habilita em prod; exige ONCO_ENVIRONMENT conhecido', async () => {
  const src = read('services/api/src/synthetic-mode.ts');
  assert.match(src, /SYNTHETIC_ENVIRONMENTS = \['dev', 'hml', 'test'\]/);
  for (const f of ['services/api/src/workflow.controller.ts', 'services/api/src/clinical.controller.ts', 'apps/clinical-web/lib/workflow-proxy.ts'])
    assert.doesNotMatch(read(f), /NODE_ENV\s*===?\s*'production'\s*\|\|\s*process\.env\.(ALLOW|NEXT_PUBLIC)/, f);
});
test('Care não contém componentes do Clinical e vice-versa (D-002)', () => {
  for (const c of ['ClinicalAccess', 'WorkflowReview', 'SyntheticRecord']) assert.equal(existsSync(new URL(`../apps/care-web/components/${c}.tsx`, import.meta.url)), false, c);
  assert.equal(existsSync(new URL('../apps/clinical-web/components/CareSymptomReport.tsx', import.meta.url)), false);
});
