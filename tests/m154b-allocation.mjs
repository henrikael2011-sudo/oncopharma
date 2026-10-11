// M15.4b — adaptadores FHIR R4 / HL7 ADT, hospital simulado, gateway com token de serviço, regras de sincronização e BFF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseFhirLocations, parseHl7Adt } from '../services/integration-gateway/src/location-feed.mjs';
import { createHospitalSimulator } from '../services/integration-gateway/simulator/hospital-sim.mjs';
import { createGateway } from '../services/integration-gateway/src/server.mjs';
const require = createRequire(import.meta.url);
const r = require('../services/api/dist/allocation-rules.js');
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('FHIR R4: só Encounter em andamento com unidade; Location por physicalType; sem dado clínico', () => {
  const sim = createHospitalSimulator(); const items = parseFhirLocations(sim.feed().payload);
  assert.deepEqual(items.map((i) => i.record), ['PR-10021', 'PR-10022', 'PR-10023', 'PR-10025', 'PR-10026', 'PR-99999']);
  assert.deepEqual(items[0], { record: 'PR-10021', unit: 'Oncologia Clínica', floor: '3º andar', room: '301', bed: 'A', ref: 'Encounter/syn-enc-10021', at: '2026-10-11T07:00:00-03:00' });
  assert.ok(!items.some((i) => i.record === 'PR-10024'), 'encounter encerrado não aloca');
  assert.throws(() => parseFhirLocations({ resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Observation', id: 'syn-o1' } }] }), /não permitido/);
  assert.throws(() => parseFhirLocations({ resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Encounter', id: 'real-123' } }] }), /sintético/);
  for (const i of items) assert.deepEqual(Object.keys(i).sort(), ['at', 'bed', 'floor', 'record', 'ref', 'room', 'unit']);
});
test('HL7 v2 ADT A02: PID-3 + PV1-3 (unidade^quarto^leito^…^andar); rejeita origem não sintética e eventos não suportados', () => {
  const sim = createHospitalSimulator(); sim.advance(); const items = parseHl7Adt(sim.feed().payload);
  assert.deepEqual(items.map((i) => `${i.record}:${i.unit}|${i.floor}|${i.room}|${i.bed}`), ['PR-10021:Oncologia Clínica|3º andar|303|A', 'PR-10024:Oncologia Clínica|4º andar|410|B', 'PR-10026:Oncologia Clínica|3º andar|305|A']);
  assert.equal(items[1].at, '2026-10-11T12:15:00-03:00'); assert.equal(items[1].ref, 'HL7/SIM-0002');
  const msg = 'MSH|^~\\&|REALHOSP|X|O|O|20261011120000||ADT^A02|1|P|2.5.1\nPID|1||PR-1^^^X^MR\nPV1|1|I|Onco^1^A';
  assert.throws(() => parseHl7Adt(msg), /não sintética/);
  assert.throws(() => parseHl7Adt(msg.replace('REALHOSP', 'SIMX').replace('ADT^A02', 'ORU^R01')), /não suportado/);
  assert.throws(() => parseHl7Adt(msg.replace('REALHOSP', 'SIMX').replace('PR-1^', 'x; drop^')), /Prontuário inválido/);
});
test('gateway: exige token de serviço (comparação constante), fail-closed sem token, controla fases do simulador', async () => {
  assert.throws(() => createGateway({ token: 'curto' }), /mín\. 32/);
  const token = 'a'.repeat(40), srv = createGateway({ token }).listen(0, '127.0.0.1');
  await new Promise((ok) => srv.once('listening', ok));
  const base = `http://127.0.0.1:${srv.address().port}`, H = { authorization: `Bearer ${token}` };
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/v1/locations`)).status, 401);
    assert.equal((await fetch(`${base}/v1/locations`, { headers: { authorization: `Bearer ${'b'.repeat(40)}` } })).status, 401);
    const f0 = await (await fetch(`${base}/v1/locations`, { headers: H })).json();
    assert.equal(f0.format, 'fhir_r4'); assert.equal(f0.syntheticOnly, true); assert.equal(f0.items.length, 6);
    assert.equal((await (await fetch(`${base}/v1/sim/advance`, { method: 'POST', headers: H })).json()).phase, 1);
    const f1 = await (await fetch(`${base}/v1/locations`, { headers: H })).json(); assert.equal(f1.format, 'hl7v2_adt'); assert.equal(f1.items.length, 3);
    assert.equal((await fetch(`${base}/v1/sim/reset`, { method: 'POST' })).status, 401);
  } finally { srv.close(); }
  assert.match(read('services/integration-gateway/src/server.mjs'), /\['test', 'development'\]\.includes/);
});
test('regras: validação do feed na API, comparação tolerante a caixa/espaço, manual divergente nunca sobrescrito', () => {
  const cur = { unit: 'Oncologia Clínica', floor: '3º andar', room: '306', bed: 'A' };
  assert.equal(r.syncOutcome(null, cur), 'updated');
  assert.equal(r.syncOutcome({ ...cur, source: 'hospital' }, { ...cur, unit: ' oncologia  clínica ' }), 'unchanged');
  assert.equal(r.syncOutcome({ ...cur, source: 'hospital' }, { ...cur, room: '307' }), 'updated');
  assert.equal(r.syncOutcome({ ...cur, source: 'manual' }, cur), 'confirmed');
  assert.equal(r.syncOutcome({ ...cur, source: 'manual' }, { ...cur, floor: '4º andar' }), 'conflict');
  assert.equal(r.allocationLabel({ unit: 'Hospital-Dia', floor: 'Térreo', room: 'Box 04', bed: null }), 'Hospital-Dia · Térreo · Box 04');
  assert.throws(() => r.normalizeAllocation({ unit: 'x' }), /Unidade/); assert.throws(() => r.normalizeAllocation({ unit: 'Onco', bed: 'x'.repeat(21) }), /Leito/);
  assert.deepEqual(r.normalizeAllocation({ unit: '  Onco\u0007  Clínica ', floor: '', room: ' 3 ' }), { unit: 'Onco Clínica', floor: null, room: '3', bed: null });
  const ok = { syntheticOnly: true, source: 'Hospital simulado', format: 'fhir_r4', adapterVersion: 'v', fetchedAt: '2026-10-11T10:00:00Z', items: [{ record: 'PR-1', unit: 'Onco' }] };
  assert.equal(r.validateFeed(ok).items[0].record, 'PR-1');
  assert.throws(() => r.validateFeed({ ...ok, syntheticOnly: false }), /sintética/);
  assert.throws(() => r.validateFeed({ ...ok, items: [{ record: 'PR-1', unit: 'Onco' }, { record: 'PR-1', unit: 'Onco' }] }), /repetido/);
  assert.throws(() => r.validateFeed({ ...ok, format: 'csv' }), /Formato/);
});
test('API/BFF: sincronização devolve só contagens; manual bloqueado quando o hospital informa; rotas fechadas no BFF', () => {
  const s = read('services/api/src/clinical-work.controller.ts');
  const sync = s.slice(s.indexOf("@Post('allocations/sync')"), s.indexOf("@Post('patients/:patientId/allocation')"));
  assert.match(sync, /return \{ runId: run\.id, at: iso\(run\.at\), source: .*received: feed\.items\.length, \.\.\.n \}/);
  assert.doesNotMatch(sync.slice(sync.lastIndexOf('return {')), /display_name|record:/);
  assert.match(sync, /await this\.run\(req, org, async \(\) => null\)/, 'autoriza antes de chamar o gateway');
  assert.match(s, /cur\?\.source === 'hospital'\) throw new ConflictException/);
  for (const k of ['allocation.sync', 'allocation.manual', 'allocation.conflict.resolved']) assert.ok(s.includes(`'${k}'`), k);
  const p = read('apps/clinical-web/lib/work-proxy.ts');
  assert.match(p, /\['POST', \/\^allocations\\\/sync\$\/\]/); assert.match(p, /allocation\(\/conflict\)\?\$/);
});
