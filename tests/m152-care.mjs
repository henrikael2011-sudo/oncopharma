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
  assert.doesNotMatch(s, /:patientId/); assert.match(s, /r\.rowCount === 1\) return \{ patientId/); assert.match(s, /r\.rowCount > 1\) throw/); assert.match(s, /c\.rowCount !== 1\) throw/);
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
    // M16: a faixa de ambiente autorizado só renderiza com ONCO_ENVIRONMENT=test|hml (coberta por tests/m16-test-env-banner.test.mjs).
    if (f.endsWith('components/TestEnvBanner.tsx')) continue;
    const s = read(f).replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    assert.doesNotMatch(s, /(?<!random)UUID|fictíci|sintétic|de teste|\(teste\)|demonstraç/i, f);
    assert.doesNotMatch(s, /dose_value|dose_unit|\bmg\b/, f);
  }
});

// ---------- M16 (P1) segurança do paciente ----------
const rules = require('../services/api/dist/care-rules.js');
test('M16 P1-1: mensagens nunca afirmam "equipe avisada"/"enviado à equipe"; urgente manda ligar 192/hospital', () => {
  for (const m of [rules.URGENT_MESSAGE, rules.ROUTINE_MESSAGE]) {
    assert.doesNotMatch(m, /avisad|notificad|enviado (à|a|para a) (sua )?equipe|recebido pela equipe/i, m);
    assert.match(m, /registrado/); assert.match(m, /não é acompanhado em tempo real/); assert.match(m, /192/);
  }
  assert.match(rules.URGENT_MESSAGE, /procure atendimento agora/i); assert.match(rules.URGENT_MESSAGE, /hospital/); assert.match(rules.URGENT_MESSAGE, /SAMU/);
});
test('M16 P1-3: histórico deriva do estado real do alerta; nada vira "recebido/avaliado" sem transição', () => {
  const L = rules.reportStatusLabel;
  assert.equal(L('awaiting_review', false), 'Registrado — aguardando avaliação da equipe');
  assert.match(L('awaiting_review', true), /prioridade, aguardando avaliação/);
  assert.match(L('detected', false), /aguardando avaliação/);
  for (const s of ['in_evaluation', 'referred', 'monitoring']) assert.equal(L(s, false), 'Em avaliação pela equipe');
  for (const s of ['resolved', 'dismissed']) assert.equal(L(s, true), 'Avaliado pela equipe');
  assert.match(L('duplicate', false), /registro repetido/);
  assert.equal(L(null, false), 'Registrado'); assert.equal(L(undefined, true), 'Registrado');
  for (const s of [null, 'detected', 'awaiting_review']) assert.doesNotMatch(L(s, false), /Recebido|Avaliado|Em avaliação/);
  const c = read('services/api/src/care.controller.ts');
  assert.doesNotMatch(c, /REPORT_LABEL|Recebido pela equipe/); assert.match(c, /reportStatusLabel\(r\.alert_status/); assert.match(c, /FROM clinical_alerts a WHERE a\.organization_id=r\.organization_id AND a\.source_report_id=r\.id/);
});
test('M16 P1-2: regra local do Care (cliente) é idêntica à do servidor em todas as combinações', async () => {
  const ts = require('typescript');
  const src = ts.transpileModule(read('apps/care-web/lib/care-urgency.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const local = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const flagsSets = [[], ['febre'], ['falta_ar'], ['sangramento', 'confusao']];
  let n = 0;
  for (const symptomCode of ['nausea', 'neuropathy', 'fever', 'diarrhea', 'fatigue', 'pain', 'mouth', 'other']) for (const intensity of ['leve', 'moderada', 'forte']) for (const redFlags of flagsSets) {
    const server = rules.assessSymptom(rules.parseSymptomAnswers({ ...base, symptomCode, intensity, redFlags })).urgent;
    assert.equal(local.isUrgentLocal({ symptomCode, intensity, redFlags }), server, JSON.stringify({ symptomCode, intensity, redFlags })); n++;
  }
  assert.equal(n, 96);
  assert.match(local.LOCAL_URGENT_TEXT, /192/); assert.match(local.LOCAL_URGENT_TEXT, /hospital/); assert.doesNotMatch(local.LOCAL_URGENT_TEXT, /avisad/i);
  assert.match(local.SEND_FAILED_TEXT, /NÃO foi registrado/);
  const f = read('apps/care-web/components/care/SymptomFlow.tsx');
  assert.match(f, /isUrgentLocal\(\{ symptomCode, intensity, redFlags: flags \}\)/, 'alerta calculado no cliente');
  assert.match(f, /\{urgentNow && <div className="care-panel care-urgent" role="alert"/, 'alerta exibido no fluxo, antes do envio/independente da API');
  assert.match(f, /href="tel:192"/); assert.match(f, /SEND_FAILED_TEXT/); assert.doesNotMatch(f, /Relato enviado/);
  assert.match(f, /useMemo\(\(\) => crypto\.randomUUID\(\), \[\]\)/, 'reenvio usa o mesmo requestId (idempotente)');
});
