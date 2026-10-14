// M15.4c — importação de PDF do hospital (somente sintético): extração por layout (Tasy colunas / MV linhas), marcação
// sintética obrigatória, limites, ação de prévia, cifra AES-256-GCM, BFF com rotas fechadas e confirmação humana.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const m = require('../services/api/dist/pdf-import.js');
const fx = (n) => readFileSync(new URL(`./fixtures/pdf/${n}.pdf`, import.meta.url));
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('Tasy (colunas): linhas, normalização e linha inválida sinalizada', async () => {
  const r = await m.readHospitalPdf(fx('censo-tasy-sintetico'), { requireSyntheticMarker: true });
  assert.equal(r.layout.id, 'tasy-censo-v1'); assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(r.rows.map((x) => x.record), ['PR-10021', 'PR-10024', 'PR-10026', 'PR-10025', 'PR-10031', 'XX']);
  assert.deepEqual(r.rows[0], { line: 4, record: 'PR-10021', name: 'Ana Ribeiro', unit: 'Oncologia Clínica', floor: '3º andar', room: '303', bed: 'A', error: null });
  assert.match(r.rows[5].error, /Prontuário/);
});
test('MV (linhas por regex): setor/andar/leito e nome', async () => {
  const r = await m.readHospitalPdf(fx('mapa-leitos-mv-sintetico'), { requireSyntheticMarker: true });
  assert.equal(r.layout.id, 'mv-mapa-leitos-v1');
  assert.deepEqual(r.rows[1], { line: 4, record: 'PR-10023', name: 'CARLOS MENEZES', unit: 'Hospital-Dia Oncológico', floor: 'Térreo', room: 'BOX06', bed: '1', error: null });
});
test('fail-closed: sem marcação sintética, não PDF, vazio, grande demais', async () => {
  await assert.rejects(m.readHospitalPdf(fx('censo-sem-marcador'), { requireSyntheticMarker: true }), /DADOS SINTÉTICOS/);
  await assert.rejects(m.readHospitalPdf(Buffer.from('<html>'), { requireSyntheticMarker: true }), /não é PDF/);
  await assert.rejects(m.readHospitalPdf(Buffer.alloc(0), { requireSyntheticMarker: true }), /vazio/);
  await assert.rejects(m.readHospitalPdf(Buffer.alloc(m.MAX_PDF_BYTES + 1, 1), { requireSyntheticMarker: true }), /2 MB/);
  await assert.rejects(m.readHospitalPdf(Buffer.from('%PDF-1.4 lixo'), { requireSyntheticMarker: true }), /ler o texto/);
  assert.equal(m.detectLayout('RELATÓRIO QUALQUER'), null);
});
test('prévia: criar / atualizar / sem alteração / divergência com hospital / sem vínculo / inválida', () => {
  const row = { line: 1, record: 'PR-1', name: 'Ana', unit: 'Onco', floor: '3º andar', room: '303', bed: 'A', error: null };
  const cur = (source, o = {}) => ({ linked: true, current: { unit: 'Onco', floor: '3º andar', room: '303', bed: 'A', source, ...o } });
  assert.equal(m.previewAction({ ...row, error: 'x' }, null), 'invalid');
  assert.equal(m.previewAction(row, null), 'create');
  assert.equal(m.previewAction(row, { linked: false, current: null }), 'not_linked');
  assert.equal(m.previewAction(row, cur('hospital')), 'unchanged');
  assert.equal(m.previewAction({ ...row, unit: ' ONCO ' }, cur('manual')), 'unchanged');
  assert.equal(m.previewAction(row, cur('hospital', { room: '301' })), 'conflict');
  assert.equal(m.previewAction(row, cur('manual', { room: '301' })), 'update');
  assert.equal(m.previewAction(row, cur('pdf', { room: '301' })), 'update');
  assert.equal(m.previewAction(row, { linked: true, current: null }), 'update');
  assert.ok(m.sameName('ANA RIBEIRO', 'Ana  Ribeiro')); assert.ok(!m.sameName('Ana', 'Ana Paula'));
});
test('cifra: AES-256-GCM, chave obrigatória de 32 bytes, adulteração detectada', () => {
  const old = process.env.IMPORT_ENCRYPTION_KEY;
  try {
    delete process.env.IMPORT_ENCRYPTION_KEY; assert.throws(() => m.importKey(), /IMPORT_ENCRYPTION_KEY/);
    process.env.IMPORT_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64'); assert.throws(() => m.importKey());
    process.env.IMPORT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const k = m.importKey(), buf = fx('censo-tasy-sintetico'), e = m.encryptFile(buf, k.key);
    assert.equal(e.iv.length, 12); assert.equal(e.tag.length, 16); assert.ok(!e.ciphertext.equals(buf));
    assert.ok(m.decryptFile(e, k.key).equals(buf));
    e.ciphertext[10] ^= 1; assert.throws(() => m.decryptFile(e, k.key));
  } finally { if (old === undefined) delete process.env.IMPORT_ENCRYPTION_KEY; else process.env.IMPORT_ENCRYPTION_KEY = old; }
});
test('API/BFF: prévia não grava paciente/alocação; confirmação reavalia; conflitos só marcados; rotas e limites fechados', () => {
  const s = read('services/api/src/clinical-work.controller.ts');
  const prev = s.slice(s.indexOf("@Post('imports/pdf')"), s.indexOf("@Post('imports/:importId/confirm')"));
  assert.doesNotMatch(prev, /INSERT INTO (patients|patient_allocations|care_assignments)/);
  assert.match(prev, /requireSyntheticMarker: true/); assert.match(prev, /IMPORT_ROLES\.includes/);
  const conf = s.slice(s.indexOf("@Post('imports/:importId/confirm')"), s.indexOf("@Post('imports/:importId/discard')"));
  assert.match(conf, /applyConflicts\.includes\(r\.id\)/); assert.match(conf, /Dados mudaram desde a prévia/); assert.match(conf, /ownImport/);
  assert.match(s, /Prévia expirada/);
  for (const k of ['patient.import.previewed', 'patient.import.confirmed', 'patient.import.discarded']) assert.ok(s.includes(`'${k}'`), k);
  const p = read('apps/clinical-web/lib/work-proxy.ts');
  assert.match(p, /\^imports\\\/pdf\$/); assert.match(p, /\(confirm\|discard\)\$/); assert.match(p, /path === 'imports\/pdf' \? 2_900_000 : 8192/);
  assert.match(read('services/api/src/main.ts'), /'\/v1\/clinical\/imports\/pdf', json\(\{ limit: '3mb' \}\)/);
  const ui = read('apps/clinical-web/components/clinical/PdfImport.tsx');
  assert.doesNotMatch(ui, /\b(teste|fict[ií]cio)/i); assert.match(ui, /Confirmar importação/); assert.match(ui, /<details/);
});
