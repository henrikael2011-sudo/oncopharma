import test from 'node:test'; import assert from 'node:assert/strict';
import { checkPrescription, guardInput, GuardError, GeminiProvider, GroqProvider, selectProvider, parseResult, DEMO_PRESCRIPTION as D, DISCLAIMER, RESPONSE_SCHEMA } from '../src/prescription-check/index.mjs';
const KEY = 'test-key-not-real';
const okBody = (items) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items, disclaimer: 'x' }) }] } }] });
const ck = (s) => ({ status: s, rule: 'r', suggestion: 's' });
const aiItems = D.items.map((i) => ({ drug: i.drug, checks: { dose_vs_bsa: ck('ok'), protocol: ck('ok'), dilution: ck('divergente'), infusion_order: ck('incerto') } }));
const fakeFetch = (res, calls = []) => async (url, init) => { calls.push({ url, init }); if (res instanceof Error) throw res; return { ok: res.status < 400, status: res.status, json: async () => res.body }; };
test('sem chave usa mock determinístico com disclaimer', async () => {
  const r = await checkPrescription(D, { env: {} });
  assert.equal(r.provider, 'mock'); assert.equal(r.disclaimer, DISCLAIMER); assert.equal(r.decision, 'PENDING_PHARMACIST_VALIDATION');
  assert.equal(r.items[0].checks.dose_vs_bsa.status, 'ok'); assert.equal(r.items[3].checks.dose_vs_bsa.status, 'divergente');
});
test('Gemini: endpoint, header, schema JSON e parsing', async () => {
  const calls = []; const r = await checkPrescription(D, { env: { GEMINI_API_KEY: KEY }, fetchImpl: fakeFetch({ status: 200, body: okBody(aiItems) }, calls) });
  assert.equal(r.provider, 'gemini'); assert.equal(r.model, 'gemini-3.5-flash-lite');
  assert.match(calls[0].url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], KEY); assert.ok(!calls[0].url.includes(KEY));
  const b = JSON.parse(calls[0].init.body); assert.equal(b.generationConfig.responseMimeType, 'application/json'); assert.deepEqual(b.generationConfig.responseSchema, RESPONSE_SCHEMA);
  assert.match(b.contents[0].parts[0].text, /NUNCA decide/); assert.ok(!b.contents[0].parts[0].text.includes(KEY));
  assert.equal(r.items[0].checks.dilution.status, 'divergente'); assert.equal(r.disclaimer, DISCLAIMER);
});
test('GEMINI_MODEL sobrescreve o modelo', async () => {
  const calls = []; await checkPrescription(D, { env: { GEMINI_API_KEY: KEY, GEMINI_MODEL: 'gemini-x' }, fetchImpl: fakeFetch({ status: 200, body: okBody(aiItems) }, calls) });
  assert.match(calls[0].url, /models\/gemini-x:generateContent/);
});
test('status desconhecido vira incerto; JSON inválido é erro', () => {
  const r = parseResult(JSON.stringify({ items: [{ drug: 'oxaliplatina', checks: { dose_vs_bsa: { status: 'aprovado' } } }] }), { items: [D.items[0]] });
  assert.equal(r.items[0].checks.dose_vs_bsa.status, 'incerto'); assert.equal(r.items[0].checks.protocol.status, 'incerto');
  assert.throws(() => parseResult('não json', D), /JSON/);
});
for (const [nome, res] of [['HTTP 500', { status: 500, body: {} }], ['HTTP 429', { status: 429, body: {} }], ['rede', new Error('ECONNRESET')], ['sem conteúdo', { status: 200, body: { candidates: [] } }], ['JSON inválido', { status: 200, body: { candidates: [{ content: { parts: [{ text: '{oops' }] } }] } }]])
  test(`falha do Gemini (${nome}) cai para mock`, async () => {
    const r = await checkPrescription(D, { env: { GEMINI_API_KEY: KEY }, fetchImpl: fakeFetch(res) });
    assert.equal(r.provider, 'mock'); assert.equal(r.fallbackFrom, 'gemini'); assert.ok(!JSON.stringify(r).includes(KEY));
  });
test('seleção: Gemini > Groq > mock', () => {
  assert.equal(selectProvider({ GEMINI_API_KEY: 'a', GROQ_API_KEY: 'b' }).name, 'gemini');
  assert.equal(selectProvider({ GROQ_API_KEY: 'b' }).name, 'groq'); assert.equal(selectProvider({}).name, 'mock');
});
test('Groq: endpoint OpenAI-compatível com Bearer', async () => {
  const calls = []; const r = await new GroqProvider({ apiKey: KEY, fetchImpl: fakeFetch({ status: 200, body: { choices: [{ message: { content: JSON.stringify({ items: aiItems }) } }] } }, calls) }).check(D);
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions'); assert.equal(calls[0].init.headers.authorization, `Bearer ${KEY}`); assert.equal(r.items.length, 4);
});
test('guarda: exige fictional=true e rejeita real/CPF/CNS', async () => {
  assert.throws(() => guardInput({ ...D, fictional: false }), GuardError);
  assert.throws(() => guardInput({ ...D, real: true }), GuardError);
  assert.throws(() => guardInput({ ...D, patient: { ...D.patient, name: 'Maria 123.456.789-09' } }), /CPF/);
  assert.throws(() => guardInput({ ...D, patient: { ...D.patient, notes: '12345678909' } }), /CPF/);
  assert.throws(() => guardInput({ ...D, patient: { ...D.patient, cns: '700000000000005' } }), /CNS/);
  assert.throws(() => guardInput({ ...D, items: [] }), GuardError);
  await assert.rejects(checkPrescription({ ...D, real: true }, { env: { GEMINI_API_KEY: KEY }, fetchImpl: () => assert.fail('não deveria chamar rede') }), GuardError);
});
test('chave nunca fica exposta no objeto do provedor', () => {
  const p = new GeminiProvider({ apiKey: KEY }); assert.ok(!JSON.stringify(p).includes(KEY)); assert.throws(() => new GeminiProvider({}));
});
test('404 no modelo padrão tenta gemini-flash-lite-latest', async () => {
  const calls = []; const f = async (url, init) => { calls.push(url); return url.includes('3.5') ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => okBody(aiItems) }; };
  const r = await checkPrescription(D, { env: { GEMINI_API_KEY: KEY }, fetchImpl: f });
  assert.equal(r.provider, 'gemini'); assert.equal(r.model, 'gemini-flash-lite-latest'); assert.equal(calls.length, 2);
});
