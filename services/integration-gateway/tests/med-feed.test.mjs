// M22 — feed de medicações orais do hospital simulado: só orais ativas do prontuário pedido; IV e suspensas ignoradas; somente sintético.
import test from 'node:test'; import assert from 'node:assert/strict';
import { parseFhirOralMedications } from '../src/med-feed.mjs'; import { createHospitalSimulator } from '../simulator/hospital-sim.mjs'; import { createGateway } from '../src/server.mjs';
const sim = createHospitalSimulator();
test('filtra orais ativas do prontuário; ignora IV, suspensas e outro paciente', () => {
  const r = parseFhirOralMedications(sim.medications(), 'PR-10021');
  assert.deepEqual(r.items.map((i) => i.medication), ['Loperamida (fictício)', 'Capecitabina (fictício)']);
  assert.equal(r.skippedNonOral, 1); assert.equal(r.skippedInactive, 1);
  assert.deepEqual(r.items[0].times, ['09:00', '21:00']); assert.equal(r.items[0].route, 'VO'); assert.equal(r.items[0].endDate, '2026-10-28');
  assert.equal(parseFhirOralMedications(sim.medications(), 'PR-10022').items.length, 1);
  assert.throws(() => parseFhirOralMedications({ resourceType: 'Bundle', entry: [] }, 'PR-10021'), /não sintético/);
  assert.throws(() => parseFhirOralMedications(sim.medications(), "x' or 1=1"), /Prontuário/);
});
test('gateway: GET /v1/medications exige token e devolve só sintético', async () => {
  const token = 'x'.repeat(40); const srv = createGateway({ token }).listen(0); await new Promise((r) => srv.once('listening', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    assert.equal((await fetch(`${base}/v1/medications?record=PR-10021`)).status, 401);
    const j = await (await fetch(`${base}/v1/medications?record=PR-10021`, { headers: { authorization: `Bearer ${token}` } })).json();
    assert.equal(j.syntheticOnly, true); assert.equal(j.format, 'fhir_r4'); assert.equal(j.items.length, 2);
  } finally { srv.close(); }
});
