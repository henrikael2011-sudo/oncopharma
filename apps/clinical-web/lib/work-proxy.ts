// M15.4 — BFF do Clinical: repassa somente rotas permitidas para /v1/clinical/... com o token da sessão (cookie HttpOnly).
import { NextResponse } from 'next/server';
import { session } from './auth';
import { syntheticUiEnabled } from './synthetic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = '[0-9a-f-]{36}';
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const ALLOW: [string, RegExp][] = [
  ['GET', /^me$/], ['GET', /^worklist$/],
  ['GET', new RegExp(`^patients/${ID}$`)], ['GET', new RegExp(`^patients/${ID}/(precycle|timeline)$`)],
  ['POST', new RegExp(`^alerts/${ID}/transition$`)], ['POST', new RegExp(`^patients/${ID}/tasks$`)],
  ['POST', new RegExp(`^tasks/${ID}/(receive|complete|cancel)$`)], ['POST', new RegExp(`^patients/${ID}/precycle/reviews$`)],
];
export function allowed(method: string, path: string) {
  if (!ALLOW.some(([m, r]) => m === method && r.test(path))) return false;
  return (path.match(/[0-9a-f-]{36}/g) || []).every((id) => UUID.test(id));
}
export async function workProxy(request: Request, segments: string[]) {
  if (!syntheticUiEnabled()) return json('Serviço indisponível neste ambiente', 503);
  const path = segments.join('/'), method = request.method;
  if (!allowed(method, path)) return json('Rota não permitida', 404);
  const org = process.env.DEV_ORGANIZATION_ID;
  if (!org || !UUID.test(org)) return json('Configuração ausente', 503);
  const s = await session(); if (!s) return json('Autenticação necessária', 401);
  // Somente o parâmetro de busca "q" é repassado (lista).
  const q = new URL(request.url).searchParams.get('q');
  const qs = path === 'worklist' && q ? `?q=${encodeURIComponent(q.slice(0, 80))}` : '';
  let body: string | undefined;
  if (method !== 'GET') {
    const origin = request.headers.get('origin'), configured = process.env.PORTAL_ORIGIN;
    if (!origin || !configured || origin !== new URL(configured).origin) return json('Origem não autorizada', 403);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json('Content-Type inválido', 415);
    body = await request.text(); if (body.length > 8192) return json('Solicitação excede o limite', 413);
    try { const p = JSON.parse(body); if (!p || typeof p !== 'object' || Array.isArray(p)) return json('Corpo inválido', 400); } catch { return json('JSON inválido', 400); }
  }
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const up = await fetch(`${base}/v1/clinical/${path}${qs}`, { method, headers: { authorization: `Bearer ${s.token}`, 'x-organization-id': org, ...(body ? { 'content-type': 'application/json' } : {}) }, body, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const raw = await up.text(); let result: unknown; try { result = JSON.parse(raw); } catch { result = {}; }
    if (up.status >= 500) return json('Serviço clínico indisponível no momento', 503);
    if (up.status >= 400) { const m = (result as { message?: unknown })?.message; return json(typeof m === 'string' && m.length <= 200 ? m : 'Solicitação recusada', up.status); }
    return NextResponse.json(result, { status: up.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Não foi possível conectar à API', 503); }
}
