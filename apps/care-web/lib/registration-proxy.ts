// M24 — BFF público do autocadastro: SEM sessão (o convite assinado é a credencial). Repassa somente
// GET/POST /v1/public/registration/:token; mesma origem + JSON + limite de tamanho no envio; limite de tentativas
// por cliente (hash do IP, nunca o IP em claro). Nada do formulário é registrado em log.
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { syntheticUiEnabled } from './synthetic';

export const TOKEN = /^r1\.[A-Za-z0-9_-]{20,300}\.[A-Za-z0-9_-]{43}$/;
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const hits = new Map<string, { n: number; reset: number }>();
export function limited(key: string, max: number, windowMs: number, now = Date.now()) {
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  const cur = hits.get(key); if (!cur || cur.reset <= now) { hits.set(key, { n: 1, reset: now + windowMs }); return false; }
  cur.n += 1; return cur.n > max;
}
export function clientHash(request: Request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
  return createHash('sha256').update(`${process.env.SESSION_ENCRYPTION_KEY || 'onco'}:${ip}`).digest('hex').slice(0, 32);
}
export async function registrationProxy(request: Request, token: string) {
  if (!syntheticUiEnabled()) return json('Serviço indisponível neste ambiente', 503);
  if (!TOKEN.test(token)) return json('Convite inválido, expirado ou já utilizado. Peça um novo convite à equipe.', 404);
  const method = request.method, ch = clientHash(request);
  if (limited(`${method}:${ch}`, method === 'GET' ? 30 : 5, method === 'GET' ? 60_000 : 600_000)) return json('Muitas tentativas. Aguarde alguns minutos e tente de novo.', 429);
  let body: string | undefined;
  if (method === 'POST') {
    const origin = request.headers.get('origin'), configured = process.env.PORTAL_ORIGIN;
    if (!origin || !configured || origin !== new URL(configured).origin) return json('Origem não autorizada', 403);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json('Content-Type inválido', 415);
    body = await request.text(); if (body.length > 4096) return json('Solicitação excede o limite', 413);
    try { const p = JSON.parse(body); if (!p || typeof p !== 'object' || Array.isArray(p)) return json('Corpo inválido', 400); } catch { return json('JSON inválido', 400); }
  }
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const up = await fetch(`${base}/v1/public/registration/${token}`, { method, headers: { 'x-client-hash': ch, ...(body ? { 'content-type': 'application/json' } : {}) }, body, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const raw = await up.text(); let result: unknown; try { result = JSON.parse(raw); } catch { result = {}; }
    if (up.status >= 500) return json('Serviço indisponível no momento', 503);
    if (up.status >= 400) { const m = (result as { message?: unknown })?.message; return json(typeof m === 'string' && m.length <= 200 ? m : 'Solicitação recusada', up.status); }
    return NextResponse.json(result, { status: up.status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch { return json('Não foi possível conectar', 503); }
}
