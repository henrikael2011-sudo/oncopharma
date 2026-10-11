// M15.2 — Care do paciente: regras do relato estruturado, R3 (sem identificador de paciente do cliente),
// BFF com lista de rotas permitidas, sem dose/rótulos de teste na interface.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const { assessSymptom, parseSymptomAnswers, URGENT_MESSAGE, CONSENT_TERMS_VERSION } = require('../services/api/dist/care-rules.js');
const base = { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', redFlags: [], description: '', requestId: '0b3c1c9e-4a3f-4e7a-9d1b-2f1d5a0c7e11' };

test('relato estruturado: validação fecha entradas desconhecidas', () => {
  assert.equal(parseSymptomAnswers(base).symptomCode, 'nausea');
  for (const bad of [{ symptomCode: 'x' }, { intensity: 'extrema' }, { onset: 'ontem' }, { redFlags: ['outro'] }, { redFlags: ['febre', 'febre'] }, { requestId: '1' }, { description: 'a'.repeat(1001) }])
    assert.throws(() => parseSymptomAnswers({ ...base, ...bad }), JSON.stringify(bad));
});
test('sinais de alerta, febre ou intensidade forte => prioridade + orientação de procurar atendimento (nunca conduta/dose)', () => {
  assert.equal(assessSymptom(parseSymptomAnswers(base)).urgent, false);
  for (const v of [{ symptomCode: 'fever' }, { redFlags: ['falta_ar'] }, { intensity: 'forte' }]) {
    const a = assessSymptom(parseSymptomAnswers({ ...base, ...v }));
    assert.equal(a.urgent, true); assert.equal(a.patientMessage, URGENT_MESSAGE); assert.match(a.patientMessage, /192/);
    assert.match(a.explanation, /não representa diagnóstico ou conduta/);
  }
  for (const m of [assessSymptom(parseSymptomAnswers(base)).patientMessage, URGENT_MESSAGE]) assert.doesNotMatch(m, /\b(mg|dose|tome|comprimidos?)\b/i);
  assert.match(CONSENT_TERMS_VERSION, /^care-termos-\d{4}-\d{2}$/);
});
test('R3: API do Care não aceita identificador de paciente; rota antiga removida', () => {
  const s = read('services/api/src/care.controller.ts');
  assert.doesNotMatch(s, /:patientId/); assert.match(s, /r\.rowCount !== 1/);
  assert.doesNotMatch(read('services/api/src/workflow.controller.ts'), /@Post\('care\/patients/);
});
test('BFF do Care: somente rotas /me permitidas, CSRF por origem e JSON', async () => {
  const s = read('apps/care-web/lib/care-proxy.ts');
  assert.match(s, /origin!==|origin !== new URL\(configured\)\.origin/); assert.match(s, /415/); assert.match(s, /4096/);
  assert.doesNotMatch(s, /patients\//);
});
function files(dir, out = []) { for (const e of readdirSync(join(root, dir))) { if (['node_modules', '.next', 'api'].includes(e)) continue; const p = join(dir, e); if (statSync(join(root, p)).isDirectory()) files(p, out); else if (e.endsWith('.tsx')) out.push(p); } return out; }
test('interface do Care: sem campo de UUID, sem rótulos de teste/fictício, sem dose', () => {
  for (const f of files('apps/care-web')) {
    const s = read(f).replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    assert.doesNotMatch(s, /(?<!random)UUID|fictíci|sintétic|de teste|\(teste\)|demonstraç/i, f);
    assert.doesNotMatch(s, /dose_value|dose_unit|\bmg\b/, f);
  }
});
