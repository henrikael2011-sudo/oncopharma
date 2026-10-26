// M24 — autocadastro por convite (token assinado, expiração, uso único, validação, limite de tentativas, sem PII em log)
// e painel do farmacêutico hospitalar (fila gravidade→tempo, limiar 37,8 °C, integração SIMULADA, "a equipe avalia").
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const r = (p) => fs.readFileSync(p, 'utf8');
const R = require('../services/api/dist/registration-rules.js'); const P = require('../services/api/dist/hospital-panel-rules.js');
const SECRET = Buffer.from('m24-segredo-de-teste-ficticio-32-caracteres-ou-mais');
const INV = '0b3c1c9e-4a3f-4e7a-9d1b-2f1d5a0c7e11', ORG = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-21T12:00:00Z');
const ok = { submittedBy: 'caregiver', fullName: 'Maria Fictícia da Silva', birthDate: '1961-03-14', phone: '(11) 91234-5678', email: 'maria.ficticia@example.org',
  caregiver: { name: 'Ana Fictícia', relationship: 'Filha', phone: '11 98765-4321' }, diagnosis: 'Câncer de mama (fictício)', regimen: 'Quimioterapia a cada 21 dias', treatmentStart: '2026-09-01', hospitalName: 'Hospital Simulado', consent: true };
const reg = r('services/api/src/registration.controller.ts'), panel = r('services/api/src/hospital-panel.controller.ts');
const seg = (s, a, b) => s.slice(s.indexOf(a), b ? s.indexOf(b, s.indexOf(a) + 1) : undefined);

test('token: assinatura HMAC, expiração e adulteração recusadas (tempo constante)', () => {
  const exp = Date.now() + 3600e3, t = R.signInvite({ inviteId: INV, org: ORG, exp }, SECRET);
  assert.match(t, /^r1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(R.verifyInvite(t, SECRET), { inviteId: INV, org: ORG, exp });
  assert.equal(R.verifyInvite(t, Buffer.from('outro-segredo-com-mais-de-32-caracteres!!')), null, 'segredo errado');
  assert.equal(R.verifyInvite(t, SECRET, exp + 1), null, 'expirado');
  const [h, b, s] = t.split('.'); const forged = JSON.parse(Buffer.from(b, 'base64url')); forged.o = '22222222-2222-4222-8222-222222222222';
  assert.equal(R.verifyInvite(`${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${s}`, SECRET), null, 'payload trocado');
  assert.equal(R.verifyInvite(t.slice(0, -2) + (t.endsWith('AA') ? 'BB' : 'AA'), SECRET), null, 'assinatura trocada');
  for (const bad of [null, '', 'r1..x', 'x'.repeat(500), 42]) assert.equal(R.verifyInvite(bad, SECRET), null);
  assert.notEqual(R.signInvite({ inviteId: INV, org: ORG, exp }, SECRET), t, 'nonce aleatório');
  assert.equal(R.tokenHash(t).length, 32); assert.match(reg, /verifyInvite\(token, secret\(\)\)/); assert.match(reg, /timingSafeEqual|verifyInvite/);
  assert.match(r('services/api/src/registration-rules.ts'), /timingSafeEqual\(got, expected\)/);
  const old = process.env.REGISTRATION_TOKEN_SECRET; process.env.REGISTRATION_TOKEN_SECRET = 'curto'; assert.throws(() => R.tokenSecret()); if (old === undefined) delete process.env.REGISTRATION_TOKEN_SECRET; else process.env.REGISTRATION_TOKEN_SECRET = old;
  assert.equal(R.inviteHours(undefined), 72); assert.equal(R.inviteHours(168), 168); for (const h of [0, 169, 1.5, 'x']) assert.throws(() => R.inviteHours(h));
});
test('uso único: token só como SHA-256; convite bloqueado (FOR UPDATE) e marcado usado na mesma transação; mensagem única', () => {
  const sub = seg(reg, '@Post(\':token\')', 'type Staff');
  assert.match(sub, /openInvite\(c, cl\.org, token, true\)/); assert.match(reg, /FOR UPDATE/);
  assert.match(sub, /UPDATE patient_registration_invites SET used_at=now\(\) WHERE id=\$1 AND organization_id=\$2 AND used_at IS NULL AND revoked_at IS NULL/);
  assert.match(reg, /token_sha256=\$2/); assert.doesNotMatch(reg, /INSERT INTO patient_registration_invites\([^)]*\btoken\b,/);
  assert.match(reg, /r\.used_at \|\| r\.revoked_at \|\| new Date\(r\.expires_at\)\.getTime\(\) <= Date\.now\(\)/);
  assert.equal((reg.match(/NotFoundException\(INVALID\)/g) || []).length >= 4, true, 'mesma mensagem para inválido/expirado/usado');
  const m = r('infra/migrations/0019_patient_self_registration.sql');
  assert.match(m, /invite_id uuid NOT NULL UNIQUE/); assert.match(m, /token_sha256 bytea NOT NULL UNIQUE/); assert.match(m, /interval '7 days'/);
});
test('validação no servidor: campos obrigatórios, telefone BR, datas, e-mail, cuidador quando é ele quem preenche, consentimento', () => {
  const v = R.parseRegistration(ok, NOW); assert.equal(v.phone, '+5511912345678'); assert.equal(v.caregiver.phone, '+5511987654321'); assert.equal(v.fullName, 'Maria Fictícia da Silva');
  assert.equal(R.parseRegistration({ ...ok, submittedBy: 'patient', caregiver: null, email: '', regimen: '', treatmentStart: '', hospitalName: '' }, NOW).caregiver, null);
  for (const bad of [{ fullName: 'Maria' }, { fullName: '<script>x</script> a' }, { fullName: 'Ma1ria Silva' }, { birthDate: '2030-01-01' }, { birthDate: '1961-02-30' }, { birthDate: '14/03/1961' }, { phone: '1234' }, { phone: '(00) 91234-5678' },
    { email: 'sem-arroba' }, { submittedBy: 'medico' }, { submittedBy: 'caregiver', caregiver: null }, { caregiver: { name: 'Ana', relationship: 'Filha', phone: 'x' } }, { diagnosis: '' }, { diagnosis: 'x'.repeat(121) },
    { treatmentStart: '1950-01-01' }, { consent: false }, { consent: 'true' }])
    assert.throws(() => R.parseRegistration({ ...ok, ...bad }, NOW), JSON.stringify(bad));
  assert.throws(() => R.parseRegistration(null, NOW)); assert.throws(() => R.parseRegistration([], NOW));
  assert.equal(R.age('1961-03-14', NOW), 65); assert.equal(R.age('1961-10-22', NOW), 64);
});
test('limite de tentativas: janela fixa por chave (hash), API e BFF', () => {
  const l = new R.RateLimiter(3, 1000); assert.deepEqual([1, 2, 3, 4].map(() => l.take('k', 0)), [true, true, true, false]); assert.equal(l.take('k', 1001), true); assert.equal(l.take('outra', 0), true);
  assert.match(reg, /publicSubmitLimit\.take\(/); assert.match(reg, /inviteSubmitLimit\.take\(/); assert.match(reg, /publicReadLimit\.take\(/); assert.match(reg, /TOO_MANY_REQUESTS/);
  const bff = r('apps/care-web/lib/registration-proxy.ts'); assert.match(bff, /limited\(`\$\{method\}:\$\{ch\}`/); assert.match(bff, /return json\('Muitas tentativas/); assert.match(bff, /createHash\('sha256'\)/);
  assert.match(bff, /origin !== new URL\(configured\)\.origin/); assert.match(bff, /body\.length > 4096/); assert.doesNotMatch(bff, /session\(\)/, 'convite é a credencial, sem sessão');
});
test('sem PII em logs/auditoria; dados cifrados em repouso; registro nasce pendente de conferência', () => {
  for (const f of ['services/api/src/registration.controller.ts', 'services/api/src/registration-rules.ts', 'apps/care-web/lib/registration-proxy.ts', 'apps/care-web/components/care/SelfRegistration.tsx', 'services/api/src/hospital-panel.controller.ts'])
    assert.doesNotMatch(r(f), /console\.(log|info|warn|error|debug)/, f);
  for (const a of reg.matchAll(/INSERT INTO audit_events[\s\S]*?\]\);/g)) assert.doesNotMatch(a[0], /fullName|birthDate|phone|email|diagnosis|regimen|caregiver\b|display_name/, 'auditoria sem dado pessoal');
  assert.match(reg, /sealText\(JSON\.stringify\(rest\), k\.key\)/); assert.match(reg, /'registration\.submitted'/);
  const m = r('infra/migrations/0019_patient_self_registration.sql');
  assert.match(m, /payload_encrypted bytea NOT NULL/); assert.doesNotMatch(m, /birth_date|phone|diagnosis/); assert.match(m, /DEFAULT 'pending_review'/);
  assert.match(m, /reg_insert[\s\S]*status = 'pending_review' AND patient_id IS NULL/); assert.match(m, /FORCE ROW LEVEL SECURITY/);
  assert.doesNotMatch(m, /GRANT[^;]*(DELETE)/); assert.doesNotMatch(m, /GRANT UPDATE \([^)]*payload/);
  assert.match(r('infra/scripts/bootstrap-ci-db.sh'), /0019_patient_self_registration\.sql/);
});
test('conferência pela equipe: MFA, papel (farmácia/enfermagem/medicina), confirmação explícita, prontuário, sem duplicar', () => {
  assert.deepEqual([...R.ISSUER_ROLES], ['pharmacist', 'nurse', 'physician']); assert.equal(R.canIssue('clinical_manager'), false);
  const staff = seg(reg, 'export class RegistrationController');
  assert.match(staff, /if \(!req\.principal\.mfa\) throw new ForbiddenException/); assert.match(staff, /if \(!canIssue\(role\)\)/);
  assert.match(reg, /@Controller\('clinical'\)\n@UseGuards\(AuthGuard\)\nexport class RegistrationController/);
  const conf = seg(reg, "@Post('registrations/:id/confirm')", "@Post('registrations/:id/reject')");
  assert.match(conf, /body\?\.confirm !== true/); assert.match(conf, /RECORD\.test\(record\)/); assert.match(conf, /status !== 'pending_review'/); assert.match(conf, /Já existe paciente com este prontuário/);
  assert.match(conf, /INSERT INTO patients\(organization_id,external_reference,synthetic,display_name,hospital_record\) VALUES\(\$1,\$2,true,/);
  assert.match(seg(reg, "@Post('registrations/:id/reject')"), /note\.length < 3/);
  assert.match(reg, /QRCode\.toString\(out\.link, \{ type: 'svg'/); assert.match(reg, /CARE_PUBLIC_ORIGIN/);
});
test('painel: fila por gravidade e depois espera (mais antigo primeiro); limiar de febre 37,8 °C', () => {
  const q = P.sortQueue([{ id: 'a', level: 'needs_review', createdAt: '2026-10-21T08:00:00Z' }, { id: 'b', level: 'urgent_review', createdAt: '2026-10-21T10:00:00Z' },
    { id: 'c', level: 'urgent_review', createdAt: '2026-10-21T09:00:00Z' }, { id: 'd', level: 'needs_review', createdAt: '2026-10-21T07:00:00Z' }]);
  assert.deepEqual(q.map((x) => x.id), ['c', 'b', 'd', 'a']);
  assert.equal(P.waitingMinutes('2026-10-21T10:00:00Z', Date.parse('2026-10-21T11:30:00Z')), 90); assert.equal(P.waitingMinutes('2026-10-21T12:00:00Z', Date.parse('2026-10-21T11:00:00Z')), 0);
  assert.equal(P.locationLabel({ unit: 'Oncologia', room: '301', bed: 'A' }), 'Oncologia · Quarto 301 · Leito A'); assert.equal(P.locationLabel({ unit: 'Hospital-Dia', room: 'Box 04' }), 'Hospital-Dia · Box 04'); assert.equal(P.locationLabel({}), null);
  assert.equal(P.FEVER_THRESHOLD_C, 37.8); assert.equal(P.isFever(37.7), false); assert.equal(P.isFever(37.8), true);
  assert.match(panel, /ORDER BY CASE a\.level WHEN 'urgent_review' THEN 0 ELSE 1 END, a\.created_at ASC/);
  for (const f of ['services/api/src/hospital-panel.controller.ts', 'services/api/src/hospital-panel-rules.ts', 'apps/clinical-web/components/clinical/HospitalPanel.tsx', 'apps/care-web/components/care/SelfRegistration.tsx', 'apps/clinical-web/components/clinical/Registrations.tsx'])
    assert.doesNotMatch(r(f), /38[,.][05]\b|>=\s*38\b/, `${f}: limiar aprovado é 37,8 °C`);
});
test('painel: só leitura, autorizado (MFA + vínculo assistencial), auditado; integração SIMULADA rotulada; o app não decide', () => {
  assert.match(panel, /if \(!req\.principal\.mfa\) throw new ForbiddenException/);
  assert.equal((panel.match(/JOIN care_assignments ca ON ca\.patient_id=p\.id AND ca\.organization_id=p\.organization_id AND ca\.oidc_issuer=\$\d AND ca\.oidc_sub=\$\d AND ca\.active=true/g) || []).length, 2);
  assert.doesNotMatch(panel, /INSERT INTO (?!audit_events)|UPDATE |DELETE /); assert.match(panel, /hospital_panel\.queue\.read/); assert.match(panel, /hospital_panel\.patient\.read/);
  assert.match(P.SIMULATED_INTEGRATION, /SIMULADA/); assert.match(P.SIMULATED_INTEGRATION, /não é Tasy\/MV/); assert.match(P.TEAM_ASSESSES, /equipe assistencial avalia/);
  const ui = r('apps/clinical-web/components/clinical/HospitalPanel.tsx');
  for (const l of ['Integração simulada', 'A equipe avalia.', 'não liberado para uso clínico', 'Fila priorizada', 'Check-ins recentes', 'Medicamentos ativos', 'simulado']) assert.ok(ui.includes(l), l);
  assert.match(ui, /setInterval\(/); assert.match(ui, /document\.visibilityState === 'visible'/);
  for (const f of ['apps/clinical-web/components/clinical/HospitalPanel.tsx', 'apps/clinical-web/components/clinical/Registrations.tsx', 'apps/care-web/components/care/SelfRegistration.tsx', 'services/api/src/hospital-panel-rules.ts'])
    assert.doesNotMatch(r(f), /(?<!não )liberad[oa] para uso clínico|aprovad[oa] pela anvisa|certificad|validad[oa] clinicamente|recomendamos|o sistema decide|conduta sugerida/i, f);
});
test('BFF: allowlists do Clinical (painel/cadastros) e rota pública do Care; página pública sem Referer/indexação', () => {
  const w = r('apps/clinical-web/lib/work-proxy.ts');
  assert.match(w, /\['GET', \/\^panel\\\/queue\$\/\]/); assert.match(w, /\^panel\/patients\/\$\{ID\}\$/); assert.match(w, /\^registrations\/\$\{ID\}\/\(confirm\|reject\)\$/);
  const proxy = await_import(); assert.ok(proxy);
  const lay = r('apps/care-web/app/cadastro/layout.tsx'); assert.match(lay, /referrer: 'no-referrer'/); assert.match(lay, /index: false/);
  const form = r('apps/care-web/components/care/SelfRegistration.tsx');
  for (const l of ['Sou o paciente', 'Sou cuidador(a) do paciente', 'Data de nascimento', 'Diagnóstico', 'Tratamento ou protocolo', 'Autorizo o envio', 'pendente de conferência', '192']) assert.ok(form.includes(l), l);
  assert.match(r('apps/care-web/app/cadastro/cadastro.css'), /var\(--cm-grad-btn\)/); assert.doesNotMatch(r('apps/care-web/app/cadastro/cadastro.css'), /#[0-9a-f]{3,8}\b/i, 'só var(--cm-…)');
});
function await_import() { return r('apps/care-web/lib/registration-proxy.ts').includes('/v1/public/registration/'); }
