// M19 — Conferência de prescrição assistida por IA (somente servidor; nunca importar em código de navegador).
// A IA apenas apoia: quem decide e valida é o farmacêutico. Demonstração NÃO clínica, dados fictícios.
// Provedores: Gemini (GEMINI_API_KEY) → Groq (GROQ_API_KEY) → mock determinístico.
export const DISCLAIMER = 'IA não decide. Rascunho de apoio para demonstração com dados fictícios; a validação é sempre do farmacêutico. Proibido uso clínico ou com dados reais de pacientes.';
export const STATUSES = ['ok', 'divergente', 'incerto'];
export const CHECKS = ['dose_vs_bsa', 'protocol', 'dilution', 'infusion_order'];
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_GEMINI_MODEL = 'gemini-flash-lite-latest';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GuardError extends Error { constructor(m) { super(m); this.name = 'GuardError'; this.status = 422; } }
export class ProviderError extends Error { constructor(m, status) { super(m); this.name = 'ProviderError'; this.status = status; } }

// ---------- Guarda de dados reais ----------
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const CNS = /\b[1-9]\d{14}\b/; // Cartão Nacional de Saúde
export function guardInput(input) {
  if (!input || typeof input !== 'object') throw new GuardError('Entrada inválida.');
  if (input.fictional !== true) throw new GuardError('Somente prescrições fictícias marcadas com fictional=true são aceitas.');
  if (input.real === true || input.realPatient === true || input.dataOrigin === 'real') throw new GuardError('Dados reais de paciente são proibidos neste módulo de demonstração.');
  const txt = JSON.stringify(input);
  if (CPF.test(txt) || CNS.test(txt)) throw new GuardError('A entrada contém padrão de documento (CPF/CNS). Use apenas dados fictícios.');
  if (txt.length > 8000) throw new GuardError('Entrada grande demais.');
  const p = input.patient || {};
  for (const k of ['weightKg', 'heightCm']) if (!(Number(p[k]) > 0)) throw new GuardError(`patient.${k} obrigatório.`);
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 12) throw new GuardError('items deve ter de 1 a 12 itens.');
  return true;
}
export const mostellerBsa = (kg, cm) => Math.round(Math.sqrt((kg * cm) / 3600) * 100) / 100;

// ---------- Schema / prompt ----------
const checkSchema = { type: 'OBJECT', properties: { status: { type: 'STRING', enum: STATUSES }, rule: { type: 'STRING' }, suggestion: { type: 'STRING' } }, required: ['status', 'rule', 'suggestion'] };
export const RESPONSE_SCHEMA = { type: 'OBJECT', properties: {
  items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { drug: { type: 'STRING' }, checks: { type: 'OBJECT', properties: Object.fromEntries(CHECKS.map((c) => [c, checkSchema])), required: CHECKS } }, required: ['drug', 'checks'] } },
  disclaimer: { type: 'STRING' } }, required: ['items', 'disclaimer'] };

export function buildPrompt(input) {
  const p = input.patient; const bsa = p.bsaM2 ?? mostellerBsa(p.weightKg, p.heightCm);
  return [
    'Você é um assistente de APOIO à conferência farmacêutica de prescrições oncológicas, em ambiente de DEMONSTRAÇÃO NÃO CLÍNICA com dados 100% fictícios.',
    'A IA apenas apoia e NUNCA decide: o farmacêutico valida tudo. Não invente dados; se faltar informação ou houver dúvida, use status "incerto". Para dose_vs_bsa, calcule dose esperada = mg/m² de referência × SC; considere "ok" se a diferença for ≤ 5%.',
    'Para cada item, avalie: dose_vs_bsa (dose prescrita x dose esperada por m² de superfície corporal do protocolo), protocol (o fármaco pertence ao protocolo e a dose de referência confere), dilution (diluente e volume compatíveis), infusion_order (ordem de infusão adequada no protocolo).',
    'Cada verificação: status ok|divergente|incerto, rule (regra aplicada, curta, pt-BR) e suggestion (sugestão para o farmacêutico conferir, pt-BR).',
    `Responda somente JSON conforme o schema. Em "disclaimer" use exatamente: "${DISCLAIMER}"`,
    `Prescrição fictícia: ${JSON.stringify({ protocol: input.protocol, patient: { name: p.name, weightKg: p.weightKg, heightCm: p.heightCm, bsaM2: bsa }, items: input.items })}`,
  ].join('\n');
}

// ---------- Normalização ----------
export function parseResult(raw, input) {
  let obj = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new ProviderError('Resposta da IA não é JSON válido.', 502); } }
  if (!obj || !Array.isArray(obj.items)) throw new ProviderError('Resposta da IA fora do formato esperado.', 502);
  const items = input.items.map((it, i) => {
    const got = obj.items.find((x) => x && typeof x.drug === 'string' && x.drug.toLowerCase() === String(it.drug).toLowerCase()) ?? obj.items[i] ?? {};
    const checks = {};
    for (const c of CHECKS) {
      const v = got.checks?.[c] ?? {};
      checks[c] = { status: STATUSES.includes(v.status) ? v.status : 'incerto', rule: String(v.rule ?? 'Sem regra informada pela IA.').slice(0, 400), suggestion: String(v.suggestion ?? 'Conferir manualmente.').slice(0, 400) };
    }
    return { drug: String(it.drug), checks };
  });
  return { items, disclaimer: DISCLAIMER };
}

// ---------- Provedores ----------
const REF = { // referência fictícia/didática (não usar clinicamente)
  FOLFOX: { order: ['oxaliplatina', 'leucovorina', 'fluorouracil bolus', 'fluorouracil infusional'],
    drugs: { oxaliplatina: { mgM2: 85, diluents: ['SG 5%'] }, leucovorina: { mgM2: 400, diluents: ['SG 5%', 'SF 0,9%'] }, 'fluorouracil bolus': { mgM2: 400, diluents: ['sem diluição', 'SF 0,9%', 'SG 5%'] }, 'fluorouracil infusional': { mgM2: 2400, diluents: ['SF 0,9%', 'SG 5%'] } } },
};
export class MockProvider {
  name = 'mock';
  async check(input) {
    const p = input.patient; const bsa = p.bsaM2 ?? mostellerBsa(p.weightKg, p.heightCm); const ref = REF[String(input.protocol).toUpperCase()];
    return parseResult({ items: input.items.map((it, i) => {
      const r = ref?.drugs[String(it.drug).toLowerCase()];
      if (!r) return { drug: it.drug, checks: Object.fromEntries(CHECKS.map((c) => [c, { status: 'incerto', rule: 'Fármaco/protocolo sem referência no mock.', suggestion: 'Conferir manualmente com o protocolo institucional.' }])) };
      const exp = Math.round(r.mgM2 * bsa); const dev = Math.abs(it.doseMg - exp) / exp;
      const pos = ref.order.indexOf(String(it.drug).toLowerCase()); const ord = Number(it.order ?? i + 1);
      return { drug: it.drug, checks: {
        dose_vs_bsa: dev <= 0.05 ? { status: 'ok', rule: `${r.mgM2} mg/m² × ${bsa} m² ≈ ${exp} mg (tolerância 5%)`, suggestion: 'Sem ação.' } : { status: 'divergente', rule: `${r.mgM2} mg/m² × ${bsa} m² ≈ ${exp} mg; prescrito ${it.doseMg} mg (${Math.round(dev * 100)}%)`, suggestion: 'Confirmar dose com o prescritor.' },
        protocol: { status: 'ok', rule: `Fármaco consta no ${input.protocol} (referência didática).`, suggestion: 'Sem ação.' },
        dilution: r.diluents.includes(it.diluent) ? { status: 'ok', rule: `Diluentes aceitos: ${r.diluents.join(', ')}.`, suggestion: 'Sem ação.' } : { status: 'divergente', rule: `Diluentes aceitos: ${r.diluents.join(', ')}; prescrito ${it.diluent}.`, suggestion: 'Revisar diluente.' },
        infusion_order: pos + 1 === ord ? { status: 'ok', rule: `Ordem esperada: ${ref.order.join(' → ')}.`, suggestion: 'Sem ação.' } : { status: 'divergente', rule: `Ordem esperada: ${ref.order.join(' → ')}; item na posição ${ord}.`, suggestion: 'Revisar sequência de infusão.' },
      } };
    }), disclaimer: DISCLAIMER }, input);
  }
}

export class GeminiProvider {
  name = 'gemini';
  constructor({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) { if (!apiKey) throw new Error('GEMINI_API_KEY ausente'); this.#key = apiKey; this.model = model || DEFAULT_GEMINI_MODEL; this.fallbackModel = FALLBACK_GEMINI_MODEL; this.fetch = fetchImpl; this.timeoutMs = timeoutMs; }
  #key;
  async check(input) {
    try { return await this.#call(this.model, input); }
    catch (e) { // modelo indisponível para a chave (404) → tenta o modelo reserva uma vez
      if (e instanceof ProviderError && e.httpStatus === 404 && this.fallbackModel && this.fallbackModel !== this.model) { this.model = this.fallbackModel; return this.#call(this.model, input); }
      throw e;
    }
  }
  async #call(model, input) {
    let r;
    try {
      r = await this.fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': this.#key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA } }),
        signal: AbortSignal.timeout(this.timeoutMs) });
    } catch { throw new ProviderError('Falha de rede ao consultar o Gemini.', 503); }
    if (!r.ok) { const e = new ProviderError(`Gemini respondeu HTTP ${r.status}.`, r.status === 429 ? 429 : 502); e.httpStatus = r.status; throw e; }
    const j = await r.json().catch(() => null);
    const text = j?.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('');
    if (!text) throw new ProviderError('Gemini não retornou conteúdo.', 502);
    return parseResult(text, input);
  }
}

export class GroqProvider { // alternativa OpenAI-compatível
  name = 'groq';
  constructor({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) { if (!apiKey) throw new Error('GROQ_API_KEY ausente'); this.#key = apiKey; this.model = model || 'llama-3.3-70b-versatile'; this.fetch = fetchImpl; this.timeoutMs = timeoutMs; }
  #key;
  async check(input) {
    let r;
    try {
      r = await this.fetch(GROQ_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.#key}` },
        body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: `${buildPrompt(input)}\nFormato: {"items":[{"drug":"","checks":{"dose_vs_bsa":{"status":"","rule":"","suggestion":""},"protocol":{...},"dilution":{...},"infusion_order":{...}}}],"disclaimer":""}` }] }),
        signal: AbortSignal.timeout(this.timeoutMs) });
    } catch { throw new ProviderError('Falha de rede ao consultar o Groq.', 503); }
    if (!r.ok) throw new ProviderError(`Groq respondeu HTTP ${r.status}.`, r.status === 429 ? 429 : 502);
    const j = await r.json().catch(() => null);
    const text = j?.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError('Groq não retornou conteúdo.', 502);
    return parseResult(text, input);
  }
}

export function selectProvider(env = process.env, fetchImpl) {
  if (env.GEMINI_API_KEY) return new GeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetchImpl });
  if (env.GROQ_API_KEY) return new GroqProvider({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, fetchImpl });
  return new MockProvider();
}

/** Executa a conferência. Em falha do provedor real, cai para o mock e informa (fallbackFrom). Nunca registra prompt nem chave. */
export async function checkPrescription(input, { env = process.env, fetchImpl, provider } = {}) {
  guardInput(input);
  const prov = provider ?? selectProvider(env, fetchImpl);
  const base = { synthetic: true, decision: 'PENDING_PHARMACIST_VALIDATION', bsaM2: input.patient.bsaM2 ?? mostellerBsa(input.patient.weightKg, input.patient.heightCm) };
  try { const out = await prov.check(input); return { ...base, provider: prov.name, model: prov.model ?? null, ...out }; }
  catch (e) {
    if (prov.name === 'mock' || e instanceof GuardError) throw e;
    const m = new MockProvider();
    return { ...base, provider: 'mock', model: null, fallbackFrom: prov.name, fallbackReason: e instanceof ProviderError ? e.message : 'Erro no provedor.', ...(await m.check(input)) };
  }
}

export const DEMO_PRESCRIPTION = { fictional: true, protocol: 'FOLFOX',
  patient: { name: 'Maria (fictícia)', weightKg: 64, heightCm: 162 },
  items: [
    { drug: 'oxaliplatina', doseMg: 145, diluent: 'SG 5%', volumeMl: 500, order: 1 },
    { drug: 'leucovorina', doseMg: 680, diluent: 'SF 0,9%', volumeMl: 250, order: 2 },
    { drug: 'fluorouracil bolus', doseMg: 680, diluent: 'sem diluição', volumeMl: 13, order: 3 },
    { drug: 'fluorouracil infusional', doseMg: 4400, diluent: 'SF 0,9%', volumeMl: 230, order: 4 },
  ] };
