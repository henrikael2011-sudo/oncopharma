// M15.4c — Importação de lista de pacientes a partir de PDF exportado pelo hospital (somente SINTÉTICO em dev/testes).
// Extração de texto (pdf.js, sem eval/fontes), layout por fornecedor, normalização, prévia; cifra do original (AES-256-GCM).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PDF_LAYOUTS, type PdfLayout } from './pdf-layouts';

export const MAX_PDF_BYTES = 2 * 1024 * 1024, MAX_PAGES = 20, MAX_ROWS = 300;
export const SYNTHETIC_MARKER = 'DADOS SINTÉTICOS';
export type PdfRow = { line: number; record: string | null; name: string | null; unit: string | null; floor: string | null; room: string | null; bed: string | null; error: string | null };
type Item = { str: string; x: number; y: number; page: number };

// pdf.js é ESM puro; a API compila para CommonJS — import() real preservado (não transpilado para require).
const esmImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
export async function extractItems(buf: Buffer): Promise<Item[]> {
  const pdfjs = await esmImport('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, enableXfa: false, stopAtErrors: true, verbosity: 0 });
  const doc = await task.promise;
  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`PDF com mais de ${MAX_PAGES} páginas`);
    const out: Item[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      for (const it of tc.items as { str?: string; transform?: number[] }[]) if (it.str && it.str.trim() && it.transform) out.push({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], page: p });
    }
    return out;
  } finally { await task.destroy(); }
}
/** Agrupa itens em linhas (mesma página e y ±2), ordenadas de cima para baixo e da esquerda para a direita. */
export function toLines(items: Item[]) {
  const lines: { page: number; y: number; items: Item[] }[] = [];
  for (const it of [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)) {
    const l = lines.find((x) => x.page === it.page && Math.abs(x.y - it.y) <= 2);
    if (l) l.items.push(it); else lines.push({ page: it.page, y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines.map((l) => ({ ...l, text: l.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ') }));
}
export function detectLayout(fullText: string, layouts: PdfLayout[] = PDF_LAYOUTS): PdfLayout | null {
  return layouts.find((l) => fullText.toUpperCase().includes(l.detect.toUpperCase())) ?? null;
}
const RECORD = /^[A-Za-z0-9-]{3,30}$/;
const clean = (v: string | undefined | null, max: number) => { const s = (v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim(); return s ? s.slice(0, max) : null; };
function finish(line: number, f: Partial<Record<'record' | 'name' | 'unit' | 'floor' | 'room' | 'bed', string>>): PdfRow {
  const r: PdfRow = { line, record: clean(f.record, 30), name: clean(f.name, 80), unit: clean(f.unit, 80), floor: clean(f.floor, 40), room: clean(f.room, 40), bed: clean(f.bed, 20), error: null };
  if (!r.record || !RECORD.test(r.record)) r.error = 'Prontuário ausente ou inválido';
  else if (!r.name || r.name.length < 2) r.error = 'Nome ausente';
  else if (!r.unit || r.unit.length < 2) r.error = 'Unidade ausente';
  return r;
}
export function parseRows(lines: ReturnType<typeof toLines>, layout: PdfLayout): PdfRow[] {
  const rows: PdfRow[] = [];
  if (layout.mode === 'regex') {
    const re = new RegExp(layout.line);
    lines.forEach((l, i) => { const m = re.exec(l.text); if (m?.groups) rows.push(finish(i + 1, m.groups)); else if (/^Leito\b/i.test(l.text)) rows.push({ ...finish(i + 1, {}), error: 'Linha fora do layout' }); });
  } else {
    const labels = Object.keys(layout.columns);
    const hi = lines.findIndex((l) => labels.every((h) => l.items.some((it) => it.str === h)));
    if (hi < 0) throw new Error('Cabeçalho do layout não encontrado');
    const header = lines[hi];
    const cols = labels.map((h) => ({ field: layout.columns[h], x: header.items.find((it) => it.str === h)!.x })).sort((a, b) => a.x - b.x);
    for (let i = hi + 1; i < lines.length; i++) {
      const l = lines[i]; if (l.page !== header.page && !labels.every((h) => l.items.some((it) => it.str === h)) && l.items.length < 2) continue;
      if (/^Página \d+/i.test(l.text) || labels.every((h) => l.items.some((it) => it.str === h))) continue;
      const f: Record<string, string> = {};
      for (const it of l.items) { const c = [...cols].reverse().find((c) => it.x >= c.x - 4); if (c) f[c.field] = f[c.field] ? `${f[c.field]} ${it.str}` : it.str; }
      if (Object.keys(f).length) rows.push(finish(i + 1, f));
    }
  }
  if (rows.length > MAX_ROWS) throw new Error(`Mais de ${MAX_ROWS} linhas`);
  return rows;
}
/** Validação do arquivo + extração + layout. Falha fechada: sem marcação sintética, não importa (proteção do ambiente dev). */
export async function readHospitalPdf(buf: Buffer, opts: { requireSyntheticMarker: boolean }) {
  if (buf.length === 0 || buf.length > MAX_PDF_BYTES) throw new Error('Arquivo vazio ou maior que 2 MB');
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Arquivo não é PDF');
  let items: Item[];
  try { items = await extractItems(buf); } catch (e) { throw new Error((e as Error).message.startsWith('PDF com') ? (e as Error).message : 'Não foi possível ler o texto do PDF'); }
  const lines = toLines(items), full = lines.map((l) => l.text).join('\n');
  if (opts.requireSyntheticMarker && !full.toUpperCase().includes(SYNTHETIC_MARKER)) throw new Error('Este ambiente aceita somente PDFs com a marcação "DADOS SINTÉTICOS"');
  const layout = detectLayout(full);
  if (!layout) throw new Error('Layout do PDF não reconhecido (configure o layout do fornecedor)');
  return { layout, rows: parseRows(lines, layout), sha256: createHash('sha256').update(buf).digest('hex') };
}
const fold = (s: string | null) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const sameName = (a: string | null, b: string | null) => fold(a) === fold(b);
export type PreviewAction = 'create' | 'update' | 'unchanged' | 'conflict' | 'not_linked' | 'invalid';
/** Ação de prévia para uma linha. Hospital (sincronização) divergente => conflito (não aplicado sem marcação explícita). */
export function previewAction(row: PdfRow, existing: { linked: boolean; current: { unit: string; floor: string | null; room: string | null; bed: string | null; source: string } | null } | null): PreviewAction {
  if (row.error) return 'invalid';
  if (!existing) return 'create';
  if (!existing.linked) return 'not_linked';
  const c = existing.current;
  const same = c && fold(c.unit) === fold(row.unit) && fold(c.floor) === fold(row.floor) && fold(c.room) === fold(row.room) && fold(c.bed) === fold(row.bed);
  if (same) return 'unchanged';
  if (c?.source === 'hospital') return 'conflict';
  return 'update';
}
/** AES-256-GCM com chave de ambiente (32 bytes base64). Sem chave => importação indisponível (fail-closed). */
export function importKey(): { key: Buffer; id: string } {
  const raw = process.env.IMPORT_ENCRYPTION_KEY; const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (key.length !== 32) throw new Error('IMPORT_ENCRYPTION_KEY ausente ou inválida');
  return { key, id: createHash('sha256').update(key).digest('hex').slice(0, 12) };
}
export function encryptFile(buf: Buffer, key: Buffer) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([c.update(buf), c.final()]);
  return { iv, tag: c.getAuthTag(), ciphertext };
}
export function decryptFile(e: { iv: Buffer; tag: Buffer; ciphertext: Buffer }, key: Buffer) {
  const d = createDecipheriv('aes-256-gcm', key, e.iv); d.setAuthTag(e.tag); return Buffer.concat([d.update(e.ciphertext), d.final()]);
}
