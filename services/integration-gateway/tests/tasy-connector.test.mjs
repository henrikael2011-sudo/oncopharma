import test from 'node:test'; import assert from 'node:assert/strict';
import { createConnector, VENDORS } from '../src/connectors/index.mjs';
import { loadTasyConfig, tasyDate, tasyToFhirBundle, parseTasyHl7, mapTasyLabResult, DEMO_LABEL } from '../src/connectors/tasy.mjs';
const c = createConnector('tasy', { env: {} });
test('registro de fornecedores inclui tasy e recusa desconhecido', () => { assert.ok(VENDORS.includes('tasy')); assert.throws(() => createConnector('xyz')); });
test('config via env: padrão mock, sem segredo exposto', () => {
  const cfg = loadTasyConfig({ TASY_AUTH_TYPE: 'oauth2', TASY_CLIENT_ID: 'x', TASY_TOKEN_URL: 'https://t.invalid', TASY_CLIENT_SECRET: 's3cr3t', TASY_BASE_URL: 'https://tasy.invalid' });
  assert.equal(cfg.mode, 'mock'); assert.equal(cfg.hasSecret, true); assert.ok(!JSON.stringify(cfg).includes('s3cr3t'));
});
test('config recusa modo real, http e auth inválida', () => {
  assert.throws(() => loadTasyConfig({ TASY_MODE: 'live' })); assert.throws(() => loadTasyConfig({ TASY_BASE_URL: 'http://x' }));
  assert.throws(() => loadTasyConfig({ TASY_AUTH_TYPE: 'magic' })); assert.throws(() => loadTasyConfig({ TASY_AUTH_TYPE: 'oauth2' }));
});
test('datas Tasy dd/mm/aaaa', () => { assert.equal(tasyDate('12/03/1970'), '1970-03-12'); assert.equal(tasyDate('11/10/2026 09:00'), '2026-10-11T09:00:00-03:00'); assert.throws(() => tasyDate('31-02')); });
test('paciente Tasy -> FHIR R4 Bundle (Patient, Encounter, MedicationRequest, Observation)', async () => {
  const b = await c.fetchPatientBundle('PR-10021');
  const types = b.entry.map((e) => e.resource.resourceType);
  assert.deepEqual(types, ['Patient', 'Encounter', 'MedicationRequest', 'MedicationRequest', 'Observation', 'Observation']);
  const [pat, enc, rx1] = b.entry.map((e) => e.resource);
  assert.equal(pat.identifier[0].value, 'PR-10021'); assert.equal(pat.gender, 'female'); assert.equal(pat.meta.tag[0].display, DEMO_LABEL);
  assert.equal(enc.status, 'in-progress'); assert.equal(enc.class.code, 'IMP');
  assert.equal(rx1.status, 'active'); assert.equal(rx1.encounter.reference, `Encounter/${enc.id}`); assert.equal(rx1.dosageInstruction[0].doseAndRate[0].doseQuantity.value, 50);
  const hb = b.entry[4].resource; assert.equal(hb.valueQuantity.value, 11.8); assert.equal(hb.code.coding[0].code, '718-7');
  assert.equal(b.entry[5].resource.status, 'preliminary');
  assert.ok(b.entry.every((e) => e.resource.id.startsWith('syn-tasy-')));
});
test('paciente inexistente e prescrição inválida são rejeitados', async () => {
  await assert.rejects(c.fetchPatientBundle('PR-99999'));
  const p = { paciente: { cd_pessoa_fisica: '1', nr_prontuario: 'PR-1' }, atendimentos: [{ nr_atendimento: '1' }], prescricoes: [{ nr_prescricao: '1', nr_atendimento: '1', itens: [{ cd_material: 'x', qt_dose: -1, cd_unidade_medida: 'mg' }] }] };
  assert.throws(() => tasyToFhirBundle({ ...p, paciente: { cd_pessoa_fisica: '1', nr_prontuario: 'PR-10021' } }), /Dose/);
  assert.throws(() => tasyToFhirBundle({ ...p, paciente: { cd_pessoa_fisica: '1', nr_prontuario: 'P' } }), /Prontuário/);
});
test('resultado não numérico vira valueString', () => { const o = mapTasyLabResult({ nr_seq_resultado: '9', vl_resultado: 'Negativo', dt_coleta: '01/01/2026' }, 'Patient/x'); assert.equal(o.valueString, 'Negativo'); });
test('HL7 Tasy: ADT^A01 e ORM^O01', async () => {
  const [adt, orm] = await c.fetchHl7Feed();
  assert.equal(adt.kind, 'adt'); assert.equal(adt.event, 'A01'); assert.equal(adt.record, 'PR-10021'); assert.equal(adt.room, '303'); assert.equal(adt.encounter, '700101');
  assert.equal(orm.kind, 'orm'); assert.equal(orm.order, '550001'); assert.equal(orm.items.length, 2); assert.deepEqual(orm.items[0], { code: 'SIM-0101', name: 'Medicamento Ficticio A 50 mg', dose: 50, unit: 'mg', route: 'IV' });
});
test('HL7 recusa origem não sintética e evento não suportado', () => {
  assert.throws(() => parseTasyHl7('MSH|^~\\&|TASY|H|O|O|20261011080000||ADT^A01|1|P|2.5\nPID|1||PR-10021'), /sintética/);
  assert.throws(() => parseTasyHl7('MSH|^~\\&|SIMTASY|H|O|O|20261011080000||ORU^R01|1|P|2.5\nPID|1||PR-10021'), /não suportado/);
});
