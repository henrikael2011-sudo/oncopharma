// M16 — faixa "Ambiente de teste autorizado" só em test/hml e sem cores fora da paleta M14.4.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
for (const [app, d, N] of [['care-web', 'care', 'Care'], ['clinical-web', 'clinical', 'Clinical']]) {
  test(`${app}: faixa de ambiente de teste condicionada a test/hml`, () => {
    const b = fs.readFileSync(`apps/${app}/components/TestEnvBanner.tsx`, 'utf8');
    assert.match(b, /Ambiente de teste autorizado — sem dados reais · não liberado para uso clínico/);
    assert.match(b, /\['test', 'hml'\]\.includes/); assert.doesNotMatch(b, /#[0-9a-f]{3,6}\b/i);
    assert.doesNotMatch(b, /'prod'/);
    const l = fs.readFileSync(`apps/${app}/app/${d}/layout.tsx`, 'utf8'); assert.match(l, /isAuthorizedTestEnv\(process\.env\.ONCO_ENVIRONMENT\)/);
    const s = fs.readFileSync(`apps/${app}/components/${d}/${N}Shell.tsx`, 'utf8'); assert.match(s, /\{testEnv && <TestEnvBanner \/>\}/);
  });
}
