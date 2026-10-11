// M15.1 — identidade: somente tokens aprovados (Plano v3 §2.2) em código novo; nomes de marca exatos; sem ®.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const palette = JSON.parse(readFileSync(join(root, 'packages/design-system/palette.json'), 'utf8'));
const tokens = new Set(Object.keys(palette.tokens)), neutral = new Set(palette.neutral), baseline = new Set(palette.baseline_derivatives);
const APPS = ['apps/care-web', 'apps/clinical-web', 'apps/admin-web'];
function files(dir, out = []) { for (const e of readdirSync(dir)) { if (['node_modules', '.next', 'public'].includes(e)) continue; const p = join(dir, e); if (statSync(p).isDirectory()) files(p, out); else if (/\.(tsx?|css)$/.test(e)) out.push(p); } return out; }
const all = APPS.flatMap((a) => files(join(root, a)));
const base = (h) => (h.length === 9 ? h.slice(0, 7) : h.length === 5 ? h.slice(0, 4) : h);
test('tokens do Plano v3 §2.2 inalterados', () => {
  assert.deepEqual(palette.tokens, { '#063f3b': 'brand.deepTeal', '#15735d': 'brand.emerald', '#0a344a': 'brand.navy', '#d7a858': 'brand.gold', '#b9e1d0': 'brand.mint', '#f5f8f7': 'neutral.canvas', '#152c32': 'neutral.ink', '#b42318': 'danger' });
});
test('nenhuma cor fora da paleta em apps/* (TS/TSX: só tokens; CSS: tokens, neutros ou derivados congelados)', () => {
  const bad = [];
  for (const f of all) {
    const src = readFileSync(f, 'utf8');
    for (const raw of src.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
      const h = raw.toLowerCase(), ok = f.endsWith('.css') ? tokens.has(base(h)) || neutral.has(base(h)) || baseline.has(h) : tokens.has(h);
      if (!ok) bad.push(`${f.replace(root, '')}: ${raw}`);
    }
  }
  assert.deepEqual(bad, []);
});
test('nomes de marca exatos e sem ®', () => {
  const bad = [];
  for (const f of all) {
    const src = readFileSync(f, 'utf8'), rel = f.replace(root, '');
    if (src.includes('®')) bad.push(`${rel}: ®`);
    for (const m of src.match(/\b(?:Onco[Pp]harma|ONCO PHARMA|ONCOPHARMA(?:CARE|CLINICAL|-Care|-Clinical)|ONCOPHARMA (?:CARE|CLINICAL|care|clinical))\b/g) || []) bad.push(`${rel}: ${m}`);
  }
  assert.deepEqual(bad, []);
  const brand = (a) => readFileSync(join(root, a, 'components/Brand.tsx'), 'utf8');
  assert.match(brand('apps/care-web'), /ONCOPHARMA Care/); assert.match(brand('apps/clinical-web'), /ONCOPHARMA Clinical/);
});
