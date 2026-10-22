// M18 — prescrição por foto fase A: fictícia, sem decisão automática, defaults PROVISÓRIOS documentados.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const c = fs.readFileSync('apps/clinical-web/components/clinical/PrescricaoFoto.tsx', 'utf8');
const d = fs.readFileSync('apps/clinical-web/lib/prescricao-ficticia.ts', 'utf8');
const doc = fs.readFileSync('docs/decisoes-provisorias-prescricao-foto.md', 'utf8');
test('fase A: dados fictícios, fase B bloqueada, não liberado', () => {
  assert.match(d, /FASE_B_HABILITADA = false/); assert.match(d, /readyForClinicalUse = false/);
  assert.doesNotMatch(c + d, /fetch\(|care\(|clinical\(|<input[^>]*type="file"/);
  assert.match(c, /Não liberado para uso clínico/); assert.match(c, /A IA não decide/); assert.match(c, /Resumo com IA · rascunho/);
});
test('validar/desvalidar por item e rodapé', () => { assert.match(c, /Validar/); assert.match(c, /Desvalidar/); assert.match(c, /rx-footer/); });
test('4 decisões PROVISÓRIAS marcadas no código e no doc', () => {
  for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) { assert.match(c + d, new RegExp(`PROVISÓRIO \\(${q}`)); assert.match(doc, new RegExp(`${q}`)); }
});
test('CSS sem cores fora da paleta', () => {
  const css = fs.readFileSync('apps/clinical-web/app/globals.css', 'utf8'); const m18 = css.slice(css.indexOf('/* M18'));
  assert.doesNotMatch(m18.replace(/#fff\b/g, ''), /#[0-9a-f]{3,6}\b/i);
});
