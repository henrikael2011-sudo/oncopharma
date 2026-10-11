// M15.1 — identidade: somente tokens aprovados (Plano v3 §2.2) em código novo; nomes de marca exatos; sem ®.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
import { spawnSync } from 'node:child_process';
const APPS = ['apps/care-web', 'apps/clinical-web', 'apps/admin-web'];
function files(dir, out = []) { for (const e of readdirSync(dir)) { if (['node_modules', '.next', 'public'].includes(e)) continue; const p = join(dir, e); if (statSync(p).isDirectory()) files(p, out); else if (/\.(tsx?|css)$/.test(e)) out.push(p); } return out; }
const all = APPS.flatMap((a) => files(join(root, a)));
test('tools/check-brand.mjs: tokens §2.2, sem cores fora da paleta, contraste AA, títulos, sem ®', () => {
  const r = spawnSync(process.execPath, [join(root, 'tools/check-brand.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
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
