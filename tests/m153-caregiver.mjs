// M15.3 — cuidador (P-R4): código de convite, escopos fechados, gestão só pelo paciente, BFF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const r = require('../services/api/dist/caregiver-rules.js');
const { CareController } = require('../services/api/dist/care.controller.js');
test('código: 12 símbolos sem ambíguos (60 bits), normalização e hash estável sem guardar o código', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) { const c = r.newInviteCode(); assert.match(c, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/); seen.add(c); }
  assert.equal(seen.size, 500);
  const c = r.newInviteCode();
  assert.equal(r.hashInviteCode(c), r.hashInviteCode(c.toLowerCase().replace(/-/g, ' ')));
  assert.match(r.hashInviteCode(c), /^[0-9a-f]{64}$/); assert.ok(!r.hashInviteCode(c).includes(c.replace(/-/g, '')));
  for (const bad of ['', 'ABCD', 'ABCD-EFGH-IJK1', 'O0O0-I1I1-ABCD', 123, null]) assert.equal(r.normalizeInviteCode(bad), null, String(bad));
  assert.deepEqual(r.TERM_OPTIONS, [30, 60, 90]); assert.deepEqual([...r.CAREGIVER_SCOPES], ['ver_jornada', 'ver_medicamentos', 'registrar_sintoma']);
});
test('escopos: paciente tem tudo; cuidador só o concedido; ações do paciente negadas ao cuidador', () => {
  const p = { actor: 'patient', scopes: [...r.CAREGIVER_SCOPES], patientId: 'x' };
  const cg = { actor: 'caregiver', scopes: ['ver_jornada'], patientId: 'x', linkId: 'l' };
  for (const s of ['patient', 'ver_jornada', 'ver_medicamentos', 'registrar_sintoma']) assert.doesNotThrow(() => CareController.need(p, s));
  assert.doesNotThrow(() => CareController.need(cg, 'ver_jornada'));
  for (const s of ['patient', 'ver_medicamentos', 'registrar_sintoma']) assert.throws(() => CareController.need(cg, s), /Sem permissão/);
  assert.throws(() => CareController.need({ ...cg, scopes: [] }, 'ver_jornada'));
});
test('controlador: gestão de cuidadores exige paciente; aceite com recusa auditada em transação própria; adesão só do paciente', () => {
  const s = read('services/api/src/care.controller.ts');
  for (const m of ['caregivers(', 'invite(', 'cancelInvite(', 'scopes(', 'revoke(']) { const i = s.indexOf(`  ${m}`) >= 0 ? s.indexOf(`  ${m}`) : s.indexOf(m); assert.ok(i > 0, m); assert.match(s.slice(i, i + 900), /CareController\.need\(s, 'patient'\)/, m); }
  assert.match(s, /care\.caregiver\.invite\.rejected/); assert.match(s, /'denied' in out/);
  assert.match(s, /scopes,expires_at,consent_accepted_at\) VALUES\(\$1,\$2,\$3,\$4,\$5,\$6,\$7,'\{\}'/, 'vínculo nasce sem permissões');
  assert.match(s, /CareController\.need\(s, 'patient'\); \/\/ adesão/);
});
test('BFF permite só as rotas do cuidador previstas', () => {
  const s = read('apps/care-web/lib/care-proxy.ts');
  for (const x of ['me\\/caregivers$', 'caregiver\\/accept$', '\\/revoke$', '\\/scopes$']) assert.ok(s.includes(x), x);
});
test('histórico do cuidador: ação sempre no padrão care.* aceito pelo CHECK da 0010', () => { assert.match(read('services/api/src/care.controller.ts'), /action\.startsWith\('care\.'\) \? action : `care\.\$\{action\}`/); assert.match(read('apps/care-web/components/care/Caregivers.tsx'), /'care\.symptom\.created'/); });
