// M22 — foto da prescrição → rascunho: guarda, normalização (sem dose na orientação), Gemini → Groq → simulado, sem rede.
import test from 'node:test'; import assert from 'node:assert/strict';
import { extractPrescription, normalizeDraft, guardImage, GuardError, SIMULATED_NOTICE, PROMPT } from '../src/prescription-extract/index.mjs';
const IMG = { fictional: true, mimeType: 'image/png', imageBase64: Buffer.alloc(200, 1).toString('base64') };
const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const fail = (status) => async () => ({ ok: false, status, json: async () => ({}) });
const draft = { items: [{ medication: 'Metoclopramida (fictício)', dose: 'conforme receita', route: 'oral', times: ['7h', '19:00', '19:00'], frequency: '12/12h', startDate: '2026-10-21', endDate: '', instructions: 'Tomar antes das refeições.' }] };
test('guarda: exige fictional:true, tipo de imagem e tamanho', () => {
  assert.ok(guardImage(IMG));
  for (const bad of [{ fictional: false }, { mimeType: 'application/pdf' }, { imageBase64: '' }, { imageBase64: 'não é base64!' }, { imageBase64: Buffer.alloc(5 * 1024 * 1024).toString('base64') }]) assert.throws(() => guardImage({ ...IMG, ...bad }), GuardError, JSON.stringify(Object.keys(bad)));
});
test('normalização: horários HH:MM, via oral → VO, orientação com dose descartada com aviso, campo ilegível vazio', () => {
  const [d] = normalizeDraft(draft); assert.deepEqual(d.times, ['07:00', '19:00']); assert.equal(d.route, 'VO'); assert.equal(d.instructions, 'Tomar antes das refeições.'); assert.deepEqual(d.warnings, []);
  const [e] = normalizeDraft({ items: [{ medication: 'X fictício', route: '??', instructions: 'Tomar 8 mg' }] }); assert.equal(e.instructions, ''); assert.equal(e.route, ''); assert.equal(e.warnings.length, 3);
  assert.equal(normalizeDraft('```json\n{"items":[]}\n```').length, 0); assert.throws(() => normalizeDraft('lixo'));
  assert.match(PROMPT, /Não sugira, não corrija/); assert.match(PROMPT, /FICTÍCIA/);
});
test('provedores: Gemini responde → rascunho PENDING_REVIEW; Gemini falha → Groq; ambos falham → simulado com aviso', async () => {
  const g = await extractPrescription(IMG, { env: { GEMINI_API_KEY: 'k' }, fetchImpl: ok({ candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }] }) });
  assert.equal(g.provider, 'gemini'); assert.equal(g.decision, 'PENDING_REVIEW'); assert.equal(g.simulated, false); assert.equal(g.items[0].medication, 'Metoclopramida (fictício)');
  let calls = []; const mixed = async (url, init) => { calls.push(url); return url.includes('groq') ? ok({ choices: [{ message: { content: JSON.stringify(draft) } }] })() : fail(500)(); };
  const q = await extractPrescription(IMG, { env: { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'q' }, fetchImpl: mixed }); assert.equal(q.provider, 'groq'); assert.deepEqual(q.fallbackFrom, ['gemini']);
  assert.ok(!calls.some((u) => u.includes('key=')), 'chave nunca na URL');
  const m = await extractPrescription(IMG, { env: {} }); assert.equal(m.provider, 'simulado'); assert.equal(m.simulated, true); assert.equal(m.notice, SIMULATED_NOTICE); assert.match(m.notice, /demonstração não clínica/);
  const f = await extractPrescription(IMG, { env: { GEMINI_API_KEY: 'k' }, fetchImpl: fail(429) }); assert.equal(f.provider, 'simulado'); assert.deepEqual(f.fallbackFrom, ['gemini']);
  await assert.rejects(extractPrescription({ ...IMG, fictional: false }, { env: {} }), GuardError);
});
