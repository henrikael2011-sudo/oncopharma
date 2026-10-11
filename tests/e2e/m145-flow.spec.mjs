// M14.5 — fluxo vertical sintético: Care -> API/PostgreSQL -> Clinical -> intervenção -> auditoria,
// com OIDC (PKCE) + TOTP reais em IdP de TESTE local, testes negativos de autorização, sessão, CSRF e acessibilidade.
// Nenhum bypass: tokens vêm do IdP; a API valida assinatura/issuer/audience/MFA; o banco aplica RLS com role restrita.
import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDecipheriv, createCipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const STATE = JSON.parse(readFileSync(process.env.E2E_STATE_FILE, 'utf8'));
const PW = process.env.E2E_USER_PASSWORD;
const KEY = Buffer.from(process.env.E2E_SESSION_KEY, 'base64');
const CARE = 'http://localhost:3001', CLIN = 'http://localhost:3002', ADMIN = 'http://localhost:3003', API = 'http://127.0.0.1:4000';
const RUN = randomUUID().slice(0, 8); // marca única por execução
const ORG = '11111111-1111-4111-8111-111111111111';
const PAT_A = '22222222-2222-4222-8222-222222222221', PAT_B = '22222222-2222-4222-8222-222222222222';
const a11yMap = (res) => res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 8).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').slice(0, 300) })) }));
const SCREENS = 'artifacts/validation/screens'; mkdirSync(SCREENS, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${SCREENS}/${name}.png`, fullPage: true });
const sub = (u) => STATE.users[u].sub;
const evidence = { startedAt: new Date().toISOString(), issuer: STATE.issuer, a11y: {}, tokens: {}, db: {} };
const saveEvidence = () => writeFileSync('artifacts/validation/m14_5/e2e-evidence.json', JSON.stringify(evidence, null, 2));

// ---------- utilitários (somente instrumentação de teste) ----------
function b32(s) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const c of s.replace(/[\s=]/g, '').toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, '0');
  const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); }
function totp(secret, step) { const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step)); const h = createHmac('sha1', b32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); }
const secrets = {}, lastStep = {};
async function freshCode(user) { // nunca reutiliza código (Keycloak rejeita reuso) e evita fim de janela
  for (;;) { const now = Date.now() / 1000, step = Math.floor(now / 30);
    if (step !== lastStep[user] && now % 30 < 25) { lastStep[user] = step; return totp(secrets[user], step); }
    await new Promise((r) => setTimeout(r, 1000)); } }
function unseal(text) { const b = Buffer.from(text, 'base64url'); const d = createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')); }
function seal(v) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', KEY, iv); const e = Buffer.concat([c.update(JSON.stringify(v), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), e]).toString('base64url'); }
const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
async function sessionToken(context, origin) { const c = (await context.cookies(origin)).find((x) => x.name === 'onco_session'); return c ? { cookie: c, ...unseal(c.value) } : null; }
function sql(q) { const r = spawnSync('psql', ['-X', process.env.DATABASE_URL_ADMIN, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', q], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); }

async function kcLogin(page, user, { enroll = false, wrongOtpFirst = false } = {}) {
  await page.waitForURL(/localhost:8080\/realms\//);
  await page.fill('#username', user); await page.fill('#password', PW); await page.click('#kc-login');
  if (enroll) { // Cadastro real de TOTP exigido pelo IdP (required action CONFIGURE_TOTP)
    await page.waitForSelector('#totp'); // sem screenshot: a tela exibe o segredo TOTP
    const manual = page.locator('#mode-manual'); if (await manual.count()) await manual.click();
    secrets[user] = (await page.locator('#kc-totp-secret-key').innerText()).trim();
    await page.fill('#totp', await freshCode(user));
    if (await page.locator('#userLabel').count()) await page.fill('#userLabel', 'Autenticador sintético E2E');
    await page.click('#saveTOTPBtn, input[type=submit]');
  } else if (secrets[user]) {
    await page.waitForSelector('#otp'); await shot(page, `idp-otp-prompt-${user}`);
    if (wrongOtpFirst) { // (Codex) OTP incorreto é recusado pelo IdP
      await page.fill('#otp', '000000'); await page.click('#kc-login'); await expect(page.locator('#otp')).toBeVisible();
      await expect(page).toHaveURL(/localhost:8080\/realms\//); await shot(page, `idp-otp-rejected-${user}`);
    }
    await page.fill('#otp', await freshCode(user)); await page.click('#kc-login');
  }
}
async function staffLogin(browser, user, { enroll = false, wrongOtpFirst = false } = {}) {
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(`${CLIN}/clinical`); await page.getByRole('link', { name: 'Entrar com identidade institucional' }).click();
  await kcLogin(page, user, { enroll, wrongOtpFirst }); await page.waitForURL(`${CLIN}/clinical`); return { context, page };
}
const apiGet = (request, path, token, org = ORG) => request.get(`${API}/v1/${path}`, { headers: { authorization: `Bearer ${token}`, 'x-organization-id': org } });

test.describe.serial('M14.5 E2E sintético', () => {
  let reportId, pharmacistToken;

  test('01 healthchecks dos quatro serviços', async ({ page, request }) => {
    expect((await request.get(`${API}/v1/health`)).status()).toBe(200);
    const ready = await request.get(`${API}/v1/ready`); expect(ready.status()).toBe(200); expect(await ready.json()).toMatchObject({ databaseReady: true, clinicalOperationsEnabled: false });
    for (const [url, name, final] of [[CARE, 'care-home', '/care'], [CLIN, 'clinical-home', '/clinical'], [ADMIN, 'admin-home', '/']]) {
      const r = await page.goto(url); expect(r.status()).toBe(200); expect(new URL(page.url()).pathname).toBe(final); await shot(page, name);
    }
  });

  test('02 negativos sem autenticação (API e proxies)', async ({ request }) => {
    expect((await request.get(`${API}/v1/me`)).status()).toBe(401);
    expect((await request.get(`${API}/v1/me`, { headers: { authorization: 'Bearer abc.def.ghi' } })).status()).toBe(401);
    expect((await request.get(`${API}/v1/patients`, { headers: { 'x-organization-id': ORG } })).status()).toBe(401);
    expect((await request.get(`${CLIN}/api/clinical/summary`)).status()).toBe(401);
    const r = await request.post(`${CARE}/api/workflow/patients/${PAT_A}/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: { symptomCode: 'nausea', description: 'x', requestId: randomUUID() } });
    expect(r.status()).toBe(401);
  });

  test('03 acessibilidade e teclado sem sessão (Care, Clinical, Admin)', async ({ page }) => {
    for (const [url, key] of [[`${CARE}/care`, 'care'], [`${CLIN}/clinical`, 'clinical'], [ADMIN, 'admin']]) {
      await page.goto(url); await page.waitForLoadState('networkidle');
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      evidence.a11y[key] = a11yMap(res);
    }
    saveEvidence();
    // Teclado: primeiro Tab alcança o link "Pular para o conteúdo" em Care e Clinical.
    for (const url of [`${CARE}/care`, `${CLIN}/clinical`]) {
      await page.goto(url); await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveText('Pular para o conteúdo'); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/#conteudo$/);
    }
  });

  test('04 Care: login OIDC com PKCE, cookie HttpOnly, relato sintético persistido', async ({ browser }) => {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(`${CARE}/care`);
    const authReq = page.waitForRequest((r) => r.url().startsWith(`${STATE.issuer}/protocol/openid-connect/auth`));
    await page.getByRole('link', { name: 'Entrar com sua conta de teste' }).click();
    const u = new URL((await authReq).url());
    expect(u.searchParams.get('code_challenge_method')).toBe('S256'); expect(u.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.get('state')).toBeTruthy(); expect(u.searchParams.get('client_id')).toBe('oncopharma-care-web');
    expect(u.searchParams.get('nonce')).toBeTruthy();
    await shot(page, 'idp-login-care'); await kcLogin(page, 'paciente.a'); await page.waitForURL(`${CARE}/care`);
    const s = await sessionToken(context, CARE); expect(s).toBeTruthy();
    expect(s.cookie.httpOnly).toBe(true); expect(s.cookie.sameSite).toBe('Lax');
    expect(await page.evaluate(() => document.cookie.includes('onco_session'))).toBe(false); // (Codex) token inacessível ao JS
    expect((await context.cookies(CARE)).some((c) => c.name === 'onco_login_flow')).toBe(false);
    const c = claims(s.token); evidence.tokens.patientA = { iss: c.iss, aud: c.aud, amr: c.amr, exp_minus_iat: c.exp - c.iat, sub_matches: c.sub === sub('paciente.a') };
    expect(c.iss).toBe(STATE.issuer); expect([].concat(c.aud)).toContain('oncopharma-api'); expect(c.sub).toBe(sub('paciente.a'));
    // Formulário operado por teclado.
    await page.locator('#care-patient').focus(); await page.keyboard.type(PAT_A);
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('id', 'care-description');
    await page.keyboard.type(`Relato SINTÉTICO E2E M14.5 [${RUN}]: náusea leve fictícia.`);
    await page.keyboard.press('Tab'); await expect(page.locator(':focus')).toHaveText('Registrar relato de teste'); await page.keyboard.press('Enter');
    const status = page.getByRole('status'); await expect(status).toContainText('Relato sintético registrado');
    reportId = (await status.innerText()).match(/[0-9a-f-]{36}/)[0]; await shot(page, 'care-symptom-registered');
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    evidence.a11y.careLoggedIn = a11yMap(res);

    // Negativo: patientId fornecido pelo cliente para paciente NÃO vinculado à conta.
    await page.fill('#care-patient', PAT_B); await page.fill('#care-description', 'Tentativa sintética para outro paciente'); await page.click('button[type=submit]:has-text("Registrar relato de teste")');
    await expect(page.getByRole('status')).toContainText('Conta não vinculada ao paciente'); await shot(page, 'care-negative-other-patient');
    // CSRF: origem estranha e content-type indevido são recusados pelo proxy.
    const evil = await page.request.post(`${CARE}/api/workflow/patients/${PAT_A}/symptoms`, { headers: { origin: 'http://evil.example', 'content-type': 'application/json' }, data: { symptomCode: 'nausea', description: 'x', requestId: randomUUID() } });
    expect(evil.status()).toBe(403);
    const noOrigin = await page.request.fetch(`${CARE}/api/workflow/patients/${PAT_A}/symptoms`, { method: 'POST', headers: { 'content-type': 'application/json' }, data: { symptomCode: 'nausea', description: 'x', requestId: randomUUID() } });
    expect(noOrigin.status()).toBe(403);
    const ctype = await page.request.post(`${CARE}/api/workflow/patients/${PAT_A}/symptoms`, { headers: { origin: CARE, 'content-type': 'text/plain' }, data: '{}' });
    expect(ctype.status()).toBe(415);
    // Idempotência: mesmo requestId não duplica.
    const rid = randomUUID(); const body = { symptomCode: 'fever', description: 'Febre FICTÍCIA para simular alerta urgente', requestId: rid };
    const r1 = await page.request.post(`${CARE}/api/workflow/patients/${PAT_A}/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: body });
    const r2 = await page.request.post(`${CARE}/api/workflow/patients/${PAT_A}/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: body });
    expect(r1.status()).toBe(201); expect((await r1.json()).triageStatus).toBe('urgent_review'); expect((await r2.json()).duplicate).toBe(true);
    expect(sql(`SELECT count(*) FROM patient_symptom_reports WHERE source_reference='${rid}'`)).toBe('1');
    // Logout com origem inválida é recusado; logout legítimo remove a sessão local.
    expect((await page.request.post(`${CARE}/api/auth/logout`, { headers: { origin: 'http://evil.example' }, maxRedirects: 0 })).status()).toBe(403);
    await page.getByRole('button', { name: 'Encerrar sessão' }).click();
    // RP-initiated logout: o IdP pede confirmação (sem id_token_hint) e encerra a sessão SSO.
    await page.waitForURL(/\/protocol\/openid-connect\/logout/); await shot(page, 'idp-logout-confirm');
    await page.click('#kc-logout'); await page.waitForURL(`${CARE}/care`);
    expect(await sessionToken(context, CARE)).toBeNull();
    // Novo "Entrar" exige credenciais novamente (SSO encerrado, sem reautenticação silenciosa).
    await page.getByRole('link', { name: 'Entrar com sua conta de teste' }).click(); await page.waitForURL(/localhost:8080\/realms\//);
    await expect(page.locator('#username')).toBeVisible(); await page.goto(`${CARE}/care`);
    const after = await page.request.post(`${CARE}/api/workflow/patients/${PAT_A}/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: { symptomCode: 'nausea', description: 'x', requestId: randomUUID() } });
    expect(after.status()).toBe(401);
    saveEvidence(); await context.close();
  });

  test('05 cadastro real de TOTP para contas profissionais (required action do IdP)', async ({ browser }) => {
    for (const user of ['farmaceutico', 'enfermeira', 'admin.tecnico']) {
      const { context, page } = await staffLogin(browser, user, { enroll: true });
      // Sessão do cadastro não executou o formulário OTP; MFA só é reconhecido em login com OTP.
      await context.close(); expect(secrets[user]).toMatch(/^[A-Z2-7 ]+$/);
    }
  });

  test('06 Clinical: farmacêutico com senha+TOTP revisa alerta do relato Care; auditoria no PostgreSQL', async ({ browser, request }) => {
    const { context, page } = await staffLogin(browser, 'farmaceutico', { wrongOtpFirst: true });
    const s = await sessionToken(context, CLIN); const c = claims(s.token); pharmacistToken = s.token;
    expect(await page.evaluate(() => document.cookie.includes('onco_session'))).toBe(false);
    evidence.tokens.pharmacist = { iss: c.iss, aud: c.aud, amr: c.amr, exp_minus_iat: c.exp - c.iat, cookieMaxAgeSeconds: Math.round(s.cookie.expires - Date.now() / 1000) };
    expect(c.amr).toContain('otp'); // MFA comprovado pelo formulário OTP do IdP
    await expect(page.getByText('MFA: confirmado pelo token')).toBeVisible();
    await expect(page.getByText('Pacientes sintéticos autorizados: 2')).toBeVisible(); await shot(page, 'clinical-pharmacist-mfa');
    await page.getByRole('button', { name: 'TESTE-FOLFOX-001' }).click(); await expect(page.getByRole('heading', { name: 'Ciclos e protocolos' })).toBeVisible();
    await shot(page, 'clinical-synthetic-record');
    await page.selectOption('#review-patient', PAT_A); await page.getByRole('button', { name: 'Consultar alertas' }).click();
    const card = page.locator('article.module', { hasText: `Relato SINTÉTICO E2E M14.5 [${RUN}]` }); await expect(card).toBeVisible();
    await card.locator('textarea').fill('Revisão farmacêutica SINTÉTICA: avaliar com equipe; nenhuma conduta automática.');
    await card.getByRole('button', { name: 'Registrar revisão pendente' }).click();
    await expect(page.getByRole('region', { name: 'Revisão de alertas fictícios' }).getByRole('status')).toContainText('Revisão registrada em ambiente sintético'); await shot(page, 'clinical-review-registered');
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    evidence.a11y.clinicalLoggedIn = a11yMap(res);
    // Reconstrução da trilha no banco (role administrativa somente para leitura de evidência).
    const alert = sql(`SELECT a.id||'|'||a.status||'|'||a.level FROM clinical_alerts a WHERE a.source_report_id='${reportId}'`).split('|');
    expect(alert[1]).toBe('acknowledged'); expect(alert[2]).toBe('needs_review');
    const intv = sql(`SELECT actor_sub||'|'||decision||'|'||organization_id FROM clinical_interventions WHERE alert_id='${alert[0]}'`);
    expect(intv).toBe(`${sub('farmaceutico')}|pending|${ORG}`);
    const audit = sql(`SELECT action||'|'||actor_sub FROM audit_events WHERE organization_id='${ORG}' AND (metadata->>'report_id'='${reportId}' OR metadata->>'alert_id'='${alert[0]}') ORDER BY id`).split('\n');
    expect(audit).toEqual([`symptom.created|${sub('paciente.a')}`, `intervention.created|${sub('farmaceutico')}`]);
    const reads = sql(`SELECT string_agg(DISTINCT action, ',' ORDER BY action) FROM audit_events WHERE organization_id='${ORG}' AND actor_sub='${sub('farmaceutico')}'`);
    expect(reads).toBe('alert.list,intervention.created,patient.list,patient.record.read');
    expect(sql(`SELECT count(*) FROM patient_guidance`)).toBe('0'); // nenhuma orientação automática ao paciente
    evidence.db = { reportId, alertId: alert[0], alertStatus: alert[1], interventionActorIsPharmacist: true, auditTrail: audit.map((x) => x.split('|')[0]), pharmacistAuditActions: reads };
    saveEvidence(); await context.close();
  });

  test('07 negativos de papel/MFA/vínculo com tokens reais na API', async ({ browser, request }) => {
    // Farmacêutico sem MFA: autenticado, mas API exige MFA.
    const noMfa = await staffLogin(browser, 'farmaceutico.semmfa');
    await expect(noMfa.page.getByText('MFA: não confirmado')).toBeVisible(); await expect(noMfa.page.getByText('Pacientes sintéticos autorizados: não habilitado')).toBeVisible();
    await shot(noMfa.page, 'clinical-pharmacist-without-mfa');
    const t1 = (await sessionToken(noMfa.context, CLIN)).token; expect(claims(t1).amr || []).not.toContain('otp');
    expect((await apiGet(request, 'patients', t1)).status()).toBe(403);
    expect((await apiGet(request, `workflow/clinical/patients/${PAT_A}/alerts`, t1)).status()).toBe(403);
    await noMfa.context.close();
    // Admin técnico com MFA: sem acesso clínico por padrão.
    const adm = await staffLogin(browser, 'admin.tecnico');
    await expect(adm.page.getByText('MFA: confirmado pelo token')).toBeVisible(); await expect(adm.page.getByText('Pacientes sintéticos autorizados: não habilitado')).toBeVisible();
    await shot(adm.page, 'clinical-admin-no-clinical-access');
    const t2 = (await sessionToken(adm.context, CLIN)).token;
    const r2 = await apiGet(request, 'patients', t2); expect(r2.status()).toBe(403); expect((await r2.json()).message).toContain('Sem vínculo profissional');
    expect((await apiGet(request, `patients/${PAT_A}/record`, t2)).status()).toBe(403);
    await adm.context.close();
    // Enfermeira com MFA: atribuída somente ao paciente A.
    const nur = await staffLogin(browser, 'enfermeira');
    const t3 = (await sessionToken(nur.context, CLIN)).token;
    expect((await apiGet(request, `workflow/clinical/patients/${PAT_A}/alerts`, t3)).status()).toBe(200);
    const nb = await apiGet(request, `workflow/clinical/patients/${PAT_B}/alerts`, t3); expect(nb.status()).toBe(403); expect((await nb.json()).message).toBe('Paciente não atribuído');
    // Cabeçalho de organização forjado (outra instituição) é negado.
    expect((await apiGet(request, 'patients', t3, '99999999-9999-4999-8999-999999999999')).status()).toBe(403);
    await nur.context.close();
    // Paciente e cuidador: sem papel profissional; cuidador sem autorização não registra pelo paciente A.
    for (const user of ['paciente.b', 'cuidador.a']) {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      await p.goto(`${CARE}/care`); await p.getByRole('link', { name: 'Entrar com sua conta de teste' }).click(); await kcLogin(p, user); await p.waitForURL(`${CARE}/care`);
      const t = (await sessionToken(ctx, CARE)).token;
      expect((await apiGet(request, 'patients', t)).status()).toBe(403);
      const post = await request.post(`${API}/v1/workflow/clinical/patients/${PAT_B}/interventions`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' }, data: { alertId: randomUUID(), note: 'x', decision: 'accepted' } });
      expect(post.status()).toBe(403);
      const sym = await request.post(`${API}/v1/workflow/care/patients/${PAT_A}/symptoms`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' }, data: { symptomCode: 'nausea', description: 'tentativa sintética', requestId: randomUUID() } });
      expect(sym.status()).toBe(403);
      await ctx.close();
    }
  });

  test('07b (Codex) callback com state inválido e verifier PKCE incorreto não criam sessão', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto(`${CLIN}/api/auth/callback?code=synthetic-invalid&state=wrong`);
    await expect(page).toHaveURL(/\/clinical\?login=failed/); expect(await sessionToken(ctx, CLIN)).toBeNull();
    // Injeção de falha: mantém state/nonce reais, troca só o verifier enviado pelo BFF; o IdP deve recusar a troca do código.
    await page.goto(`${CARE}/api/auth/login`); await page.waitForURL(/localhost:8080\/realms\//);
    const flowCookie = (await ctx.cookies(CARE)).find((c) => c.name === 'onco_login_flow'); expect(flowCookie).toBeTruthy();
    const flow = unseal(flowCookie.value); flow.verifier = 'verifier-incorreto-'.repeat(4);
    await ctx.addCookies([{ name: 'onco_login_flow', value: seal(flow), url: CARE, httpOnly: true, sameSite: 'Lax' }]);
    await kcLogin(page, 'paciente.b'); await expect(page).toHaveURL(/localhost:3001\/care\?login=failed/);
    expect(await sessionToken(ctx, CARE)).toBeNull(); await shot(page, 'care-login-failed-wrong-pkce');
    await ctx.close();
  });

  test('07c (Codex) superfícies em 390/768/1440 px: sem overflow horizontal, sem erros de página; Care sem sessão recusa envio', async ({ browser }) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    for (const [app, url] of [['care', `${CARE}/care`], ['clinical', `${CLIN}/clinical`], ['admin', ADMIN]]) {
      for (const [size, width, height] of [['mobile', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 1000]]) {
        await page.setViewportSize({ width, height }); await page.goto(url); await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${app}-${size} overflow`).toBe(true);
        await shot(page, `surface-${app}-${size}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${CARE}/care`);
    await page.fill('#care-patient', PAT_A); await page.fill('#care-description', 'Relato sintético sem sessão');
    await page.click('button[type=submit]:has-text("Registrar relato de teste")');
    await expect(page.getByRole('status')).toContainText('Autenticação necessária'); await shot(page, 'care-error-unauthenticated');
    expect(errors).toEqual([]); await ctx.close();
  });

  test('08 token adulterado, sessão forjada vencida e expiração real do token', async ({ browser, request }) => {
    const [h, p, sig] = pharmacistToken.split('.');
    const forged = JSON.parse(Buffer.from(p, 'base64url')); forged.sub = sub('enfermeira');
    expect((await request.get(`${API}/v1/me`, { headers: { authorization: `Bearer ${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${sig}` } })).status()).toBe(401);
    // Cookie de sessão com expiração passada (cifrado com a chave do ambiente de teste) é rejeitado pelo app.
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: 'onco_session', value: seal({ token: pharmacistToken, expiresAt: Date.now() - 1000 }), url: CLIN, httpOnly: true, sameSite: 'Lax' }]);
    expect((await ctx.request.get(`${CLIN}/api/clinical/summary`)).status()).toBe(401);
    // Expiração real: aguarda exp + tolerância (5 s) e a API recusa o mesmo token antes válido.
    expect((await request.get(`${API}/v1/me`, { headers: { authorization: `Bearer ${pharmacistToken}` } })).status()).toBe(200);
    const wait = claims(pharmacistToken).exp * 1000 - Date.now() + 7000;
    evidence.tokens.waitedForExpiryMs = wait; if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    expect((await request.get(`${API}/v1/me`, { headers: { authorization: `Bearer ${pharmacistToken}` } })).status()).toBe(401);
    saveEvidence(); await ctx.close();
  });

  test('09 resultado axe (WCAG 2.x A/AA): nenhuma violação séria/crítica em Care, Clinical e Admin', async () => {
    const serious = Object.entries(evidence.a11y).flatMap(([k, v]) => v.filter((x) => ['serious', 'critical'].includes(x.impact)).map((x) => `${k}:${x.id}`));
    expect(serious, `violações axe sérias/críticas: ${serious.join(', ')}`).toEqual([]);
  });
});
