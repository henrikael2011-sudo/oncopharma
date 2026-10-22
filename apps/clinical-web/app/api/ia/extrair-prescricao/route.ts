// M22 — Foto da prescrição → RASCUNHO (Gemini → Groq → extrator simulado). SOMENTE servidor: chaves nunca chegam ao navegador.
// Nada é gravado aqui: o rascunho só pré-preenche o formulário; a equipe revisa, registra (pendente) e a farmácia libera.
import { NextResponse } from 'next/server';
import { session } from '../../../../lib/auth';
import { syntheticUiEnabled } from '../../../../lib/synthetic';
import { extractPrescription, GuardError, MAX_IMAGE_BYTES } from '../../../../../../services/ai-orchestrator/src/prescription-extract/index.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'cache-control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const err = (error: string, status: number) => NextResponse.json({ error }, { status, headers: H });
export async function POST(req: Request) {
  if (!syntheticUiEnabled()) return err('Recurso não habilitado (somente ambiente de teste com dados fictícios)', 503);
  const s = await session(); if (!s) return err('Não autenticado', 401);
  const origin = req.headers.get('origin'), configured = process.env.PORTAL_ORIGIN;
  if (!origin || !configured || origin !== new URL(configured).origin) return err('Origem não autorizada', 403);
  const raw = await req.text(); if (raw.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4096) return err('Imagem maior que 4 MB', 413);
  let body: { patientId?: unknown; fictional?: unknown; mimeType?: unknown; imageBase64?: unknown };
  try { body = JSON.parse(raw); } catch { return err('JSON inválido', 400); }
  const org = process.env.DEV_ORGANIZATION_ID; if (!org || !UUID.test(org)) return err('Configuração ausente', 503);
  if (typeof body.patientId !== 'string' || !UUID.test(body.patientId)) return err('Paciente inválido', 400);
  // Autorização pela API (MFA + papel que transcreve + vínculo assistencial com o paciente).
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const r = await fetch(`${base}/v1/clinical/patients/${body.patientId}/med-transcriptions`, { headers: { authorization: `Bearer ${s.token}`, 'x-organization-id': org }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!r.ok) return err('Sem permissão para transcrever para este paciente', r.status === 401 ? 401 : 403);
    if ((await r.json() as { canEnter?: boolean }).canEnter !== true) return err('Somente farmácia, enfermagem ou medicina transcrevem a prescrição', 403);
  } catch { return err('Não foi possível conectar à API', 503); }
  try { return NextResponse.json(await extractPrescription({ fictional: body.fictional, mimeType: body.mimeType, imageBase64: body.imageBase64 }), { headers: H }); }
  catch (e) {
    if (e instanceof GuardError) return err(e.message, 422);
    console.error('[ia-extrair-prescricao] falha', e instanceof Error ? e.name : 'erro'); // sem imagem, sem chave
    return err('Extração indisponível', 503);
  }
}
