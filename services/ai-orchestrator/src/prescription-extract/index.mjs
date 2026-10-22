// M22 — Foto da prescrição → RASCUNHO de transcrição. SOMENTE servidor (chaves nunca no navegador).
// Provedores: Gemini (GEMINI_API_KEY, visão) → Groq (GROQ_API_KEY, visão) → extrator SIMULADO (demonstração não clínica).
// IA não decide: a saída só pré-preenche o formulário; o profissional revisa/edita, registra, e a farmácia confere e libera.
export const DISCLAIMER = 'IA não decide. Rascunho extraído da imagem para revisão; confira cada campo com a prescrição médica. Somente dados fictícios.';
export const SIMULATED_NOTICE = 'Extrator simulado — demonstração não clínica. Nenhum provedor de IA configurado; os campos abaixo são um exemplo fixo fictício.';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_GEMINI_MODEL = 'gemini-flash-lite-latest';
export const DEFAULT_GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME = ['image/png', 'image/jpeg', 'image/webp'];
const ROUTES = ['VO', 'SC-casa', 'SC', 'IV', 'IM', 'topica', 'outra'];
/** Mesmo padrão do servidor (med-transcription-rules): orientação ao paciente sem quantidade + unidade. */
export const PATIENT_DOSE_PATTERN = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|ui|gotas?|comprimidos?|c[aá]psulas?|ampolas?)\b/i;
export class GuardError extends Error { constructor(m) { super(m); this.name = 'GuardError'; this.status = 422; } }
export class ProviderError extends Error { constructor(m, status) { super(m); this.name = 'ProviderError'; this.status = status; } }
export function guardImage(input) {
  if (!input || typeof input !== 'object') throw new GuardError('Entrada inválida.');
  if (input.fictional !== true) throw new GuardError('Confirme que a imagem é fictícia (sem dados reais de paciente).');
  if (!MIME.includes(input.mimeType)) throw new GuardError('Envie uma imagem PNG, JPEG ou WEBP.');
  if (typeof input.imageBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(input.imageBase64)) throw new GuardError('Imagem inválida.');
  const bytes = Math.floor(input.imageBase64.length * 3 / 4);
  if (bytes < 64 || bytes > MAX_IMAGE_BYTES) throw new GuardError('Imagem vazia ou maior que 4 MB.');
  return true;
}
export const PROMPT = `Você transcreve uma prescrição médica FICTÍCIA fotografada (demonstração, não clínica). Não sugira, não corrija e não complete nada: copie apenas o que está escrito; se não estiver legível, deixe vazio.
Para cada medicamento devolva: medication (nome), dose (como escrita), route (um de: ${ROUTES.join(', ')}; VO = oral), times (horários HH:MM escritos), frequency (como escrita), startDate e endDate (AAAA-MM-DD ou vazio), instructions (orientações ao paciente SEM quantidade/unidade de dose).
Responda somente JSON: {"items":[{"medication":"","dose":"","route":"","times":[],"frequency":"","startDate":"","endDate":"","instructions":""}]}`;
export const RESPONSE_SCHEMA = { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  medication: { type: 'STRING' }, dose: { type: 'STRING' }, route: { type: 'STRING' }, times: { type: 'ARRAY', items: { type: 'STRING' } }, frequency: { type: 'STRING' }, startDate: { type: 'STRING' }, endDate: { type: 'STRING' }, instructions: { type: 'STRING' } }, required: ['medication'] } } }, required: ['items'] };
const s = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const hhmm = (t) => { const m = /^(\d{1,2})[:h](\d{2})?/.exec(String(t).trim()); if (!m) return null; const h = Number(m[1]), mi = Number(m[2] ?? 0); return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null; };
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '');
/** Normaliza para o formato do formulário. Nunca inventa: campo ilegível fica vazio; orientação com dose é descartada e sinalizada. */
export function normalizeDraft(raw) {
  let j = raw; if (typeof raw === 'string') { try { j = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '')); } catch { throw new ProviderError('Resposta da IA em formato inválido.', 502); } }
  const items = Array.isArray(j?.items) ? j.items.slice(0, 12) : [];
  return items.filter((i) => s(i?.medication, 120).length >= 2).map((i) => {
    const warnings = [];
    let instructions = s(i.instructions, 500);
    if (PATIENT_DOSE_PATTERN.test(instructions)) { instructions = ''; warnings.push('Orientação ao paciente continha dose e foi deixada em branco: reescreva sem quantidade/unidade.'); }
    const route = ROUTES.includes(String(i.route)) ? String(i.route) : /oral|vo\b/i.test(String(i.route)) ? 'VO' : '';
    if (!route) warnings.push('Via não identificada: selecione.');
    const times = [...new Set((Array.isArray(i.times) ? i.times : []).map(hhmm).filter(Boolean))].sort().slice(0, 8);
    if (!times.length) warnings.push('Horários não identificados: informe.');
    return { medication: s(i.medication, 120), dose: s(i.dose, 80), route, times, frequency: s(i.frequency, 120), startDate: date(i.startDate), endDate: date(i.endDate), instructions, warnings };
  });
}
export class SimulatedExtractor {
  name = 'simulado'; model = null;
  async extract() {
    return normalizeDraft({ items: [{ medication: 'Metoclopramida (fictício)', dose: 'Conforme prescrição fictícia', route: 'VO', times: ['07:00', '19:00'], frequency: 'De 12 em 12 horas, se enjoo', startDate: '', endDate: '', instructions: 'Tomar antes das refeições.' }] });
  }
}
export class GeminiExtractor {
  name = 'gemini'; #key;
  constructor({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) { if (!apiKey) throw new Error('GEMINI_API_KEY ausente'); this.#key = apiKey; this.model = model || DEFAULT_GEMINI_MODEL; this.fetch = fetchImpl; this.timeoutMs = timeoutMs; }
  async extract(input) {
    try { return await this.#call(this.model, input); }
    catch (e) { if (e instanceof ProviderError && e.httpStatus === 404 && this.model !== FALLBACK_GEMINI_MODEL) { this.model = FALLBACK_GEMINI_MODEL; return this.#call(this.model, input); } throw e; }
  }
  async #call(model, input) {
    let r;
    try {
      r = await this.fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': this.#key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA } }),
        signal: AbortSignal.timeout(this.timeoutMs) });
    } catch { throw new ProviderError('Falha de rede ao consultar o Gemini.', 503); }
    if (!r.ok) { const e = new ProviderError(`Gemini respondeu HTTP ${r.status}.`, 502); e.httpStatus = r.status; throw e; }
    const j = await r.json().catch(() => null); const text = j?.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('');
    if (!text) throw new ProviderError('Gemini não retornou conteúdo.', 502);
    return normalizeDraft(text);
  }
}
export class GroqExtractor {
  name = 'groq'; #key;
  constructor({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) { if (!apiKey) throw new Error('GROQ_API_KEY ausente'); this.#key = apiKey; this.model = model || DEFAULT_GROQ_VISION_MODEL; this.fetch = fetchImpl; this.timeoutMs = timeoutMs; }
  async extract(input) {
    let r;
    try {
      r = await this.fetch(GROQ_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.#key}` },
        body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` } }] }] }),
        signal: AbortSignal.timeout(this.timeoutMs) });
    } catch { throw new ProviderError('Falha de rede ao consultar o Groq.', 503); }
    if (!r.ok) throw new ProviderError(`Groq respondeu HTTP ${r.status}.`, 502);
    const j = await r.json().catch(() => null); const text = j?.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError('Groq não retornou conteúdo.', 502);
    return normalizeDraft(text);
  }
}
export function selectExtractors(env = process.env, fetchImpl) {
  const list = [];
  if (env.GEMINI_API_KEY) list.push(new GeminiExtractor({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || undefined, fetchImpl }));
  if (env.GROQ_API_KEY) list.push(new GroqExtractor({ apiKey: env.GROQ_API_KEY, model: env.GROQ_VISION_MODEL || undefined, fetchImpl }));
  return list;
}
/** Gemini → Groq → simulado. Sempre devolve rascunho com decision PENDING_REVIEW; nunca grava nada. */
export async function extractPrescription(input, { env = process.env, fetchImpl, providers } = {}) {
  guardImage(input);
  const base = { decision: 'PENDING_REVIEW', disclaimer: DISCLAIMER };
  const tried = [];
  for (const p of providers ?? selectExtractors(env, fetchImpl)) {
    try { return { ...base, provider: p.name, model: p.model ?? null, simulated: false, ...(tried.length ? { fallbackFrom: tried } : {}), items: await p.extract(input) }; }
    catch (e) { tried.push(p.name); }
  }
  return { ...base, provider: 'simulado', model: null, simulated: true, notice: SIMULATED_NOTICE, ...(tried.length ? { fallbackFrom: tried } : {}), items: await new SimulatedExtractor().extract() };
}
