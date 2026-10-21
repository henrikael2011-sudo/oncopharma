// M22 — transcrição da prescrição (Clinical) + liberação farmacêutica + Remédios no Care.
// Regras puras, autorização (papel + vínculo), gating da liberação, sincronização (atualização/suspensão), adesão por horário,
// BFF e ausência de dose no Care (Plano v3: "Sem dose ou automedicação sugerida ao paciente").
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const r = (p) => fs.readFileSync(p, 'utf8');
const R = require('../services/api/dist/med-transcription-rules.js');
const ok = { medication: 'Ondansetrona', dose: '1 comprimido', route: 'VO', times: ['20:00', '08:00', '08:00'], frequency: 'De 12 em 12 horas', startDate: '2026-10-20', endDate: '2026-10-30', instructions: 'Tomar com água se houver enjoo.', prescriptionRef: 'Prescrição fictícia 001' };
const ctl = r('services/api/src/med-transcription.controller.ts');
const seg = (a, b) => ctl.slice(ctl.indexOf(a), b ? ctl.indexOf(b) : undefined);
test('regras: validação de campos, horários deduplicados/ordenados, datas e vias', () => {
  const t = R.parseTranscription(ok); assert.deepEqual(t.times, ['08:00', '20:00']); assert.equal(t.endDate, '2026-10-30');
  assert.equal(R.parseTranscription({ ...ok, endDate: '' }).endDate, null);
  for (const bad of [{ medication: 'x' }, { dose: '' }, { route: 'oral' }, { times: [] }, { times: ['8:00'] }, { times: ['24:00'] }, { times: Array.from({ length: 9 }, (_, i) => `0${i}:00`) }, { frequency: '' }, { startDate: '20/10/2026' }, { endDate: '2026-10-01' }, { instructions: '' }, { prescriptionRef: 'a' }])
    assert.throws(() => R.parseTranscription({ ...ok, ...bad }), JSON.stringify(bad));
  assert.throws(() => R.parseDiscontinue({ prescriptionRef: 'Rx 2' }), /Motivo/); assert.equal(R.parseDiscontinue({ prescriptionRef: 'Rx 2', reason: 'Suspensa pelo médico' }).reason, 'Suspensa pelo médico');
  assert.equal(R.activeOn('2026-10-21', '2026-10-20', null), true); assert.equal(R.activeOn('2026-10-19', '2026-10-20', null), false); assert.equal(R.activeOn('2026-10-31', '2026-10-20', '2026-10-30'), false);
});
test('Plano v3: orientações ao paciente não levam dose (quantidade + unidade)', () => {
  for (const s of ['Tomar 8 mg à noite', 'Aplicar 0,5 ml', '2 comprimidos', '10 gotas', '1 cápsula', '100 mcg']) assert.throws(() => R.parseTranscription({ ...ok, instructions: s }), /não podem conter dose/, s);
  assert.doesNotThrow(() => R.parseTranscription({ ...ok, instructions: 'Tomar após o café da manhã.' }));
});
test('autorização: transcrevem farmácia/enfermagem/medicina; só farmácia libera/devolve; MFA, vínculo assistencial e RLS', () => {
  for (const p of ['pharmacist', 'nurse', 'physician']) assert.equal(R.canEnter(p), true);
  assert.equal(R.canEnter('receptionist'), false); assert.equal(R.canRelease('pharmacist'), true);
  for (const p of ['nurse', 'physician', 'receptionist']) assert.equal(R.canRelease(p), false);
  assert.match(ctl, /if \(!req\.principal\.mfa\) throw new ForbiddenException/); assert.match(ctl, /this\.db\.withTenant\(org/);
  for (const [a, b] of [["@Get('patients/:patientId/med-transcriptions')", "@Post('patients/:patientId/med-transcriptions')"], ["@Post('patients/:patientId/med-transcriptions')", "/discontinue')"], ["/discontinue')", "@Post('med-transcriptions/:id/release')"], ["@Post('med-transcriptions/:id/release')", "@Post('med-transcriptions/:id/reject')"], ["@Post('med-transcriptions/:id/reject')"]])
    assert.match(seg(a, b), /await this\.linked\(c, org, req, /, a);
  assert.match(seg("@Post('med-transcriptions/:id/release')", "@Post('med-transcriptions/:id/reject')"), /if \(!canRelease\(s\.role\)\) throw new ForbiddenException/);
  assert.match(seg("@Post('med-transcriptions/:id/reject')"), /if \(!canRelease\(s\.role\)\)/);
  assert.match(seg("@Post('patients/:patientId/med-transcriptions')", "@Post('med-transcriptions/:id/release')"), /if \(!canEnter\(s\.role\)\)/);
  assert.doesNotMatch(ctl, /openai|anthropic|\bllm\b|auto[-_ ]?release/i, 'sem decisão automática');
});
test('gating: entrada nasce pendente; liberação exige confirm:true e status pendente; pedido só é criado na liberação', () => {
  const ins = seg('private async insertVersion', 'private view'); assert.match(ins, /'pending_release'/);
  const rel = seg("@Post('med-transcriptions/:id/release')", "@Post('med-transcriptions/:id/reject')");
  assert.match(rel, /body\?\.confirm !== true/); assert.match(rel, /status !== 'pending_release'/);
  assert.equal((ctl.match(/INSERT INTO clinical_medication_orders/g) || []).length, 1); assert.ok(rel.includes('INSERT INTO clinical_medication_orders'));
  assert.match(rel, /`transcr:\$\{t\.lineage_id\}`/);
  const care = r('services/api/src/care.controller.ts'); assert.match(care, /tr\.status='released'/); assert.match(care, /o\.source_reference NOT LIKE 'transcr:%' OR \(t\.times IS NOT NULL AND t\.start_date<=current_date/);
});
test('sincronização: atualização regrava o pedido; suspensão o encerra; versão anterior substituída; trilha auditada', () => {
  const rel = seg("@Post('med-transcriptions/:id/release')", "@Post('med-transcriptions/:id/reject')");
  assert.match(rel, /UPDATE clinical_medication_orders SET medication=\$1,route=\$2,frequency_text=\$3,status='active'/);
  assert.match(rel, /UPDATE clinical_medication_orders SET status='stopped'/);
  assert.match(rel, /t\.kind === 'discontinue' \? 'discontinued' : 'superseded'/);
  for (const a of ['read', 'entered', 'updated', 'discontinue_entered', 'released', 'rejected']) assert.ok(ctl.includes(`clinical.med_transcription.${a}`) || ctl.includes("`clinical.med_transcription.${kind === 'new' ? 'entered' : 'updated'}`"), a);
  assert.match(seg('/discontinue', "@Post('med-transcriptions"), /ConflictException|status/);
  const cr = seg("@Post('patients/:patientId/med-transcriptions')", '/discontinue'); assert.match(cr, /Já existe uma versão aguardando liberação/); assert.match(cr, /Medicamento suspenso/);
});
test('adesão por horário: só o paciente; horário precisa constar na versão liberada; Care sem dose', () => {
  const care = r('services/api/src/care.controller.ts'); const adh = care.slice(care.indexOf("@Post('me/medications/:orderId/adherence')"));
  assert.match(adh, /need\(s, 'patient'\)/); assert.match(adh, /Horário não consta na orientação liberada/); assert.match(adh, /o\.patient_id=\$3 AND o\.status='active'/);
  assert.match(adh, /scheduled_time\) VALUES/);
  const med = care.slice(care.indexOf("@Get('me/medications')"), care.indexOf("@Post('me/medications")); assert.doesNotMatch(med, /dose_/); assert.match(med, /canReport: s\.actor === 'patient'/);
  const ui = r('apps/care-web/components/care/Medications.tsx'); for (const l of ['Tomei', 'Tomei só parte', 'Não tomei']) assert.ok(ui.includes(l), l);
  assert.doesNotMatch(ui, /\bmg\b|dose_value|dose_unit|\.dose\b/); assert.match(ui, /scheduledTime/);
});
test('BFF: allowlists da Clinical e do Care; OpenAPI documenta as rotas', () => {
  const p = r('apps/clinical-web/lib/work-proxy.ts'); assert.match(p, /med-transcriptions\$/); assert.match(p, /\(release\|reject\)/);
  const o = JSON.parse(r('services/api/openapi.json')); for (const k of ['/clinical/patients/{patientId}/med-transcriptions', '/clinical/med-transcriptions/{id}/release', '/clinical/med-transcriptions/{id}/reject']) assert.ok(Object.keys(o.paths).some((x) => x === k), k);
  const tab = r('apps/clinical-web/components/clinical/MedTranscriptionTab.tsx'); assert.match(tab, /Conferi esta transcrição com a prescrição médica/); assert.match(tab, /Liberar para o paciente/);
});
