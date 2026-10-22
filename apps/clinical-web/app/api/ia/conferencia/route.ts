// M19 — Conferência de prescrição assistida por IA. SOMENTE servidor: a chave (GEMINI_API_KEY/GROQ_API_KEY) nunca chega ao navegador.
import { NextResponse } from 'next/server';
import { session } from '../../../../lib/auth';
import { syntheticUiEnabled } from '../../../../lib/synthetic';
import { checkPrescription, DEMO_PRESCRIPTION, GuardError } from '../../../../../../services/ai-orchestrator/src/prescription-check/index.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'cache-control': 'no-store' };
export async function GET() {
  const s = await session(); if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!syntheticUiEnabled()) return NextResponse.json({ error: 'Recurso não habilitado' }, { status: 503 });
  return NextResponse.json({ demo: DEMO_PRESCRIPTION }, { headers: H });
}
export async function POST(req: Request) {
  const s = await session(); if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!syntheticUiEnabled()) return NextResponse.json({ error: 'Recurso não habilitado (somente ambiente de teste com dados fictícios)' }, { status: 503 });
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  try { return NextResponse.json(await checkPrescription(body), { headers: H }); }
  catch (e) {
    if (e instanceof GuardError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error('[ia-conferencia] falha', e instanceof Error ? e.name : 'erro'); // sem prompt, sem chave
    return NextResponse.json({ error: 'Conferência indisponível' }, { status: 503 });
  }
}
