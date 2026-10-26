// M25 — correções do teste total E2E 26/10: dose obrigatória na conferência com IA, convite 7 dias sem corrida,
// mensagem real do 503, check-in diário, alertas reais e mensagens Care ↔ equipe (regras, autorização, BFF, UI).
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const r = (p) => fs.readFileSync(p, 'utf8');
const K = require('../services/api/dist/care-contact-rules.js');
const ID = '0b3c1c9e-4a3f-4e7a-9d1b-2f1d5a0c7e11';
const care = r('services/api/src/care.controller.ts'), cw = r('services/api/src/clinical-work.controller.ts');
const seg = (s, a, b) => s.slice(s.indexOf(a), b ? s.indexOf(b, s.indexOf(a) + 1) : undefined);

test('A067: dose vazia/zero recusada na API da conferência (400, mensagem clara) e na tela', () => {
  const api = r('apps/clinical-web/app/api/ia/conferencia/route.ts');
  assert.match(api, /status: 400/); assert.match(api, /Dose obrigatória: informe a dose \(mg\)/);
  assert.ok(api.indexOf('Dose obrigatória') < api.indexOf('await checkPrescription(body)'), 'valida antes de chamar a IA');
  const ui = r('apps/clinical-web/components/clinical/PrescriptionCheck.tsx');
  assert.match(ui, /required min=\{0\.01\}/); assert.match(ui, /Informe a dose \(mg\) de \$\{bad\.drug\}/);
  assert.ok(ui.indexOf('if (bad)') < ui.indexOf("fetch('/api/ia/conferencia', { method: 'POST'"), 'não envia sem dose');
});
test('A021: tabela da conferência dentro de contêiner com rolagem própria (sem rolagem lateral em 390px)', () => {
  assert.match(r('apps/clinical-web/components/clinical/PrescriptionCheck.tsx'), /<div className="ia-table-wrap"[^>]*tabIndex=\{0\}><table className="ia-table">/);
  assert.match(r('apps/clinical-web/app/clinical/clinical-v3h.css'), /\.ia-table-wrap\{max-width:100%;overflow-x:auto/);
});
test('A075: proxy repassa o motivo do 503 (ex.: chave não configurada); outros 5xx seguem genéricos', () => {
  for (const f of ['apps/clinical-web/lib/work-proxy.ts', 'apps/care-web/lib/care-proxy.ts']) { const s = r(f);
    assert.match(s, /if \(up\.status === 503\) \{ const m = /); assert.match(s, /m\.length <= 200/); assert.ok(s.indexOf('up.status === 503') < s.indexOf('up.status >= 500'), f); }
  assert.match(cw, /Importação indisponível: chave de cifra não configurada/);
});
test('B059: validade do convite calculada no banco (now() + horas) — sem corrida com o CHECK invite_max_7d', () => {
  const inv = seg(r('services/api/src/registration.controller.ts'), "@Post('registration-invites')", '@Get(');
  assert.match(inv, /now\(\) \+ make_interval\(hours => \$7::int\)/); assert.match(inv, /created_at,expires_at\) VALUES\(.*now\(\),now\(\) \+ make_interval/);
  assert.doesNotMatch(inv, /Date\.now\(\) \+ hours/);
});
test('check-in: validação (sentimento fechado, observação ≤ 500, temperatura pela regra existente, requestId UUID)', () => {
  assert.deepEqual(Object.keys(K.FEELINGS), ['bem', 'mais_ou_menos', 'mal']);
  const ok = K.parseCheckin({ feeling: 'bem', requestId: ID }); assert.equal(ok.temperature, null); assert.equal(ok.note, null);
  assert.equal(K.parseCheckin({ feeling: 'mal', celsius: '37,8', note: ' febre leve ', requestId: ID }).temperature.celsius, 37.8);
  assert.equal(K.parseCheckin({ feeling: 'mal', celsius: '37,8', note: ' x ', requestId: ID }).note, 'x');
  for (const bad of [{ feeling: 'otimo' }, { feeling: 'bem', requestId: 'x' }, { feeling: 'bem', note: 'a'.repeat(501) }, { feeling: 'bem', celsius: 33 }, { feeling: 'bem', celsius: '37,85' }, { feeling: 'bem', note: 5 }])
    assert.throws(() => K.parseCheckin({ requestId: ID, ...bad }), JSON.stringify(bad));
  assert.match(K.CHECKIN_ROUTINE, /192 \(SAMU\)/); assert.match(K.CHECKIN_UNWELL, /192 \(SAMU\)/);
});
test('check-in: febre >= 37,8 °C => relato + alerta urgente (care-demo-v1); "não estou bem" => um alerta por dia; edição só no mesmo dia', () => {
  const put = seg(care, "@Put('me/checkins/today')", "@Get('me/alerts')");
  assert.match(put, /CareController\.need\(s, 'registrar_sintoma'\)/); assert.match(put, /isFever\(t\.celsius\)/);
  assert.match(put, /'symptom\.fever','urgent_review','awaiting_review'/); assert.match(put, /'checkin\.unwell','needs_review'/);
  assert.match(put, /ci\.feeling === 'mal' && !reportId/); assert.match(put, /checkin_date=current_date FOR UPDATE/);
  assert.match(put, /UPDATE patient_daily_checkins SET .* WHERE id=\$11 AND checkin_date=current_date/);
  assert.doesNotMatch(put, /@Param|body\.patient/); assert.match(put, /'care\.checkin\.updated' : 'care\.checkin\.created'/);
  const m = r('infra/migrations/0020_care_checkin_messages.sql');
  assert.match(m, /UNIQUE \(organization_id, patient_id, checkin_date\)/); assert.match(m, /checkin_date = current_date/); assert.match(m, /FORCE ROW LEVEL SECURITY/);
  assert.doesNotMatch(m, /GRANT[^;]*DELETE/); assert.doesNotMatch(m, /celsius|numeric/); assert.match(r('infra/scripts/bootstrap-ci-db.sh'), /0020_care_checkin_messages\.sql/);
});
test('mensagens: validação, aviso não urgente com 192, texto cifrado e fora da auditoria, idempotência', () => {
  assert.equal(K.parseMessage({ body: ' Olá equipe ', topic: 'remedios', requestId: ID }).body, 'Olá equipe');
  for (const bad of [{ body: 'a' }, { body: 'a'.repeat(1001) }, { body: 'ok ok', topic: 'x' }, { body: 'ok ok', requestId: 'x' }]) assert.throws(() => K.parseMessage({ requestId: ID, ...bad }), JSON.stringify(bad));
  assert.match(K.MESSAGE_DISCLAIMER, /não são para urgência/); assert.match(K.MESSAGE_DISCLAIMER, /192 \(SAMU\)/);
  const post = seg(care, "@Post('me/messages')", '// ---------- M15.3');
  assert.match(post, /sealText\(m\.body, key\.key\)/); assert.match(post, /'care\.message\.sent', s, \{ message_id: id, topic: m\.topic \}/); assert.match(post, /source_reference=\$2`, \[org, `care:\$\{m\.requestId\}`\]/);
  const m = r('infra/migrations/0020_care_checkin_messages.sql'); assert.match(m, /GRANT UPDATE \(read_at\) ON care_team_messages/); assert.match(m, /message_author_direction/);
});
test('Clinical: check-ins, caixa e conversa só de pacientes vinculados; resposta auditada', () => {
  for (const [a, b] of [["@Get('patients/:patientId/checkins')", "@Get('messages/inbox')"], ["@Get('patients/:patientId/messages')", "@Post('patients/:patientId/messages/read')"], ["@Post('patients/:patientId/messages')", null]]) {
    const s = seg(cw, a, b); assert.match(s, /await this\.linked\(c, org, req, patientId\)/, a); }
  assert.match(seg(cw, "@Get('messages/inbox')", "@Get('patients/:patientId/messages')"), /ca\.oidc_issuer=\$2 AND ca\.oidc_sub=\$3 AND ca\.active=true/);
  assert.match(cw, /'patient\.message\.replied'/); assert.match(cw, /'patient\.checkins\.read'/);
});
test('BFFs: novas rotas permitidas (e nada além)', async () => {
  const C = r('apps/care-web/lib/care-proxy.ts'), W = r('apps/clinical-web/lib/work-proxy.ts');
  assert.match(C, /\['GET', \/\^me\\\/checkins\\\/today\$\/\], \['PUT', \/\^me\\\/checkins\\\/today\$\/\], \['GET', \/\^me\\\/alerts\$\/\], \['GET', \/\^me\\\/messages\$\/\], \['POST', \/\^me\\\/messages\$\/\]/);
  assert.match(W, /\^patients\/\$\{ID\}\/\(checkins\|messages\)\$/); assert.match(W, /\['GET', \/\^messages\\\/inbox\$\/\]/);
});
test('Care UI: check-in real, alertas reais com estado vazio, mensagens com aviso não urgente; febre 37,8', () => {
  const dc = r('apps/care-web/components/care/DailyCheckin.tsx'), al = r('apps/care-web/components/care/Alerts.tsx'), tm = r('apps/care-web/components/care/TeamMessages.tsx');
  assert.match(dc, /Estou bem hoje/); assert.match(dc, /Enviar check-in/); assert.match(dc, /Alterar check-in/); assert.match(dc, /href="tel:192"/);
  assert.match(al, /care<\{ alerts: AlertItem\[\] \}>\('me\/alerts'\)/); assert.match(al, /data-alerts-empty/); assert.doesNotMatch(al, /\(exemplo\)/);
  assert.match(tm, /data-msg-disclaimer/); assert.match(tm, /192 \(SAMU\)/);
  const cl = r('apps/clinical-web/components/clinical/CareContactTab.tsx'); assert.match(cl, /37,8 °C ou mais/); assert.match(cl, /Enviar resposta/);
  assert.match(r('apps/clinical-web/components/clinical/ClinicalShell.tsx'), /\['\/clinical\/mensagens', 'Mensagens do Care'\]/);
});
