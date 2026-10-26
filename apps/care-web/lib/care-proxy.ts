// M15.2 — BFF do Care: repassa somente rotas permitidas para /v1/care/me/... com o token da sessão (cookie HttpOnly).
// R3: nenhuma rota leva identificador de paciente; a API resolve o paciente pela identidade.
import { NextResponse } from 'next/server';
import { session } from './auth';
import { syntheticUiEnabled } from './synthetic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const ALLOW: [string, RegExp][] = [
  ['GET', /^me$/], ['GET', /^me\/(home|journey|medications|help)$/],
  ['PUT', /^me\/(consent|preferences)$/], ['POST', /^me\/symptoms$/],
  // M21.2: temperatura (criar + últimos 7 dias).
  ['GET', /^me\/temperatures$/], ['POST', /^me\/temperatures$/],
  ['POST', /^me\/medications\/[0-9a-f-]{36}\/adherence$/],
  // M25: check-in diário (hoje: ler/criar-editar), alertas reais do paciente e mensagens com a equipe.
  ['GET', /^me\/checkins\/today$/], ['PUT', /^me\/checkins\/today$/], ['GET', /^me\/alerts$/], ['GET', /^me\/messages$/], ['POST', /^me\/messages$/],
  // M15.3 (R4): gestão do cuidador pelo paciente + aceite do convite pelo cuidador.
  ['GET', /^me\/caregivers$/], ['POST', /^me\/caregivers\/invites$/], ['POST', /^me\/caregivers\/invites\/[0-9a-f-]{36}\/cancel$/],
  ['PUT', /^me\/caregivers\/[0-9a-f-]{36}\/scopes$/], ['POST', /^me\/caregivers\/[0-9a-f-]{36}\/revoke$/], ['POST', /^caregiver\/accept$/],
];
export function allowed(method: string, path: string) {
  if (!ALLOW.some(([m, r]) => m === method && r.test(path))) return false;
  return (path.match(/[0-9a-f-]{36}/g) || []).every((id) => UUID.test(id));
}
export async function careProxy(request: Request, segments: string[]) {
  if (!syntheticUiEnabled()) return json('Serviço indisponível neste ambiente', 503);
  const path = segments.join('/'), method = request.method;
  if (!allowed(method, path)) return json('Rota não permitida', 404);
  const org = process.env.DEV_ORGANIZATION_ID;
  if (!org || !UUID.test(org)) return json('Configuração ausente', 503);
  const s = await session(); if (!s) return json('Autenticação necessária', 401);
  let body: string | undefined;
  if (method !== 'GET') {
    // Mesma origem obrigatória (CSRF) + JSON + limite de tamanho.
    const origin = request.headers.get('origin'), configured = process.env.PORTAL_ORIGIN;
    if (!origin || !configured || origin !== new URL(configured).origin) return json('Origem não autorizada', 403);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json('Content-Type inválido', 415);
    body = await request.text(); if (body.length > 4096) return json('Solicitação excede o limite', 413);
    try { const p = JSON.parse(body); if (!p || typeof p !== 'object' || Array.isArray(p)) return json('Corpo inválido', 400); } catch { return json('JSON inválido', 400); }
  }
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const up = await fetch(`${base}/v1/care/${path}`, { method, headers: { authorization: `Bearer ${s.token}`, 'x-organization-id': org, ...(body ? { 'content-type': 'application/json' } : {}) }, body, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const raw = await up.text(); let result: unknown; try { result = JSON.parse(raw); } catch { result = {}; }
    // M25: 503 da API traz motivo operacional seguro (ex.: chave de cifra não configurada) — repassado; demais 5xx seguem genéricos.
    if (up.status === 503) { const m = (result as { message?: unknown })?.message; return json(typeof m === 'string' && m.length <= 200 ? m : 'Serviço indisponível no momento', 503); }
    if (up.status >= 500) return json('Serviço indisponível no momento', 503);
    if (up.status >= 400) { const m = (result as { message?: unknown })?.message; return json(typeof m === 'string' && m.length <= 200 ? m : 'Solicitação recusada', up.status); }
    return NextResponse.json(result, { status: up.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Não foi possível conectar', 503); }
}
