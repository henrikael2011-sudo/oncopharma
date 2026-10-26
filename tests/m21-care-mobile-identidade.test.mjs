// M21 — identidade Care mobile: abas inferiores, paleta isolada, esqueleto, marca d'água, selo fictício e "equipe decide".
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const r = (p) => fs.readFileSync(p, 'utf8');
const css = r('apps/care-web/app/care/care-mobile.css');
test('abas Início/Sintomas/Remédios/Equipe/Alertas mapeadas a rotas existentes', () => {
  const s = r('apps/care-web/components/care/CareShell.tsx');
  for (const [h, l] of [['/care', 'Início'], ['/care/sintoma', 'Sintomas'], ['/care/medicamentos', 'Remédios'], ['/care/equipe', 'Equipe'], ['/care/alertas', 'Alertas']]) { assert.ok(s.includes(`['${h}', '${l}'`), l); assert.ok(fs.existsSync(`apps/care-web/app${h}/page.tsx`), h); }
  assert.match(css, /\.cm-tabs a\{[^}]*min-height:64px;min-width:56px/);
  assert.match(r('apps/care-web/components/DemoLabels.tsx'), /Dados fictícios · demonstração não clínica/); assert.match(s, /\{testEnv && <span className="cm-demo">\{DEMO_TAG\}<\/span>\}/); assert.match(s, /Sua equipe de saúde avalia e decide/);
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
  for (const f of ['Team', 'Alerts']) { const s = r(`apps/care-web/components/care/${f}.tsx`); for (const m of s.matchAll(/btn-danger[^>]*href="([^"]+)"/g)) assert.equal(m[1], 'tel:192'); assert.match(s, /\{STATIC_EXAMPLE\}/); }
});
test('febre 37,8 °C em todo o Care; nenhum 38,0', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => ['node_modules', '.next'].includes(e.name) ? [] : e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(tsx?|css)$/.test(e.name) ? [`${d}/${e.name}`] : []);
  for (const f of walk('apps/care-web')) assert.doesNotMatch(r(f), /38[,.]0\b|38 °C/, f);
  const g = r('apps/care-web/lib/care-guidance.ts'); assert.match(g, /FEVER_THRESHOLD_C = 37\.8/); assert.match(g, /'Febre \(37,8 °C ou mais\)'/);
  assert.match(r('services/api/src/care-rules.ts'), /febre: 'Febre \(37,8 °C ou mais\)'/); // mesma regra aprovada da API
});
test('textos clínicos só das fontes aprovadas (sem passos copiados de mockup)', () => {
  for (const f of ['Team', 'Alerts', 'Medications', 'SymptomFlow', 'TempChart']) { const s = r(`apps/care-web/components/care/${f}.tsx`);
    for (const bad of [/Meça de novo/, /Vômito que não para/, /desmaio/, /pergunte à farmacêutica/, /Descanse e beba/]) assert.doesNotMatch(s, bad, `${f}: ${bad}`); }
  assert.match(r('apps/care-web/components/care/Help.tsx'), /WARNING_SIGNS\.map/);
});
test('gráfico de temperatura: grade, linha, preenchimento, limiar dourado tracejado, esqueleto, vazio; sem exemplo estático', () => {
  const c = r('apps/care-web/components/care/TempChart.tsx');
  for (const k of ['cm-chart-grid', 'cm-chart-line', 'cm-chart-fill', 'cm-chart-fever', '<Skeleton', 'data-temp-empty', "care<{ readings: Reading[] }>('me/temperatures')"]) assert.ok(c.includes(k), k);
  assert.doesNotMatch(c, /Exemplo estático|DEMO_TEMPS/);
  assert.match(css, /\.cm-chart-fever\{stroke:var\(--cm-gold\);stroke-width:2;stroke-dasharray/); assert.match(css, /\.cm-chart-line\{fill:none;stroke:var\(--cm-green-900\)/);
  assert.match(r('apps/care-web/components/care/SymptomFlow.tsx'), /<TemperatureSection \/>/);
});
test('DemoLabels.tsx: só constantes de texto (isenção restrita do teste M15.2)', () => {
  const d = r('apps/care-web/components/DemoLabels.tsx').replace(/\/\/.*$/gm, '').trim().split('\n');
  for (const l of d) assert.match(l, /^export const [A-Z_]+ = '[^']+';$/, l);
});
test('mockups oficiais 21/10: fontes Bricolage/Manrope locais, menu lateral desktop, faixa superior e rodapé "equipe decide"', () => {
  const f = r('apps/care-web/app/care/care-fonts.ts'); assert.match(f, /BricolageGrotesque-Variable\.ttf/); assert.match(f, /Manrope-Variable\.ttf/); assert.doesNotMatch(f, /googleapis|https?:/);
  for (const t of ['BricolageGrotesque-Variable.ttf', 'Manrope-Variable.ttf', 'LICENSE-OFL.txt']) assert.ok(fs.existsSync(`apps/care-web/app/care/fonts/${t}`), t);
  assert.match(css, /font-family:var\(--cm-font-title\)/); assert.match(css, /font-family:var\(--cm-font-body\)/);
  const s = r('apps/care-web/components/care/CareShell.tsx');
  for (const [h, l] of [['/care', 'Início'], ['/care/sintoma', 'Sintomas e febre'], ['/care/medicamentos', 'Medicação do dia'], ['/care/equipe', 'Falar com a equipe'], ['/care/alertas', 'Alertas']]) assert.ok(s.includes(`['${h}', '${l}'`), l);
  assert.match(s, /className="cm-side"/); assert.match(s, /className="cm-top"/); assert.match(s, /Quem avalia e decide é a sua equipe de saúde\./);
  assert.match(css, /@media\(min-width:1024px\)\{\n  \.care-page\.cm-app\{display:grid;grid-template-columns:240px/);
});
test('sem botão morto: ações sem backend ficam desabilitadas ou mostram "Em breve"; ligações só com tel:', () => {
  const team = r('apps/care-web/components/care/Team.tsx'), home = r('apps/care-web/components/care/CareHome.tsx'), al = r('apps/care-web/components/care/Alerts.tsx');
  assert.match(team, /disabled aria-disabled="true" title="Em breve: mensagens pelo app ainda não disponíveis"/);
  assert.match(team, /href=\{tel\(phone\)\}/); assert.match(al, /href=\{tel\(phone\)\}/); assert.match(al, /Em breve: o telefone do seu serviço/);
  assert.match(home, /data-soon="checkin"/); assert.match(home, /me\/medications\/\$\{nd\.med\.id\}\/adherence/);
  for (const x of [team, home, al]) for (const m of x.matchAll(/<button(?![^>]*\b(onClick|disabled|type="submit")\b)[^>]*>/g)) assert.fail('botão sem ação: ' + m[0]);
});
