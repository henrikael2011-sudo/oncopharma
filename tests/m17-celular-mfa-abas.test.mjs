// M17 — celular (menu compacto, alvos de toque), DM Sans empacotada, confirmação de MFA após cadastro, seletor Care e abas Clinical.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const r = (p) => fs.readFileSync(p, 'utf8');
test('DM Sans servida pelo próprio app (next/font/local), sem CDN', () => {
  for (const a of ['portal', 'care-web', 'clinical-web']) {
    assert.match(r(`apps/${a}/app/fonts.ts`), /localFont\(\{ src: '\.\/fonts\/DMSans-Variable\.ttf', variable: '--font-dm-sans'/);
    assert.match(r(`apps/${a}/app/layout.tsx`), /className=\{dmSans\.variable\}/);
    assert.ok(fs.statSync(`apps/${a}/app/fonts/DMSans-Variable.ttf`).size > 100000);
    assert.doesNotMatch(r(`apps/${a}/app/layout.tsx`) + r(`apps/${a}/app/globals.css`), /fonts\.googleapis|fonts\.gstatic/);
  }
  assert.match(r('packages/design-system/app/globals.css'), /font-family:var\(--font-dm-sans\),'DM Sans',system-ui,sans-serif/);
});
test('tokens M14.4 preservados e regras de toque/menu compacto', () => {
  const css = r('packages/design-system/app/globals.css');
  assert.match(css, /--teal:#063f3b;--emerald:#15735d;--navy:#0a344a;--gold:#d7a858;--mint:#b9e1d0;--canvas:#f5f8f7;--ink:#152c32;--danger:#b42318;/);
  assert.match(css, /\.brand\{min-height:48px\}/);
  assert.match(css, /@media\(max-width:640px\)\{\.care-nav ul\{flex-wrap:nowrap;overflow-x:auto/);
  assert.match(css, /\.clin-back,\.clinical-main nav a,\.clin-list li>a\{display:inline-flex;align-items:center;min-height:44px\}/);
  assert.match(css, /\.record summary,\.clin-more summary\{padding:12px 0;min-height:44px\}/);
});
test('MFA: confirmação pós-cadastro reautentica no IdP (prompt=login, max_age=0) sem dispensar o OTP', () => {
  const login = r('apps/clinical-web/app/api/auth/login/route.ts');
  assert.match(login, /searchParams\.set\('prompt','login'\);url\.searchParams\.set\('max_age','0'\)/);
  assert.match(login, /get\('mfa'\)==='1'\)stepUp\(url\)/);
  assert.match(r('apps/clinical-web/components/clinical/ClinicalShell.tsx'), /href="\/api\/auth\/login\?mfa=1">Confirmar com o código do aplicativo/);
  assert.match(r('services/api/src/auth.guard.ts'), /otp/); // a API segue exigindo amr=otp
});
test('Care: seletor paciente/cuidador só orienta (não chama API nem concede acesso)', () => {
  const sel = r('apps/care-web/components/care/RoleSelector.tsx');
  assert.doesNotMatch(sel, /care-client|fetch\(|care\(/); assert.match(sel, /Sou paciente/); assert.match(sel, /Sou cuidador/);
  const shell = r('apps/care-web/components/care/CareShell.tsx');
  assert.match(shell, /<RoleSelector role=\{role\} onChange=\{setRole\} \/>/); assert.match(shell, /<AcceptInvite onDone=\{onDone\} \/>/);
});
test('Clinical: abas Visão geral, Medicamentos e Exame reutilizam a leitura do prontuário', () => {
  const pv = r('apps/clinical-web/components/clinical/PatientView.tsx');
  for (const t of ["['visao', 'Visão geral']", "['medicamentos', 'Medicamentos']", "['exame', 'Exame']"]) assert.ok(pv.includes(t), t);
  assert.match(pv, /<RecordTab id=\{id\} only=\{MEDICATION_KEYS\} \/>/); assert.match(pv, /<RecordTab id=\{id\} only=\{LAB_KEYS\} \/>/); assert.match(pv, /<RecordTab id=\{id\} summary \/>/);
  assert.doesNotMatch(pv, /api\/clinical\/patients/);
  assert.equal((r('apps/clinical-web/components/clinical/RecordTab.tsx').match(/fetch\(/g) || []).length, 1);
});
