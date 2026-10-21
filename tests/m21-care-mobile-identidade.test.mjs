// M21 — identidade Care mobile: abas inferiores, paleta isolada, esqueleto, marca d'água, selo fictício e "equipe decide".
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const r = (p) => fs.readFileSync(p, 'utf8');
const css = r('apps/care-web/app/care/care-mobile.css');
test('abas Início/Sintomas/Remédios/Equipe/Alertas mapeadas a rotas existentes', () => {
  const s = r('apps/care-web/components/care/CareShell.tsx');
  for (const [h, l] of [['/care', 'Início'], ['/care/sintoma', 'Sintomas'], ['/care/medicamentos', 'Remédios'], ['/care/equipe', 'Equipe'], ['/care/alertas', 'Alertas']]) { assert.ok(s.includes(`['${h}', '${l}'`), l); assert.ok(fs.existsSync(`apps/care-web/app${h}/page.tsx`), h); }
  assert.match(css, /\.cm-tabs a\{[^}]*min-height:64px;min-width:56px/);
  assert.match(s, /Dados fictícios · demonstração não clínica/); assert.match(s, /Sua equipe de saúde avalia e decide/);
});
test('paleta M21 só no bloco .care-page; fora dele apenas var()', () => {
  const pal = JSON.parse(r('packages/design-system/care-mobile-palette.json')).vars;
  const [head, ...rest] = css.split('--cm-grad:'); const body = rest.join('').replace(/^[^}]*\}/, '');
  for (const h of body.match(/#[0-9a-fA-F]{3,8}\b/g) || []) assert.fail('hex fora do bloco: ' + h);
  for (const [k, v] of Object.entries(pal)) assert.ok(head.includes(`${k}:${v}`), k);
  assert.match(css, /--cm-grad:linear-gradient\(110deg,var\(--cm-green-900\)/);
});
test('esqueleto em vez de spinner, marcas d\'água 9% e vermelho só no 192', () => {
  assert.match(css, /opacity:\.09/); assert.match(css, /care-gold-deep\.svg/); assert.match(css, /\.care-page::before\{right:/); assert.match(css, /\.care-page::after\{left:/);
  assert.match(r('apps/care-web/components/care/CareShell.tsx'), /<Skeleton label=/);
  for (const f of ['Team', 'Alerts']) { const s = r(`apps/care-web/components/care/${f}.tsx`); for (const m of s.matchAll(/btn-danger[^>]*href="([^"]+)"/g)) assert.equal(m[1], 'tel:192'); assert.match(s, /Exemplo estático · fictício/); }
});
