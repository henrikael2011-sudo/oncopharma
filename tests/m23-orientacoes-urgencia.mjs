// M23 — cada alerta do Care exibe seu texto (paciente e cuidador), sem nova regra/limiar, sem dose.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const ts = require('typescript');
const src = fs.readFileSync('apps/care-web/lib/care-guidance.ts', 'utf8');
const mod = { exports: {} }; new Function('module', 'exports', ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod, mod.exports);
const G = mod.exports; const R = require('../services/api/dist/care-rules.js');
const keys = ['febre', 'falta_ar', 'sangramento', 'nao_bebe', 'confusao', 'forte'];
test('toda orientação tem título, texto ao paciente e ao cuidador, fonte; sem dose/palavra proibida', () => {
  assert.deepEqual(Object.keys(G.ALERT_GUIDANCE).sort(), [...keys].sort());
  for (const g of [...Object.values(G.ALERT_GUIDANCE), G.ROUTINE_GUIDANCE]) {
    for (const f of ['title', 'patient', 'caregiver', 'source']) assert.ok(g[f]?.length > 5, f);
    const t = `${g.title} ${g.patient} ${g.caregiver}`; assert.doesNotMatch(t, /fict|\bmg\b|\bml\b|dose|comprimido/i); assert.doesNotMatch(t, /equipe foi avisada|diagn/i);
    assert.match(g.source, /care-rules\.ts:\d+/);
  }
  for (const k of keys.filter((k) => k !== 'forte')) assert.ok(k in R.RED_FLAGS, `${k} existe em RED_FLAGS`);
  assert.match(G.ALERT_GUIDANCE.febre.patient, /37,8 °C/); assert.equal(G.FEVER_THRESHOLD_C, R.FEVER_THRESHOLD_C);
  assert.doesNotMatch(JSON.stringify(G.ALERT_GUIDANCE), /axilar|calafrio/i); // LACUNAS não entram
});
test('cada gatilho do servidor escolhe o seu texto; rotina não tem alerta (mesma regra de assessSymptom)', () => {
  const base = { symptomCode: 'pain', intensity: 'leve', redFlags: [] };
  for (const f of Object.keys(R.RED_FLAGS)) { const a = { ...base, redFlags: [f] }; assert.deepEqual(G.alertKeys(a), [f]); assert.equal(R.assessSymptom({ ...a, onset: 'hoje', description: '', requestId: 'x' }).urgent, true); }
  assert.deepEqual(G.alertKeys({ ...base, symptomCode: 'fever' }), ['febre']);
  assert.deepEqual(G.alertKeys({ ...base, intensity: 'forte' }), ['forte']);
  for (const s of Object.keys(R.SYMPTOMS)) for (const i of R.INTENSITY) for (const fl of [[], ['falta_ar']]) {
    const a = { symptomCode: s, intensity: i, redFlags: fl };
    assert.equal(G.alertKeys(a).length > 0, R.assessSymptom({ ...a, onset: 'hoje', description: '', requestId: 'x' }).urgent, JSON.stringify(a));
  }
});
test('telas exibem as orientações: sintoma (aviso local e resultado), temperatura, cuidador × paciente', () => {
  const sf = fs.readFileSync('apps/care-web/components/care/SymptomFlow.tsx', 'utf8'), tc = fs.readFileSync('apps/care-web/components/care/TempChart.tsx', 'utf8'), li = fs.readFileSync('apps/care-web/components/care/AlertGuidanceList.tsx', 'utf8');
  assert.equal((sf.match(/<AlertGuidanceList keys=\{keys\} caregiver=\{!!who\} \/>/g) || []).length, 2);
  assert.match(sf, /ROUTINE_GUIDANCE\.caregiver : ROUTINE_GUIDANCE\.patient/);
  assert.match(tc, /<AlertGuidanceList keys=\{\['febre'\]\} caregiver=\{me\.actor === 'caregiver'\} \/>/);
  assert.match(li, /caregiver \? ALERT_GUIDANCE\[k\]\.caregiver : ALERT_GUIDANCE\[k\]\.patient/);
  assert.match(sf, /LOCAL_URGENT_TEXT/); assert.match(tc, /LOCAL_URGENT_TEXT/); // texto vigente mantido
});
