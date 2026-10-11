// M15.1 — verificação de identidade (Plano Diretor v3 §2.2/§2.3/WCAG 2.2 AA). Falha fechado.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const errors = [];
const PLANO = { teal: '#063f3b', emerald: '#15735d', navy: '#0a344a', gold: '#d7a858', mint: '#b9e1d0', canvas: '#f5f8f7', ink: '#152c32', danger: '#b42318' };
const palette = JSON.parse(read('packages/design-system/palette.json'));
const derived = Object.fromEntries(Object.entries(palette.derived).map(([k, v]) => [k.replace(/^--/, ''), v.hex.toLowerCase()]));
const NEUTRAL = new Set(palette.neutral);
const tokenHex = new Set(Object.values(PLANO));
const APPS = ['apps/care-web', 'apps/clinical-web', 'apps/admin-web'];
const CSS = ['packages/design-system/app/globals.css', ...APPS.map((a) => `${a}/app/globals.css`)];
function rootVars(css) { const m = css.match(/:root\{([\s\S]*?)\}/); const vars = {}; if (!m) return vars; for (const d of m[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/gi)) vars[d[1]] = d[2].trim().toLowerCase(); return vars; }
const base = (h) => (h.length === 9 ? h.slice(0, 7) : h.length === 5 ? h.slice(0, 4) : h);
// 1–2. :root = Plano §2.2; derivados = lista fechada; fora de :root só var()/neutros
for (const f of CSS) {
  const css = read(f), vars = rootVars(css);
  for (const [k, v] of Object.entries(PLANO)) if (vars[k] !== v) errors.push(`${f}: --${k} deve ser ${v} (Plano §2.2), encontrado ${vars[k] ?? 'ausente'}`);
  for (const [k, v] of Object.entries(vars)) if (/^#/.test(v) && !(k in PLANO) && derived[k] !== v) errors.push(`${f}: --${k}:${v} não consta em palette.json`);
  const body = css.replace(/:root\{[\s\S]*?\}/, '');
  for (const h of body.match(/#[0-9a-fA-F]{3,8}\b/g) || []) if (!NEUTRAL.has(base(h.toLowerCase()))) errors.push(`${f}: cor literal fora de :root ${h} (use var(--…))`);
}
function files(dir, out = []) { for (const e of readdirSync(join(ROOT, dir))) { if (['node_modules', '.next', 'public'].includes(e)) continue; const p = join(dir, e); if (statSync(join(ROOT, p)).isDirectory()) files(p, out); else if (/\.(tsx?)$/.test(e)) out.push(p); } return out; }
const SRC = APPS.flatMap((a) => files(a));
for (const f of SRC) { const s = read(f);
  for (const h of s.match(/#[0-9a-fA-F]{3,8}\b/g) || []) if (!tokenHex.has(h.toLowerCase())) errors.push(`${f}: cor fora dos tokens ${h}`);
  if (/[®™]/.test(s)) errors.push(`${f}: símbolo ®/™ proibido sem registro (Plano §2.1)`);
  if (/\bIntelligence\b/.test(s.replace(/\/\/.*$/gm, ''))) errors.push(`${f}: "Intelligence" é módulo interno, não aparece na UI (Plano §2.1)`);
}
// 3. títulos
const titles = { 'apps/care-web': 'ONCOPHARMA Care', 'apps/clinical-web': 'ONCOPHARMA Clinical', 'apps/admin-web': 'ONCOPHARMA Admin' };
for (const [a, t] of Object.entries(titles)) if (!read(`${a}/app/layout.tsx`).includes(`title: '${t}'`)) errors.push(`${a}: <title> deve ser "${t}"`);
if (!files('apps/care-web').some((f) => read(f).includes('Um passo de cada vez. Juntos no cuidado.'))) errors.push('Care: assinatura ausente (Plano §2.1)');
// 4. contraste (WCAG 2.2: texto 4.5:1; foco/bordas de controle 3:1)
const all = { ...PLANO, ...derived, white: '#ffffff' };
const rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const lum = (c) => { const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(rgb(all[a])), lum(rgb(all[b]))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const PAIRS = [
  ['texto Care', 'ink-teal', 'mint-50', 4.5], ['texto Care em cartão', 'ink-teal', 'white', 4.5], ['rótulo Care', 'emerald', 'mint-50', 4.5],
  ['botão Care', 'white', 'emerald', 4.5], ['botão Clinical', 'white', 'navy', 4.5], ['cabeçalho Care', 'white', 'teal', 4.5], ['cabeçalho Clinical', 'white', 'navy-800', 4.5],
  ['texto Clinical', 'ink-navy', 'navy-50', 4.5], ['rótulo Clinical', 'gold-700', 'navy-50', 4.5], ['texto auxiliar', 'ink-muted', 'white', 4.5], ['nota Care', 'ink-muted', 'mint-50', 4.5], ['navegação Care', 'ink-teal', 'white', 4.5], ['botão secundário Care', 'teal', 'white', 4.5], ['botão Ligar 192', 'white', 'danger', 4.5], ['título urgente', 'danger', 'white', 4.5], ['borda de escolha', 'border-strong', 'white', 3], ['texto secundário', 'navy-text', 'navy-50', 4.5],
  ['aviso claro', 'gold-ink', 'gold-50', 4.5], ['rótulo planejado', 'emerald-ink', 'mint-100', 4.5], ['alerta crítico', 'danger', 'white', 4.5], ['texto claro', 'ink', 'canvas', 4.5],
  ['foco claro (Care)', 'navy', 'mint-50', 3], ['foco claro (Clinical)', 'navy', 'navy-50', 3], ['foco escuro (Care)', 'gold', 'teal', 3], ['foco escuro (Clinical)', 'gold', 'navy-800', 3],
  ['borda de controle', 'border-strong', 'white', 3], ['borda de controle (Care)', 'border-strong', 'mint-50', 3], ['borda de controle (painel)', 'border-strong', 'navy-100', 3],
  // M15.4 — Clinical: gravidade, abas, linha do tempo, mensagens.
  ['gravidade urgente', 'white', 'danger', 4.5], ['gravidade revisão', 'gold-ink', 'gold-50', 4.5], ['sem alerta', 'navy-text', 'navy-50', 4.5], ['texto secundário em cartão', 'navy-text', 'white', 4.5], ['aba ativa', 'navy', 'navy-50', 4.5], ['mensagem de sucesso', 'ink-teal', 'mint-50', 4.5], ['erro em cartão', 'danger', 'white', 4.5], ['borda de gravidade (revisão)', 'gold-700', 'gold-50', 3], ['borda pendente no checklist', 'gold-700', 'white', 3],
];
const table = PAIRS.map(([n, fg, bg, min]) => { const r = ratio(fg, bg); if (r < min) errors.push(`contraste ${n}: ${r.toFixed(2)} < ${min}`); return `${n.padEnd(28)} ${fg}/${bg} ${r.toFixed(2)}:1 (mín ${min})`; });
console.log(table.join('\n'));
if (errors.length) { console.error('IDENTIDADE: FALHA\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`Identidade: OK (${CSS.length} folhas de estilo, ${SRC.length} fontes TS/TSX, ${PAIRS.length} pares de contraste)`);
