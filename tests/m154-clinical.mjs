// M15.4 — Clinical: máquina de estados §5.1 (espelho do trigger), matriz por papel, busca, checklist pré-ciclo, lista mínima, BFF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const r = require('../services/api/dist/clinical-work-rules.js');
test('estados §5.1: grafo idêntico ao trigger da 0011; finais sem saída; sem fechamento por tempo', () => {
  const sql = read('infra/migrations/0011_clinical_worklist.sql');
  for (const [from, tos] of Object.entries(r.TRANSITIONS)) {
    if (!tos.length) { assert.ok(r.FINAL_STATES.includes(from), from); continue; }
    const m = sql.match(new RegExp(`WHEN '${from}' THEN NEW\\.status IN \\(([^)]*)\\)`)); assert.ok(m, from);
    assert.deepEqual(m[1].replace(/'/g, '').split(',').map((x) => x.trim()).sort(), [...tos].sort(), from);
  }
  assert.deepEqual(r.ALERT_STATES.map((s) => r.ALERT_LABEL[s]), ['Detectado', 'Aguardando revisão', 'Em avaliação', 'Encaminhado', 'Em acompanhamento', 'Resolvido', 'Descartado', 'Duplicado']);
  assert.doesNotMatch(read('services/api/src/clinical-work.controller.ts'), /interval|setTimeout|setInterval|cron/i);
});
test('papéis (P-CLIN-1): resolver/descartar/duplicar só farmácia ou medicina; enfermagem avalia, acompanha, encaminha', () => {
  assert.equal(r.canTransition('nurse', 'awaiting_review', 'in_evaluation'), true);
  assert.equal(r.canTransition('nurse', 'in_evaluation', 'referred'), true);
  for (const to of ['dismissed', 'duplicate']) assert.equal(r.canTransition('nurse', 'awaiting_review', to), false);
  assert.equal(r.canTransition('nurse', 'in_evaluation', 'resolved'), false);
  assert.equal(r.canTransition('physician', 'referred', 'resolved'), true);
  assert.equal(r.canTransition('pharmacist', 'awaiting_review', 'resolved'), false, 'não pula etapas');
  assert.equal(r.canTransition('pharmacist', 'resolved', 'in_evaluation'), false, 'final imutável');
  assert.deepEqual(r.allowedTransitions('clinical_manager', 'awaiting_review'), ['in_evaluation']);
  assert.equal(r.primaryRole(['technical_admin', 'patient']), null); assert.equal(r.primaryRole(['nurse', 'pharmacist']), 'pharmacist');
});
test('busca: normaliza acento/caixa, remove curingas, limita tamanho', () => {
  assert.equal(r.normalizeSearch('  Débora  '), 'debora'); assert.equal(r.normalizeSearch('PR-10021'), 'pr-10021');
  assert.equal(r.normalizeSearch('%_'), null); assert.equal(r.normalizeSearch('a'), null); assert.equal(r.normalizeSearch('x'.repeat(61)), null); assert.equal(r.normalizeSearch(['a']), null);
  assert.equal(r.normalizeSearch('ana%'), 'ana');
});
test('pré-ciclo: só disponibilidade; qualquer ausência => "Não é possível concluir"; nunca declara aptidão', () => {
  const base = { cycle: { number: 3, plannedOn: '2026-10-16', protocolCode: 'FOLFOX', protocolApproved: true }, labs: [{ code: 'ANC', label: 'N', collectedAt: '2026-10-09T10:00:00Z', source: 'L1' }, { code: 'PLT', label: 'P', collectedAt: '2026-10-09T10:00:00Z', source: 'L2' }],
    weight: { at: '2026-10-08T12:00:00Z', source: 'W' }, allergies: [{ status: 'active', at: '2026-10-01T00:00:00Z', source: 'A' }], reconciliation: { status: 'reviewed', at: '2026-10-10T00:00:00Z', source: 'R' } };
  const ok = r.preCycleChecklist(base); assert.equal(ok.conclusion, 'data_available'); assert.match(ok.message, /não declara aptidão/); assert.equal(ok.automaticDecision, false);
  const old = r.preCycleChecklist({ ...base, labs: [{ ...base.labs[0], collectedAt: '2026-10-01T10:00:00Z' }, base.labs[1]] });
  assert.deepEqual(old.missing, ['LAB_ANC']); assert.match(old.message, /^Não é possível concluir/);
  const none = r.preCycleChecklist({ cycle: null, labs: [], weight: null, allergies: [{ status: 'unconfirmed', at: '2026-10-01T00:00:00Z', source: 'A' }], reconciliation: null });
  assert.equal(none.missing.length, 7); assert.doesNotMatch(JSON.stringify([ok, old, none]), /\bapto\b|seguro para/i);
});
test('lista mínima: SELECT da worklist não traz campos clínicos; intervenção só farmácia; lista sem vínculo vazia', () => {
  const s = read('services/api/src/clinical-work.controller.ts');
  const wl = s.slice(s.indexOf("@Get('worklist')"), s.indexOf("@Get('patients/:patientId')"));
  for (const f of ['explanation', 'description', 'medication', 'analyte', 'symptom_code', 'external_reference']) assert.doesNotMatch(wl, new RegExp(f), f);
  assert.match(wl, /patients: rows\.map\(\(r\) => \(\{ id: r\.id, name: .*record: r\.hospital_record, severity: .*pending: /);
  assert.match(wl, /care_assignments ca/); assert.doesNotMatch(wl, /Forbidden/);
  assert.match(read('services/api/src/workflow.controller.ts'), /checkStaff\(req,org,patientId,\['pharmacist'\]\)/);
  for (const k of ['patient.overview.read', 'patient.timeline.read', 'patient.precycle.read', 'alert.transition', 'task.received', 'task.completed', 'precycle.reviewed']) assert.ok(s.includes(`'${k}'`), k);
});
test('BFF do Clinical: lista fechada de rotas, CSRF por origem, só "q" repassado', async () => {
  const s = read('apps/clinical-web/lib/work-proxy.ts');
  assert.match(s, /origin !== new URL\(configured\)\.origin/); assert.match(s, /path === 'worklist' && q/); assert.match(s, /415/);
  assert.doesNotMatch(s, /\['(DELETE|PUT)'/);
});
test('interface do Clinical: sem rótulos de teste/fictício e sem versões antigas', () => {
  for (const f of ['ClinicalShell', 'Worklist', 'PatientView', 'AlertsTab', 'TasksTab', 'PreCycleTab', 'TimelineTab', 'RecordTab']) {
    const s = read(`apps/clinical-web/components/clinical/${f}.tsx`);
    assert.doesNotMatch(s, /fict[ií]ci|\bteste\b|TESTE-|M1[0-4]\.\d/i, f);
  }
});
test('IdP de teste: referência AMR válida durante a sessão (regressão maxAge=0)', () => {
  const s = read('infra/idp-test/setup-keycloak-test.mjs');
  assert.match(s, /AMR_MAX_AGE = 900/); assert.match(s, /'default\.reference\.maxAge': String\(AMR_MAX_AGE\)/); assert.doesNotMatch(s, /'default\.reference\.maxAge': '0'/);
  assert.match(read('tests/e2e/m145-flow.spec.mjs'), /delayCallbackMs: 2500/);
});
