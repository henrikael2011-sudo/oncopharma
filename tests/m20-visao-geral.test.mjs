// M20 — Visão geral do farmacêutico: regras (febre >= 38,0 °C, estabilidade), rota da API restrita a vínculos, BFF, tela e migração.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const r = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const rules = require('../services/api/dist/overview-rules.js');
test('febre: limiar 38,0 °C inclusivo; prioridade só ordena', () => {
  assert.equal(rules.FEVER_THRESHOLD_C, 38.0);
  assert.equal(rules.isFever(38.0), true); assert.equal(rules.isFever(37.9), false); assert.equal(rules.isFever(NaN), false);
  assert.equal(rules.feverPriority(38.6), 'alta'); assert.equal(rules.feverPriority(38.1), 'media');
});
test('estabilidade: restante, % usado, nível e rótulo', () => {
  const now = new Date('2026-10-21T19:00:00Z');
  const s = rules.stability(new Date(now.getTime() - 260 * 60000), 6, now);
  assert.deepEqual(s, { remainingMinutes: 100, usedPercent: 72, expired: false, level: 'critico' });
  assert.equal(rules.stability(new Date(now.getTime() - 60 * 60000), 6, now).level, 'atencao');
  assert.equal(rules.stability(new Date(now.getTime()), 16, now).level, 'ok');
  assert.equal(rules.stability(new Date(now.getTime() - 10 * 3600000), 6, now).expired, true);
  assert.equal(rules.remainingLabel(100), '1 h 40 min'); assert.equal(rules.remainingLabel(540), '9 h'); assert.equal(rules.remainingLabel(45), '45 min');
  assert.equal(rules.remainingLabel(150 * 60), '6 dias'); assert.equal(rules.remainingLabel(0), 'Vencido');
  assert.equal(rules.STABILITY_NOTICE, 'Prazos ilustrativos — conferir na bula do fabricante');
});
test('API: GET clinical/overview só lê pacientes vinculados, usa limiar das regras e é auditada', () => {
  const c = r('services/api/src/clinical-work.controller.ts');
  const ep = c.slice(c.indexOf("@Get('overview')"), c.indexOf("@Get('worklist')"));
  assert.ok(ep.length > 500);
  assert.match(ep, /ca\.oidc_issuer=\$2 AND ca\.oidc_sub=\$3 AND ca\.active=true/);
  assert.match(ep, /kind='temperature'/); assert.match(ep, /isFever\(/); assert.match(ep, /preparation_stability/);
  assert.match(ep, /'clinical\.overview\.read'/); assert.match(ep, /href: '\/clinical\/conferencia-ia'/);
  assert.doesNotMatch(ep, /INSERT INTO (?!audit)|UPDATE |DELETE /);
});
test('BFF: somente GET overview liberado', async () => {
  const s = r('apps/clinical-web/lib/work-proxy.ts');
  assert.match(s, /\['GET', \/\^overview\$\/\]/); assert.doesNotMatch(s, /\['POST', \/\^overview/);
});
test('tela: farmacêutico cai na Visão geral; atalho IA; febre; vencimentos ilustrativos; tag fictícia; IA não decide', () => {
  const page = r('apps/clinical-web/app/clinical/page.tsx');
  assert.match(page, /me\.role === 'pharmacist' \? <PharmacistOverview \/> : <Worklist \/>/);
  assert.match(r('apps/clinical-web/app/clinical/pacientes/page.tsx'), /<Worklist \/>/);
  const v = r('apps/clinical-web/components/clinical/PharmacistOverview.tsx');
  for (const t of ['Pendências do dia', 'Alertas de febre', 'O que vence', 'Abrir conferência com IA', 'href="/clinical/conferencia-ia"', 'IA não decide', 'Prazos ilustrativos — conferir na bula do fabricante', 'Dados fictícios · demonstração não clínica', 'Conduta clínica definida pela equipe médica'])
    assert.ok(v.includes(t), t);
  assert.match(v, /work<Overview>\('overview'\)/); assert.doesNotMatch(v, /fetch\(/);
  const shell = r('apps/clinical-web/components/clinical/ClinicalShell.tsx');
  assert.match(shell, /<DemoTag \/>/); assert.match(r('apps/clinical-web/components/clinical/DemoTag.tsx'), /⚠ Dados fictícios · demonstração não clínica/); assert.match(shell, /'Visão geral'/);
  assert.match(shell, /href="\/api\/auth\/login">Entrar com identidade institucional/); // login segue no Keycloak (OIDC)
});
test('migração 0015 e seed: somente DEV, RLS, leitura para o app, prazos ilustrativos', () => {
  const m = r('infra/migrations/0015_preparation_stability.sql');
  assert.match(m, /current_database\(\) <> 'oncopharma_dev'/); assert.match(m, /FORCE ROW LEVEL SECURITY/);
  assert.match(m, /GRANT SELECT ON preparation_stability TO oncopharma_app/); assert.doesNotMatch(m, /GRANT (INSERT|UPDATE|DELETE)/);
  assert.match(m, /DEFAULT 'Prazos ilustrativos — conferir na bula do fabricante'/); assert.match(m, /CHECK \(synthetic\)/);
  assert.match(r('infra/scripts/bootstrap-ci-db.sh'), /0015_preparation_stability\.sql/);
  assert.match(r('infra/seeds/seed_m20_preparation_stability.sql'), /DEMO-PREP-/);
});
