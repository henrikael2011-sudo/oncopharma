// M15.4c — gera PDFs 100% SINTÉTICOS em dois layouts (censo estilo Tasy em colunas; mapa de leitos estilo MV em linhas)
// para testes/dev. Nunca usar dados reais. Saída: tests/fixtures/pdf/*.pdf (versionados; reprodutíveis).
import { writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
const OUT = new URL('../tests/fixtures/pdf/', import.meta.url);
const FIXED = new Date('2026-10-11T12:00:00Z');
async function doc(title, draw) {
  const d = await PDFDocument.create(); d.setTitle(title); d.setProducer('ONCOPHARMA gerador sintético'); d.setCreator('tools/gen-synthetic-pdfs.mjs'); d.setCreationDate(FIXED); d.setModificationDate(FIXED);
  const font = await d.embedFont(StandardFonts.Helvetica), bold = await d.embedFont(StandardFonts.HelveticaBold);
  const page = d.addPage([842, 595]); // A4 paisagem
  draw({ text: (s, x, y, o = {}) => page.drawText(s, { x, y, size: o.size ?? 10, font: o.bold ? bold : font, color: rgb(0.1, 0.1, 0.1) }) });
  return Buffer.from(await d.save({ useObjectStreams: false }));
}
const tasy = await doc('Censo hospitalar sintético', ({ text }) => {
  text('HOSPITAL SIMULADO — CENSO HOSPITALAR (layout Tasy)', 40, 550, { bold: true, size: 13 });
  text('Emitido em 11/10/2026 09:00 — DADOS SINTÉTICOS — sem pacientes reais', 40, 532);
  const X = [40, 130, 330, 520, 610, 690];
  ['Prontuário', 'Paciente', 'Unidade', 'Andar', 'Quarto', 'Leito'].forEach((h, i) => text(h, X[i], 500, { bold: true }));
  const rows = [
    ['PR-10021', 'Ana Ribeiro', 'Oncologia Clínica', '3º andar', '303', 'A'],
    ['PR-10024', 'Débora Nunes', 'Oncologia Clínica', '4º andar', '412', 'B'],
    ['PR-10026', 'Fábio R. Rocha', 'Oncologia Clínica', '3º andar', '305', 'A'],
    ['PR-10025', 'Elisa Prado', 'Oncologia Clínica', '4º andar', '402', 'A'],
    ['PR-10031', 'Gustavo Lima', 'Oncologia Clínica', '4º andar', '401', 'A'],
    ['XX', 'Linha ilegível', '', '', '', ''],
  ];
  rows.forEach((r, j) => r.forEach((c, i) => c && text(c, X[i], 480 - j * 18)));
  text('Página 1 de 1 — documento sintético gerado para testes ONCOPHARMA', 40, 40, { size: 8 });
});
const mv = await doc('Mapa de leitos sintético', ({ text }) => {
  text('MAPA DE LEITOS — HOSPITAL SIMULADO (layout MV)', 40, 550, { bold: true, size: 13 });
  text('DADOS SINTÉTICOS — 11/10/2026 09:30', 40, 532);
  const lines = [
    'Leito 303-A   Setor: Oncologia Clínica - 3º andar   Pront.: PR-10021   Paciente: ANA RIBEIRO   Conv.: SUS',
    'Leito BOX06-1   Setor: Hospital-Dia Oncológico - Térreo   Pront.: PR-10023   Paciente: CARLOS MENEZES   Conv.: SUS',
    'Leito 404-B   Setor: Oncologia Clínica - 4º andar   Pront.: PR-10032   Paciente: HELOISA DIAS   Conv.: PARTICULAR',
  ];
  lines.forEach((l, j) => text(l, 40, 500 - j * 20));
});
const semMarcador = await doc('Censo sem marcação', ({ text }) => {
  text('HOSPITAL — CENSO HOSPITALAR (layout Tasy)', 40, 550, { bold: true, size: 13 });
  ['Prontuário', 'Paciente', 'Unidade', 'Andar', 'Quarto', 'Leito'].forEach((h, i) => text(h, [40, 130, 330, 520, 610, 690][i], 500, { bold: true }));
});
writeFileSync(new URL('censo-tasy-sintetico.pdf', OUT), tasy);
writeFileSync(new URL('mapa-leitos-mv-sintetico.pdf', OUT), mv);
writeFileSync(new URL('censo-sem-marcador.pdf', OUT), semMarcador);
console.log('PDFs sintéticos gerados em tests/fixtures/pdf/');
