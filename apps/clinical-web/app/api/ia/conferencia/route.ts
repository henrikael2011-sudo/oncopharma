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
  // M25: dose obrigatória (> 0) em todos os itens — recusa com 400 e mensagem clara antes de chamar a IA.
  const items = (body as { items?: unknown })?.items;
  if (Array.isArray(items)) for (const it of items as { drug?: unknown; doseMg?: unknown }[]) {
    const d = it?.doseMg; const n = typeof d === 'number' ? d : typeof d === 'string' && d.trim() !== '' ? Number(d) : NaN;
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: `Dose obrigatória: informe a dose (mg) de ${typeof it?.drug === 'string' ? it.drug.slice(0, 60) : 'cada item'} com valor maior que zero.` }, { status: 400, headers: H });
  }
  try { return NextResponse.json(await checkPrescription(body), { headers: H }); }
  catch (e) {
    if (e instanceof GuardError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error('[ia-conferencia] falha', e instanceof Error ? e.name : 'erro'); // sem prompt, sem chave
    return NextResponse.json({ error: 'Conferência indisponível' }, { status: 503 });
  }
}
