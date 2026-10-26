// M21.2 — temperatura no Care: validação, limiar aprovado 37,8 °C pelo caminho existente (assessSymptom/RED_FLAGS.febre),
// cifra em repouso, autorização (R3: paciente pela identidade; cuidador só com permissão), BFF e dados do gráfico.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const r = (p) => fs.readFileSync(p, 'utf8');
const R = require('../services/api/dist/care-rules.js'); const C = require('../services/api/dist/care-crypto.js');
const ID = '0b3c1c9e-4a3f-4e7a-9d1b-2f1d5a0c7e11';
test('validação: faixa 34,0–43,0, uma casa decimal, vírgula aceita, requestId UUID, horário plausível', () => {
  assert.equal(R.parseTemperature({ celsius: 37.8, requestId: ID }).celsius, 37.8);
  assert.equal(R.parseTemperature({ celsius: '36,9', requestId: ID }).celsius, 36.9);
  assert.equal(R.parseTemperature({ celsius: 34, requestId: ID }).celsius, 34); assert.equal(R.parseTemperature({ celsius: 43, requestId: ID }).celsius, 43);
  for (const bad of [{ celsius: 33.9 }, { celsius: 43.1 }, { celsius: 37.85 }, { celsius: 'abc' }, { celsius: null }, { celsius: '37.8.1' }, { celsius: NaN }, { requestId: 'x' }, { measuredAt: 'ontem' }, { measuredAt: new Date(Date.now() + 3600e3).toISOString() }, { measuredAt: new Date(Date.now() - 8 * 86400e3).toISOString() }])
    assert.throws(() => R.parseTemperature({ celsius: 37, requestId: ID, ...bad }), JSON.stringify(bad));
});
test('limiar aprovado: >= 37,8 °C => mesma regra do sinal "febre" (urgente, 192, sem texto novo); 37,7 não', () => {
  assert.equal(R.FEVER_THRESHOLD_C, 37.8); assert.equal(R.RED_FLAGS.febre, 'Febre (37,8 °C ou mais)');
  assert.equal(R.isFever(37.7), false); assert.equal(R.isFever(37.8), true); assert.equal(R.isFever(39.2), true);
  const a = R.assessSymptom(R.temperatureAsSymptom(R.parseTemperature({ celsius: 37.8, requestId: ID })));
  assert.equal(a.urgent, true); assert.equal(a.patientMessage, R.URGENT_MESSAGE); assert.match(a.patientMessage, /192/); assert.equal(a.ruleVersion, 'care-demo-v1');
  assert.deepEqual(R.temperatureAsSymptom({ celsius: 38, measuredAt: new Date(), requestId: ID }).redFlags, ['febre']);
  const s = r('services/api/src/care.controller.ts');
  assert.match(s, /INSERT INTO clinical_alerts\(.*'symptom\.fever'/s); assert.match(s, /message: a \? a\.patientMessage : ROUTINE_MESSAGE/);
});
test('cifra em repouso AES-256-GCM, fail-closed sem chave; valor nunca vai para a auditoria', () => {
  const old = process.env.CARE_ENCRYPTION_KEY; delete process.env.CARE_ENCRYPTION_KEY; assert.throws(() => C.careKey());
  process.env.CARE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64'); const k = C.careKey();
  const e = C.sealText('37.8', k.key); assert.notEqual(e.ciphertext.toString(), '37.8'); assert.equal(C.openText(e, k.key), '37.8');
  e.tag[0] ^= 1; assert.throws(() => C.openText(e, k.key)); if (old === undefined) delete process.env.CARE_ENCRYPTION_KEY; else process.env.CARE_ENCRYPTION_KEY = old;
  const s = r('services/api/src/care.controller.ts'); assert.match(s, /'care\.temperature\.created', s, \{ reading_id: r\.rows\[0\]\.id, urgent: String\(fever\) \}/);
  const m = r('infra/migrations/0016_care_temperature.sql'); assert.match(m, /value_encrypted bytea NOT NULL/); assert.doesNotMatch(m, /celsius|numeric/);
  assert.match(m, /FORCE ROW LEVEL SECURITY/); assert.match(m, /GRANT SELECT, INSERT ON patient_temperature_readings TO oncopharma_app;/); assert.doesNotMatch(m, /GRANT[^;]*(UPDATE|DELETE)[^;]*patient_temperature/);
});
test('autorização: paciente resolvido pela identidade (sem id do cliente); cuidador precisa de registrar_sintoma para gravar', () => {
  const s = r('services/api/src/care.controller.ts');
  const post = s.slice(s.indexOf("@Post('me/temperatures')"), s.indexOf("@Get('me/temperatures')")); const get = s.slice(s.indexOf("@Get('me/temperatures')"), s.indexOf('// ---------- M15.3'));
  assert.match(post, /CareController\.need\(s, 'registrar_sintoma'\)/); assert.match(post, /this\.run\(req, org/); assert.doesNotMatch(post + get, /@Param|body\.patient|patientId:/);
  assert.match(get, /patient_id=\$2.*\[org, s\.patientId\]/s); assert.match(get, /need\(s, 'ver_jornada'\)/);
  const p = r('apps/care-web/lib/care-proxy.ts'); assert.match(p, /\['GET', \/\^me\\\/temperatures\$\/\], \['POST', \/\^me\\\/temperatures\$\/\]/);
  const cw = r('services/api/src/clinical-work.controller.ts'); const tl = cw.slice(cw.indexOf("@Get('patients/:patientId/timeline')")); assert.ok(tl.indexOf('await this.linked(') < tl.indexOf('patient_temperature_readings'), 'equipe lê só com vínculo');
});
test('dados do gráfico: pontos ordenados no eixo de 7 dias, limiar 37,8 na escala, vazio sem linha', async () => {
  const { chartGeometry, CHART_FEVER_C, H, B } = await import('../apps/care-web/lib/temp-chart.ts');
  assert.equal(CHART_FEVER_C, R.FEVER_THRESHOLD_C);
  const now = Date.parse('2026-10-21T21:00:00Z'); const iso = (h) => new Date(now - h * 3600e3).toISOString();
  const g = chartGeometry([{ celsius: 36.6, measuredAt: iso(120) }, { celsius: 37.1, measuredAt: iso(48) }, { celsius: 38.1, measuredAt: iso(2) }], now);
  assert.equal(g.pts.length, 3); assert.ok(g.pts[0].x < g.pts[1].x && g.pts[1].x < g.pts[2].x);
  assert.ok(g.pts[2].y < g.thresholdY && g.pts[0].y > g.thresholdY, 'febril acima da linha, normal abaixo');
  assert.match(g.line, /^M[\d.]+,[\d.]+ L/); assert.match(g.area, / Z$/); assert.deepEqual([g.min, g.max], [35, 40]);
  const e = chartGeometry([], now); assert.equal(e.line, ''); assert.equal(e.area, '');
  assert.equal(chartGeometry([{ celsius: 42.3, measuredAt: iso(1) }], now).max, 43);
});
