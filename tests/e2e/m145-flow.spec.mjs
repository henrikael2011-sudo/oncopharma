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
async function staffLogin(browser, user, { enroll = false, wrongOtpFirst = false, delayCallbackMs = 0 } = {}) {
  const context = await browser.newContext(); const page = await context.newPage();
  // Regressão (amr maxAge=0): atrasa a troca do código após o OTP; o amr deve continuar com "otp".
  // O callback é destino de redirecionamento (não interceptável); atrasamos a resposta 302 do IdP após o envio do OTP.
  if (delayCallbackMs) await page.route('**/login-actions/authenticate**', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const res = await route.fetch({ maxRedirects: 0 }); await new Promise((r) => setTimeout(r, delayCallbackMs)); await route.fulfill({ response: res });
  });
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
    expect((await request.get(`${CLIN}/api/work/worklist`)).status()).toBe(401);
    const r = await request.post(`${CARE}/api/care/me/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', requestId: randomUUID() } });
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

  test('03b (M15.1) identidade: títulos/manifest por app, assinatura Care, foco AA, alvos ≥48px, sem link autorredirecionado', async ({ page, request }) => {
    for (const [origin, title, start] of [[CARE, 'ONCOPHARMA Care', '/care'], [CLIN, 'ONCOPHARMA Clinical', '/clinical'], [ADMIN, 'ONCOPHARMA Admin', '/']]) {
      await page.goto(origin + start); await expect(page).toHaveTitle(title);
      const m = await (await request.get(origin + '/manifest.webmanifest')).json(); expect(m.name).toBe(title); expect(m.icons.length).toBeGreaterThan(0);
      for (const href of await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))
        if (start !== '/') expect(href, `link em ${title} não deve apontar para "/" (apenas redireciona)`).not.toBe('/');
    }
    await page.goto(CARE + '/care');
    await expect(page.getByText('Um passo de cada vez. Juntos no cuidado.')).toBeVisible();
    expect(parseFloat(await page.locator('.care-page').evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
    for (const h of await page.locator('.care-page button, .care-page input:not([type=radio]):not([type=checkbox]), .care-page select, .care-page .btn-primary, .care-page .choice').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height)))
      expect(h).toBeGreaterThanOrEqual(48);
    // foco em fundo claro = azul-petróleo (navy), não dourado
    const field = page.locator('.care-main input, .care-main button').first();
    if (await field.count()) { await field.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
      expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor)).toBe('rgb(10, 52, 74)'); }
    await page.goto(CLIN + '/clinical'); await expect(page.getByText(/M14\.1|M10\.1/)).toHaveCount(0);
  });

  test('04 Care: login OIDC com PKCE, cookie HttpOnly, relato sintético persistido', async ({ browser }) => {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(`${CARE}/care`);
    const authReq = page.waitForRequest((r) => r.url().startsWith(`${STATE.issuer}/protocol/openid-connect/auth`));
    await page.getByRole('link', { name: 'Entrar', exact: true }).click();
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
    // M15.2 — consentimento na primeira entrada (gravado e auditado), depois o Início com nome do IdP (sem UUID na tela).
    await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible(); await shot(page, 'care-consent');
    await page.getByLabel('Li e concordo').check(); await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Olá, Ana. Como você está hoje?');
    await expect(page.getByText('Um passo de cada vez. Juntos no cuidado.')).toBeVisible();
    await expect(page.locator('input#care-patient')).toHaveCount(0); await expect(page.locator('main').getByText(/UUID|fictíci|de teste/i)).toHaveCount(0); // a faixa do ambiente de teste (M16) fica fora do conteúdo
    await expect(page.getByRole('heading', { name: 'Próxima sessão' })).toBeVisible(); await expect(page.getByText('Ciclo 3 ·')).toBeVisible();
    await expect(page.getByText('Evite bebidas e alimentos muito gelados')).toBeVisible(); // orientação approved
    await expect(page.getByText('Rascunho não aprovado')).toHaveCount(0); // draft nunca aparece
    expect(sql(`SELECT count(*) FROM audit_events WHERE action='care.consent.accepted' AND actor_sub='${sub('paciente.a')}'`)).not.toBe('0');
    await shot(page, 'care-home');
    // Relato estruturado operado por teclado: uma pergunta por tela.
    await page.getByRole('link', { name: 'Registrar como estou' }).click(); await expect(page.getByRole('heading', { name: 'Como estou hoje' })).toBeVisible();
    await page.getByLabel('Enjoo ou vômito').focus(); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
    await page.getByLabel(/Leve —/).check(); await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Hoje', { exact: true }).check(); await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Você tem algum destes sinais agora?')).toBeVisible(); await shot(page, 'care-symptom-red-flags');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.locator('#care-description').fill(`Relato SINTÉTICO E2E M14.5 [${RUN}]: náusea leve fictícia.`);
    await expect(page.getByLabel('Resumo do relato')).toContainText('Enjoo ou vômito');
    const a11yForm = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze(); evidence.a11y.careSymptomForm = a11yForm.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    await page.getByRole('button', { name: 'Enviar para a equipe' }).click();
    const status = page.getByRole('status'); await expect(status).toContainText('Relato registrado'); await expect(status).not.toContainText('avisad');
    await expect(status).toContainText('ligue 192');
    const shortId = await page.locator('[data-report-id]').getAttribute('data-report-id'); reportId = shortId; await shot(page, 'care-symptom-registered');
    // R3: o relato foi gravado para o paciente da identidade (A), sem identificador vindo do cliente.
    expect(sql(`SELECT patient_id||'|'||(details->>'intensity')||'|'||actor_sub FROM patient_symptom_reports WHERE id='${reportId}'`)).toBe(`${PAT_A}|leve|${sub('paciente.a')}`);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    evidence.a11y.careLoggedIn = a11yMap(res);
    // Sinal de alerta => orientação imediata de procurar atendimento (texto provisório) e alerta prioritário para a equipe.
    await page.goto(`${CARE}/care/sintoma`);
    await page.getByLabel('Cansaço').check(); await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel(/Moderada —/).check(); await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('De 1 a 3 dias').check(); await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Falta de ar').check();
    // M16 (P1-2): orientação urgente aparece no cliente ANTES do envio, sem depender da API.
    await expect(page.locator('[data-local-urgent]')).toContainText('Ligue 192'); await expect(page.locator('[data-local-urgent]').getByRole('link', { name: 'Ligar 192' })).toHaveAttribute('href', 'tel:192');
    await page.getByRole('button', { name: 'Continuar' }).click();
    // M16 (P1-2): servidor fora do ar => orientação urgente continua visível e o app diz que NÃO registrou; reenvio idempotente.
    await page.route('**/api/care/me/symptoms', (route) => route.abort('internetdisconnected'));
    await page.getByRole('button', { name: 'Enviar para a equipe' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'NÃO foi registrado' })).toBeVisible();
    await expect(page.locator('[data-local-urgent]')).toContainText('Procure atendimento agora'); await shot(page, 'care-symptom-urgent-offline');
    await page.unroute('**/api/care/me/symptoms');
    await page.getByRole('button', { name: 'Enviar para a equipe' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Procure atendimento agora' })).toBeVisible(); await shot(page, 'care-symptom-urgent');
    const urgentId = await page.locator('[data-report-id]').getAttribute('data-report-id');
    expect(sql(`SELECT r.triage_status||'|'||a.level FROM patient_symptom_reports r JOIN clinical_alerts a ON a.source_report_id=r.id WHERE r.id='${urgentId}'`)).toBe('urgent_review|urgent_review');
    // Minha jornada, Meus medicamentos (sem dose; adesão relatada), Ajuda, Preferências.
    await page.getByRole('link', { name: 'Minha jornada' }).click(); await expect(page.getByText(/Ciclo 1/)).toBeVisible(); await expect(page.getByText(/Enjoo ou vômito · Registrado — aguardando avaliação da equipe/).first()).toBeVisible(); await shot(page, 'care-journey');
    await page.getByRole('link', { name: 'Meus medicamentos' }).click(); await expect(page.getByRole('heading', { name: 'Ondansetrona (comprimido)' })).toBeVisible();
    await expect(page.getByText(/\b8 ?mg\b/)).toHaveCount(0);
    await page.getByRole('group', { name: /Ondansetrona \(comprimido\)/ }).getByRole('button', { name: 'Tomei', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('registrado "Tomei"'); await shot(page, 'care-medications');
    expect(sql(`SELECT count(*) FROM patient_adherence_reports WHERE patient_id='${PAT_A}' AND status='taken' AND actor_sub='${sub('paciente.a')}'`)).not.toBe('0');
    await page.getByRole('link', { name: 'Preciso de ajuda' }).click(); await expect(page.getByRole('link', { name: 'Ligar 192' })).toHaveAttribute('href', 'tel:192'); await shot(page, 'care-help');
    const a11yHelp = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); evidence.a11y.careHelp = a11yMap(a11yHelp);
    await page.getByRole('link', { name: 'Preferências' }).click(); await page.getByLabel('Muito grande').check(); await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('status')).toContainText('Preferências salvas'); await expect(page.locator('.care-page')).toHaveAttribute('data-font', 'xlarge');
    expect(parseFloat(await page.locator('.care-page').evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(23);
    await page.getByLabel('Normal', { exact: true }).check(); await page.getByRole('button', { name: 'Salvar' }).click(); await expect(page.locator('.care-page')).toHaveAttribute('data-font', 'normal');
    // BFF: rotas fora da lista permitida e identificador de paciente na URL não existem.
    expect((await page.request.get(`${CARE}/api/care/patients/${PAT_B}`)).status()).toBe(404);
    expect((await page.request.post(`${CARE}/api/workflow/patients/${PAT_B}/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: {} })).status()).toBe(404);
    // CSRF: origem estranha e content-type indevido são recusados pelo proxy.
    const evil = await page.request.post(`${CARE}/api/care/me/symptoms`, { headers: { origin: 'http://evil.example', 'content-type': 'application/json' }, data: { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', requestId: randomUUID() } });
    expect(evil.status()).toBe(403);
    const noOrigin = await page.request.fetch(`${CARE}/api/care/me/symptoms`, { method: 'POST', headers: { 'content-type': 'application/json' }, data: { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', requestId: randomUUID() } });
    expect(noOrigin.status()).toBe(403);
    const ctype = await page.request.post(`${CARE}/api/care/me/symptoms`, { headers: { origin: CARE, 'content-type': 'text/plain' }, data: '{}' });
    expect(ctype.status()).toBe(415);
    // Idempotência: mesmo requestId não duplica.
    const rid = randomUUID(); const body = { symptomCode: 'fever', intensity: 'moderada', onset: 'hoje', redFlags: [], description: 'Febre FICTÍCIA para simular alerta urgente', requestId: rid };
    const r1 = await page.request.post(`${CARE}/api/care/me/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: body });
    const r2 = await page.request.post(`${CARE}/api/care/me/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: body });
    expect(r1.status()).toBe(201); expect((await r1.json()).urgent).toBe(true); expect((await r2.json()).duplicate).toBe(true);
    expect(sql(`SELECT count(*) FROM patient_symptom_reports WHERE source_reference='${rid}'`)).toBe('1');
    // Logout com origem inválida é recusado; logout legítimo remove a sessão local.
    expect((await page.request.post(`${CARE}/api/auth/logout`, { headers: { origin: 'http://evil.example' }, maxRedirects: 0 })).status()).toBe(403);
    await page.getByRole('button', { name: 'Sair' }).click();
    // RP-initiated logout: o IdP pede confirmação (sem id_token_hint) e encerra a sessão SSO.
    await page.waitForURL(/\/protocol\/openid-connect\/logout/); await shot(page, 'idp-logout-confirm');
    await page.click('#kc-logout'); await page.waitForURL(`${CARE}/care`);
    expect(await sessionToken(context, CARE)).toBeNull();
    // Novo "Entrar" exige credenciais novamente (SSO encerrado, sem reautenticação silenciosa).
    await page.getByRole('link', { name: 'Entrar', exact: true }).click(); await page.waitForURL(/localhost:8080\/realms\//);
    await expect(page.locator('#username')).toBeVisible(); await page.goto(`${CARE}/care`);
    const after = await page.request.post(`${CARE}/api/care/me/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', requestId: randomUUID() } });
    expect(after.status()).toBe(401);
    saveEvidence(); await context.close();
  });

  test('05 cadastro real de TOTP para contas profissionais (required action do IdP)', async ({ browser }) => {
    for (const user of ['farmaceutico', 'enfermeira', 'admin.tecnico']) {
      const { context, page } = await staffLogin(browser, user, { enroll: true });
      // Sessão do cadastro não executou o formulário OTP; MFA só é reconhecido em login com OTP.
      // M17: o Clinical oferece confirmação imediata (prompt=login, max_age=0) e o IdP executa o OTP — sem afrouxar a exigência.
      if (user === 'farmaceutico') {
        await expect(page.getByRole('heading', { name: 'Confirme o login com o aplicativo autenticador' })).toBeVisible();
        const authReq = page.waitForRequest((r) => r.url().startsWith(`${STATE.issuer}/protocol/openid-connect/auth`));
        await page.getByRole('link', { name: 'Confirmar com o código do aplicativo' }).click();
        const u = new URL((await authReq).url()); expect(u.searchParams.get('prompt')).toBe('login'); expect(u.searchParams.get('max_age')).toBe('0');
        await page.waitForURL(/localhost:8080\/realms\//); await expect(page.getByText('Por favor, reautentique-se para continuar')).toBeVisible(); // usuário já identificado
        await page.fill('#password', PW); await page.click('#kc-login'); await page.waitForSelector('#otp'); await page.fill('#otp', await freshCode(user)); await page.click('#kc-login');
        await page.waitForURL(`${CLIN}/clinical`);
        await expect(page.getByText(/Farmácia · MFA confirmado/)).toBeVisible(); await shot(page, 'clinical-mfa-confirmed-after-enrollment');
      }
      await context.close(); expect(secrets[user]).toMatch(/^[A-Z2-7 ]+$/);
    }
  });

  test('05b (regressão) troca do código ≥2 s após o OTP: access_token.amr mantém "otp" e MFA é reconhecido', async ({ browser, request }) => {
    const { context } = await staffLogin(browser, 'enfermeira', { delayCallbackMs: 2500 });
    const s = await sessionToken(context, CLIN); const c = claims(s.token);
    expect(c.amr).toContain('otp'); expect(Date.now() / 1000 - c.auth_time).toBeGreaterThanOrEqual(2);
    expect((await apiGet(request, 'clinical/me', s.token)).status()).toBe(200);
    evidence.tokens.delayedCallback = { amr: c.amr, secondsAfterAuth: Math.round(Date.now() / 1000 - c.auth_time) }; saveEvidence(); await context.close();
  });

  test('06 Clinical: farmacêutico (senha+TOTP) — lista mínima, busca por vínculo, paciente sob demanda, alerta §5.1, intervenção, encaminhamento, pré-ciclo, linha do tempo; auditoria', async ({ browser, request }) => {
    const { context, page } = await staffLogin(browser, 'farmaceutico', { wrongOtpFirst: true });
    const s = await sessionToken(context, CLIN); const c = claims(s.token); pharmacistToken = s.token;
    expect(await page.evaluate(() => document.cookie.includes('onco_session'))).toBe(false);
    evidence.tokens.pharmacist = { iss: c.iss, aud: c.aud, amr: c.amr, exp_minus_iat: c.exp - c.iat, cookieMaxAgeSeconds: Math.round(s.cookie.expires - Date.now() / 1000) };
    expect(c.amr).toContain('otp'); // MFA comprovado pelo formulário OTP do IdP
    await expect(page.getByText(/Farmácia · MFA confirmado/)).toBeVisible();
    // UI-02/UI-03: lista mínima — nomes, prontuário, gravidade e pendências; NENHUM detalhe clínico antes de abrir o paciente.
    const list = page.locator('[aria-label="Pacientes vinculados"]'); await expect(list.getByRole('listitem')).toHaveCount(5);
    await expect(list.getByRole('listitem').first()).toContainText('Urgente'); await expect(list.getByRole('listitem').filter({ hasText: 'Carlos Menezes' })).toContainText('Urgente');
    await expect(list).toContainText('Ana Ribeiro'); await expect(list).toContainText('Prontuário PR-10021'); await expect(list).not.toContainText('Elisa Prado');
    const main = page.locator('main');
    for (const detail of [`[${RUN}]`, 'Neutrófilos', 'Ondansetrona', 'FOLFOX', 'Penicilina', 'Relato', 'Ciclo']) await expect(main, `lista não pode exibir "${detail}"`).not.toContainText(detail);
    const wl = await (await apiGet(request, 'clinical/worklist', s.token)).json();
    for (const row of wl.patients) expect(Object.keys(row).sort()).toEqual(['allocation', 'id', 'name', 'pending', 'record', 'severity']); // alocação = localização, não dado clínico
    const rank = wl.patients.map((p) => ({ urgent: 2, review: 1 })[p.severity] ?? 0); expect(rank).toEqual([...rank].sort((a, b) => b - a)); // priorizada por gravidade
    expect(sql(`SELECT count(*) FROM audit_events WHERE actor_sub='${sub('farmaceutico')}' AND action='patient.overview.read'`)).toBe('0');
    await shot(page, 'clinical-worklist');
    // Achado hml: em 390px o nome/perfil sobrepunha a marca no cabeçalho. Sem sobreposição e sem rolagem horizontal.
    await page.setViewportSize({ width: 390, height: 844 });
    const box = async (sel) => { const b = await page.locator(sel).first().boundingBox(); expect(b, sel).not.toBeNull(); return b; };
    const brand = await box('.clinical-header .brand'), user = await box('.clinical-header .clin-user span'), out = await box('.clinical-header .clin-user button');
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap(brand, user), 'marca × usuário').toBe(false); expect(overlap(brand, out), 'marca × Sair').toBe(false); expect(overlap(user, out), 'usuário × Sair').toBe(false);
    for (const b of [brand, user, out]) expect(b.x + b.width).toBeLessThanOrEqual(390 + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await shot(page, 'clinical-worklist-390');
    await page.setViewportSize({ width: 1280, height: 720 });
    // UI-04: busca restrita ao vínculo (acento indiferente); fora do vínculo => vazio, sem 403 indicativo de existência.
    await page.getByLabel('Buscar paciente').fill('debora'); await page.getByRole('button', { name: 'Buscar' }).click();
    const res = page.getByRole('list', { name: 'Resultado da busca' }); await expect(res.getByRole('listitem')).toHaveCount(1); await expect(res).toContainText('Débora Nunes');
    await page.getByLabel('Buscar paciente').fill('Elisa'); await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('Nenhum paciente encontrado entre os seus vínculos.')).toBeVisible(); await shot(page, 'clinical-search-no-link');
    const elisa = await apiGet(request, 'clinical/worklist?q=Elisa', s.token); expect(elisa.status()).toBe(200); expect((await elisa.json()).patients).toEqual([]);
    await page.getByLabel('Buscar paciente').fill('PR-10021'); await page.getByRole('button', { name: 'Buscar' }).click();
    await page.getByRole('link', { name: /Ana Ribeiro/ }).click();
    // Paciente aberto: agora sim os dados, com leitura auditada.
    await expect(page.getByRole('heading', { level: 1, name: 'Ana Ribeiro' })).toBeVisible();
    expect(sql(`SELECT count(*) FROM audit_events WHERE actor_sub='${sub('farmaceutico')}' AND action='patient.overview.read' AND metadata->>'patient_id'='${PAT_A}'`)).not.toBe('0'); // ≥1 (efeitos duplicados do modo dev do React)
    const card = page.getByRole('article', { name: /Alerta symptom\./ }).filter({ hasText: `[${RUN}]` }); await expect(card).toBeVisible();
    await expect(card).toContainText('Aguardando revisão'); await expect(card).toContainText('Origem: Care — paciente');
    await card.getByLabel('Intervenção farmacêutica (nota)').fill('Revisão farmacêutica SINTÉTICA: avaliar com equipe; nenhuma conduta automática.');
    await card.getByRole('button', { name: 'Registrar intervenção' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Intervenção farmacêutica registrada' })).toBeVisible();
    await expect(card).toContainText('Em avaliação'); await shot(page, 'clinical-review-registered');
    // Encaminhamento à medicina: cria tarefa e leva o alerta a "Encaminhado".
    await card.getByRole('button', { name: 'Encaminhar' }).click();
    await card.getByLabel('Encaminhar para').selectOption('physician'); await card.getByLabel('Motivo do encaminhamento').fill(`Avaliar náusea persistente [${RUN}]`);
    await card.getByRole('button', { name: 'Criar encaminhamento' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Encaminhamento criado' })).toBeVisible(); await expect(card).toContainText('Encaminhado');
    await page.getByRole('tab', { name: 'Tarefas' }).click();
    const task = page.getByRole('listitem', { name: `Encaminhamento: Avaliar náusea persistente [${RUN}]` }); await expect(task).toContainText('Aguardando recebimento'); await expect(task).toContainText('Responsável: Medicina');
    await expect(task.getByRole('button', { name: 'Confirmar recebimento' })).toHaveCount(0); // só o responsável confirma
    // Pré-ciclo: disponibilidade de dados; ausência => "Não é possível concluir" (nunca "apto").
    await page.getByRole('tab', { name: 'Pré-ciclo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Não é possível concluir' })).toBeVisible();
    const chk = page.getByRole('list', { name: 'Checklist pré-ciclo' });
    await expect(chk).toContainText('Ausente — Protocolo com versão aprovada'); await expect(chk).toContainText('Disponível — Neutrófilos'); await expect(chk).toContainText('Origem: SIM-LAB-001');
    await page.getByLabel(/Bloqueado/).check(); await page.getByLabel('Fundamentação').fill('Protocolo sem versão aprovada e alergias não confirmadas (sintético).');
    await page.getByRole('button', { name: 'Registrar parecer' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Parecer pré-ciclo registrado' })).toBeVisible();
    await shot(page, 'clinical-precycle');
    // Linha do tempo com origem e horário; prontuário estruturado sob demanda.
    await page.getByRole('tab', { name: 'Linha do tempo' }).click(); const tl = page.getByRole('list', { name: 'Linha do tempo' });
    await expect(tl).toContainText('Relato no Care'); await expect(tl).toContainText('Origem: Care — paciente'); await expect(tl).toContainText('Aguardando revisão → Em avaliação'); await expect(tl).toContainText('Parecer pré-ciclo: bloqueado');
    await shot(page, 'clinical-timeline');
    await page.getByRole('tab', { name: 'Prontuário' }).click(); await expect(page.getByText('Ciclos e protocolos')).toBeVisible(); await shot(page, 'clinical-synthetic-record');
    await page.getByRole('tab', { name: 'Alertas' }).focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: 'Tarefas' })).toHaveAttribute('aria-selected', 'true');
    const ax = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); evidence.a11y.clinicalLoggedIn = a11yMap(ax);
    await page.goto(`${CLIN}/clinical`); evidence.a11y.clinicalWorklist = a11yMap(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze());
    // Reconstrução da trilha no banco (role administrativa somente para leitura de evidência).
    const alert = sql(`SELECT a.id||'|'||a.status||'|'||a.level FROM clinical_alerts a WHERE a.source_report_id='${reportId}'`).split('|');
    expect(alert[1]).toBe('referred'); expect(alert[2]).toBe('needs_review');
    expect(sql(`SELECT string_agg(from_status||'>'||to_status||':'||actor_role, ',' ORDER BY at) FROM clinical_alert_transitions WHERE alert_id='${alert[0]}'`)).toBe('awaiting_review>in_evaluation:pharmacist,in_evaluation>referred:pharmacist');
    const intv = sql(`SELECT actor_sub||'|'||decision||'|'||organization_id FROM clinical_interventions WHERE alert_id='${alert[0]}'`);
    expect(intv).toBe(`${sub('farmaceutico')}|pending|${ORG}`);
    const audit = sql(`SELECT action||'|'||actor_sub FROM audit_events WHERE organization_id='${ORG}' AND (metadata->>'report_id'='${reportId}' OR metadata->>'alert_id'='${alert[0]}') ORDER BY id`).split('\n');
    expect(audit).toEqual([`symptom.created|${sub('paciente.a')}`, `intervention.created|${sub('farmaceutico')}`, `referral.created|${sub('farmaceutico')}`, `alert.transition|${sub('farmaceutico')}`]);
    const reads = sql(`SELECT string_agg(DISTINCT action, ',' ORDER BY action) FROM audit_events WHERE organization_id='${ORG}' AND actor_sub='${sub('farmaceutico')}'`);
    expect(reads).toBe('alert.transition,intervention.created,patient.overview.read,patient.precycle.read,patient.record.read,patient.search,patient.timeline.read,patient.worklist,precycle.reviewed,referral.created');
    expect(sql(`SELECT count(*) FROM patient_guidance WHERE intervention_id IS NOT NULL OR (status<>'draft' AND approved_by IS NULL)`)).toBe('0'); // nenhuma orientação automática ao paciente
    evidence.db = { reportId, alertId: alert[0], alertStatus: alert[1], interventionActorIsPharmacist: true, auditTrail: audit.map((x) => x.split('|')[0]), pharmacistAuditActions: reads };
    saveEvidence(); await context.close();
  });

  test('06b Clinical: médico confirma recebimento, conclui com desfecho e resolve o alerta; enfermagem sem decisões farmacêuticas', async ({ browser, request }) => {
    const { context, page } = await staffLogin(browser, 'medico', { enroll: true });
    await context.close();
    const md = await staffLogin(browser, 'medico');
    const list = md.page.locator('[aria-label="Pacientes vinculados"]'); await expect(list.getByRole('listitem')).toHaveCount(1); await expect(list).toContainText('Ana Ribeiro');
    await md.page.getByRole('link', { name: /Ana Ribeiro/ }).click(); await md.page.getByRole('tab', { name: 'Tarefas' }).click();
    const task = md.page.getByRole('listitem', { name: `Encaminhamento: Avaliar náusea persistente [${RUN}]` });
    await task.getByRole('button', { name: 'Confirmar recebimento' }).click(); await expect(task).toContainText('Recebida');
    await task.getByRole('button', { name: 'Concluir' }).click(); await task.getByLabel('Desfecho').fill('Avaliado pela medicina no sistema oficial (sintético).');
    await task.getByRole('button', { name: 'Registrar desfecho' }).click(); await expect(task).toContainText('Concluída'); await expect(task).toContainText('Desfecho: Avaliado pela medicina');
    await md.page.getByRole('tab', { name: 'Alertas' }).click();
    const card = md.page.getByRole('article', { name: /Alerta symptom\./ }).filter({ hasText: `[${RUN}]` });
    await expect(card.getByRole('button', { name: 'Registrar intervenção' })).toHaveCount(0); // intervenção farmacêutica é da farmácia
    await card.getByRole('button', { name: 'Resolvido', exact: true }).click(); await card.getByLabel('Justificativa').fill('Conduta definida pela medicina no sistema oficial.');
    await card.getByRole('button', { name: 'Confirmar: Resolvido' }).click(); await expect(md.page.getByRole('status').filter({ hasText: 'Alerta: Resolvido' })).toBeVisible();
    await shot(md.page, 'clinical-physician-resolved');
    const alertId = sql(`SELECT id FROM clinical_alerts WHERE source_report_id='${reportId}'`);
    expect(sql(`SELECT status FROM clinical_alerts WHERE id='${alertId}'`)).toBe('resolved');
    expect(sql(`SELECT string_agg(to_status||':'||actor_role, ',' ORDER BY at) FROM clinical_alert_transitions WHERE alert_id='${alertId}'`)).toBe('in_evaluation:pharmacist,referred:pharmacist,resolved:physician');
    expect(sql(`SELECT status||'|'||(received_by_sub='${sub('medico')}')||'|'||(closed_by_sub='${sub('medico')}') FROM clinical_tasks WHERE alert_id='${alertId}'`)).toBe('done|true|true');
    // Estado final é imutável pela API.
    const t = (await sessionToken(md.context, CLIN)).token;
    const reopen = await request.post(`${API}/v1/clinical/alerts/${alertId}/transition`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' }, data: { to: 'in_evaluation' } });
    expect(reopen.status()).toBe(403);
    await md.context.close();
    // Enfermagem: lista restrita ao vínculo; não registra intervenção farmacêutica nem descarta alerta.
    const nur = await staffLogin(browser, 'enfermeira'); const tn = (await sessionToken(nur.context, CLIN)).token;
    const wl = await (await apiGet(request, 'clinical/worklist', tn)).json(); expect(wl.patients.map((p) => p.name).sort()).toEqual(['Ana Ribeiro', 'Carlos Menezes']);
    expect((await (await apiGet(request, 'clinical/worklist?q=Bruno', tn)).json()).patients).toEqual([]);
    const carlosAlert = sql(`SELECT id FROM clinical_alerts WHERE patient_id='22222222-2222-4222-8222-222222222223' AND status='awaiting_review' LIMIT 1`);
    const H = { authorization: `Bearer ${tn}`, 'x-organization-id': ORG, 'content-type': 'application/json' };
    expect((await request.post(`${API}/v1/clinical/alerts/${carlosAlert}/transition`, { headers: H, data: { to: 'dismissed', justification: 'Tentativa de descarte pela enfermagem' } })).status()).toBe(403);
    expect((await request.post(`${API}/v1/workflow/clinical/patients/22222222-2222-4222-8222-222222222223/interventions`, { headers: H, data: { alertId: carlosAlert, note: 'x', decision: 'pending' } })).status()).toBe(403);
    expect((await request.post(`${API}/v1/clinical/alerts/${carlosAlert}/transition`, { headers: H, data: { to: 'in_evaluation', justification: 'Enfermagem em avaliação' } })).status()).toBe(201);
    expect((await apiGet(request, `clinical/patients/${PAT_B}`, tn)).status()).toBe(403);
    await nur.context.close();
  });

  test('06c (M15.4b) alocação: Sincronizar (FHIR R4 → HL7 ADT) via integration-gateway, agrupamento por unidade/andar, manual com autoria, divergência e decisão humana', async ({ browser, request }) => {
    const GW = 'http://127.0.0.1:4310', GH = { authorization: `Bearer ${process.env.INTEGRATION_GATEWAY_TOKEN}` };
    expect((await request.post(`${GW}/v1/sim/reset`, { headers: GH })).status()).toBe(200);
    expect((await request.get(`${GW}/v1/locations`)).status()).toBe(401); // gateway exige token de serviço
    const { context, page } = await staffLogin(browser, 'farmaceutico');
    await expect(page.getByText('Alocação ainda não sincronizada com o hospital.')).toBeVisible();
    const groups = page.locator('[aria-label="Pacientes vinculados"]');
    await expect(groups.getByRole('heading', { level: 2 })).toHaveText(['Sem alocação informada (5)']);
    await page.getByRole('button', { name: 'Sincronizar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sincronização concluída: 5 atualizados, 0 sem alteração, 0 divergências, 1 não localizado.' })).toBeVisible();
    await expect(page.getByText(/Última sincronização: .* · Origem: Hospital simulado · FHIR R4/)).toBeVisible();
    await expect(groups.getByRole('heading', { level: 2 })).toHaveText(['Hospital-Dia Oncológico · Térreo (1)', 'Oncologia Clínica · 3º andar (3)', 'Sem alocação informada (1)']);
    const g3 = groups.getByRole('list', { name: 'Oncologia Clínica · 3º andar' });
    await expect(g3).toContainText('Ana Ribeiro'); await expect(g3).toContainText('Quarto 301 · Leito A'); await expect(groups).not.toContainText('Elisa Prado'); // alocada, mas sem vínculo
    await expect(groups.getByRole('list', { name: 'Sem alocação informada' })).toContainText('Débora Nunes');
    for (const detail of ['Neutrófilos', 'Ondansetrona', 'FOLFOX', 'Relato']) await expect(page.locator('main')).not.toContainText(detail);
    await shot(page, 'clinical-grouped-synced');
    // Lista desagrupada (opção) continua mínima.
    await page.getByLabel('Agrupar por unidade e andar').uncheck(); await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0); await page.getByLabel('Agrupar por unidade e andar').check();
    // Manual: somente quando o hospital não informa — Débora.
    await page.getByRole('link', { name: /Débora Nunes/ }).click();
    const panel = page.getByRole('region', { name: 'Alocação' }); await expect(panel).toContainText('Sem alocação informada pelo hospital.');
    await panel.getByRole('button', { name: 'Informar alocação manual' }).click();
    await panel.getByLabel('Unidade').fill('Oncologia Clínica'); await panel.getByLabel('Andar').fill('3º andar'); await panel.getByLabel('Quarto').fill('306'); await panel.getByLabel('Leito').fill('A');
    await panel.getByRole('button', { name: 'Salvar alocação manual' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Alocação manual registrada.' })).toBeVisible();
    await expect(panel).toContainText('Oncologia Clínica · 3º andar · Quarto 306 · Leito A'); await expect(panel).toContainText(/Registro manual — Farmácia, \d{2}\/\d{2}\/\d{4}/);
    await shot(page, 'clinical-allocation-manual');
    const t = (await sessionToken(context, CLIN)).token, H = { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' };
    const PAT_D = '22222222-2222-4222-8222-222222222224';
    expect(sql(`SELECT source||'|'||recorded_by_role||'|'||(recorded_by_sub='${sub('farmaceutico')}') FROM patient_allocations WHERE patient_id='${PAT_D}' AND superseded_at IS NULL`)).toBe('manual|pharmacist|true');
    // Hospital informa Ana: manual recusado (409); sem vínculo (Elisa): 403.
    const ana = await request.post(`${API}/v1/clinical/patients/${PAT_A}/allocation`, { headers: H, data: { unit: 'Outra unidade' } });
    expect(ana.status()).toBe(409);
    expect((await request.post(`${API}/v1/clinical/patients/22222222-2222-4222-8222-222222222225/allocation`, { headers: H, data: { unit: 'Oncologia Clínica' } })).status()).toBe(403);
    // Hospital (fase 2, HL7 ADT^A02): transfere Ana; informa Débora diferente do manual => divergência, manual mantido.
    expect((await request.post(`${GW}/v1/sim/advance`, { headers: GH })).status()).toBe(200);
    await page.goto(`${CLIN}/clinical`); await page.getByRole('button', { name: 'Sincronizar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sincronização concluída: 1 atualizado, 1 sem alteração, 1 divergência, 0 não localizados.' })).toBeVisible();
    await expect(page.getByText(/Origem: Hospital simulado · HL7 ADT/)).toBeVisible();
    const deb = groups.getByRole('listitem').filter({ hasText: 'Débora Nunes' }); await expect(deb).toContainText('Manual'); await expect(deb).toContainText('Divergência com o hospital');
    await expect(groups.getByRole('listitem').filter({ hasText: 'Ana Ribeiro' })).toContainText('Quarto 303 · Leito A');
    expect(sql(`SELECT source FROM patient_allocations WHERE patient_id='${PAT_D}' AND superseded_at IS NULL`)).toBe('manual');
    await shot(page, 'clinical-allocation-conflict-list');
    await deb.getByRole('link').click();
    const warn = page.getByRole('note', { name: 'Divergência de alocação' }); await expect(warn).toContainText('O hospital informa: Oncologia Clínica · 4º andar · Quarto 410 · Leito B (Hospital simulado · HL7 ADT');
    await shot(page, 'clinical-allocation-conflict');
    await warn.getByRole('button', { name: 'Usar dado do hospital' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Alocação do hospital adotada.' })).toBeVisible();
    await expect(panel).toContainText('Oncologia Clínica · 4º andar · Quarto 410 · Leito B'); await expect(panel).toContainText('Hospital — Hospital simulado · HL7 ADT');
    await expect(panel.getByRole('button', { name: /alocação manual/ })).toHaveCount(0);
    const ax = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); evidence.a11y.clinicalAllocation = a11yMap(ax);
    await page.goto(`${CLIN}/clinical`); evidence.a11y.clinicalGrouped = a11yMap(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze());
    // Trilha: histórico preservado (manual substituído), divergência resolvida por humano, auditoria.
    expect(sql(`SELECT string_agg(source||':'||(superseded_at IS NULL), ',' ORDER BY recorded_at) FROM patient_allocations WHERE patient_id='${PAT_D}'`)).toBe('manual:false,hospital:true');
    expect(sql(`SELECT resolution||'|'||(resolved_by_sub='${sub('farmaceutico')}') FROM allocation_sync_items WHERE patient_id='${PAT_D}' AND outcome='conflict'`)).toBe('accepted_hospital|true');
    expect(sql(`SELECT string_agg(source_format||':'||updated||'/'||unchanged||'/'||conflicts||'/'||not_found, ',' ORDER BY at) FROM allocation_sync_runs WHERE organization_id='${ORG}'`)).toBe('fhir_r4:5/0/0/1,hl7v2_adt:1/1/1/0');
    expect(sql(`SELECT string_agg(action, ',' ORDER BY id) FROM audit_events WHERE actor_sub='${sub('farmaceutico')}' AND action LIKE 'allocation.%'`)).toBe('allocation.sync,allocation.manual,allocation.sync,allocation.conflict.resolved');
    // Enfermagem (sem vínculo com Débora) não grava alocação dela; admin técnico não sincroniza.
    const nur = await staffLogin(browser, 'enfermeira'); const tn = (await sessionToken(nur.context, CLIN)).token;
    expect((await request.post(`${API}/v1/clinical/patients/${PAT_D}/allocation/conflict`, { headers: { ...H, authorization: `Bearer ${tn}` }, data: { resolution: 'kept_manual' } })).status()).toBe(403);
    await nur.context.close();
    const adm = await staffLogin(browser, 'admin.tecnico'); const ta = (await sessionToken(adm.context, CLIN)).token;
    expect((await request.post(`${API}/v1/clinical/allocations/sync`, { headers: { ...H, authorization: `Bearer ${ta}` }, data: {} })).status()).toBe(403);
    await adm.context.close();
    evidence.allocation = { runs: 2, conflictResolvedByHuman: true, formats: ['fhir_r4', 'hl7v2_adt'] }; saveEvidence(); await context.close();
  });

  test('06d (M15.4c) importação de PDF do hospital: prévia, detalhe só ao abrir, confirmação humana, divergência não aplicada, descarte, papéis', async ({ browser, request }) => {
    const FX = 'tests/fixtures/pdf';
    const { context, page } = await staffLogin(browser, 'farmaceutico');
    await page.getByRole('link', { name: 'Importar lista (PDF)' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Importar lista do hospital' })).toBeVisible();
    // Sem marcação sintética: recusado antes de qualquer gravação.
    await page.getByLabel('Arquivo PDF (até 2 MB)').setInputFiles(`${FX}/censo-sem-marcador.pdf`); await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await expect(page.locator('p.clin-error[role=alert]')).toContainText('DADOS SINTÉTICOS');
    expect(sql(`SELECT count(*) FROM pdf_imports WHERE organization_id='${ORG}'`)).toBe('0');
    // Prévia Tasy (colunas): nada gravado em pacientes/alocação.
    await page.getByLabel('Arquivo PDF (até 2 MB)').setInputFiles(`${FX}/censo-tasy-sintetico.pdf`); await page.getByRole('button', { name: 'Gerar prévia' }).click();
    const prev = page.getByRole('region', { name: 'Prévia da importação' });
    await expect(prev.getByRole('status')).toHaveText('1 novos, 0 com alocação a atualizar, 2 sem alteração, 1 com divergência, 1 sem vínculo, 1 não importáveis.');
    await expect(prev).toContainText('Tasy — censo hospitalar (colunas)');
    expect(sql(`SELECT count(*) FROM patients WHERE hospital_record='PR-10031'`)).toBe('0');
    expect(sql(`SELECT status FROM pdf_imports WHERE organization_id='${ORG}'`)).toBe('previewed');
    const rows = prev.getByRole('list', { name: 'Linhas do arquivo' });
    await expect(rows.getByRole('listitem')).toHaveCount(6);
    // Lista mínima: alocação/motivo só ao abrir a linha.
    await expect(prev.getByText('Alocação no arquivo').first()).toBeHidden();
    const deb = rows.getByRole('listitem').filter({ hasText: 'Débora Nunes' });
    await expect(deb).toContainText('Divergência com o hospital');
    await deb.locator('summary').click();
    await expect(deb).toContainText('Oncologia Clínica · 4º andar · Quarto 412 · Leito B'); await expect(deb).toContainText('Oncologia Clínica · 4º andar · Quarto 410 · Leito B (hospital)');
    const fab = rows.getByRole('listitem').filter({ hasText: 'PR-10026' }); await fab.locator('summary').click(); await expect(fab).toContainText('Nome cadastrado'); await expect(fab).toContainText('Fábio Rocha');
    await expect(rows.getByRole('listitem').filter({ hasText: 'Elisa Prado' })).toContainText('Sem vínculo com você');
    await expect(rows.getByRole('listitem').filter({ hasText: 'PR-10031' })).toContainText('Novo paciente');
    await expect(page.locator('main')).not.toContainText(/\b(teste|fict[ií]cio)/i);
    await shot(page, 'clinical-pdf-preview');
    evidence.a11y.clinicalPdfPreview = a11yMap(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze());
    // Confirmação humana SEM marcar a divergência: Débora permanece com o dado do hospital.
    await page.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Importação confirmada: 1 novos, 0 atualizados, 0 divergências aplicadas, 5 não aplicados.' })).toBeVisible();
    const PAT_D = '22222222-2222-4222-8222-222222222224';
    expect(sql(`SELECT source||'|'||room FROM patient_allocations WHERE patient_id='${PAT_D}' AND superseded_at IS NULL`)).toBe('hospital|410');
    expect(sql(`SELECT p.synthetic||'|'||p.display_name||'|'||a.source||'|'||a.room||'|'||(a.import_id IS NOT NULL)||'|'||(SELECT count(*) FROM care_assignments c WHERE c.patient_id=p.id AND c.oidc_sub='${sub('farmaceutico')}' AND c.active)
      FROM patients p JOIN patient_allocations a ON a.patient_id=p.id AND a.superseded_at IS NULL WHERE p.hospital_record='PR-10031'`)).toBe('true|Gustavo Lima|pdf|401|true|1');
    expect(sql(`SELECT string_agg(coalesce(skip_reason,'aplicada'), ';' ORDER BY line) FROM pdf_import_rows WHERE organization_id='${ORG}'`)).toBe('Sem alteração;Divergência com o hospital não aplicada;Sem alteração;Paciente sem vínculo assistencial com você;aplicada;Linha inválida');
    expect(sql(`SELECT count(*) FROM pdf_imports WHERE organization_id='${ORG}' AND length(encrypted) > 1000 AND status='confirmed'`)).toBe('1');
    // Lista: novo paciente agrupado, marcado como PDF importado; detalhe da origem ao abrir.
    await page.getByRole('link', { name: 'Ver lista de pacientes' }).click();
    const g4 = page.locator('[aria-label="Pacientes vinculados"]').getByRole('list', { name: 'Oncologia Clínica · 4º andar' });
    const gus = g4.getByRole('listitem').filter({ hasText: 'Gustavo Lima' }); await expect(gus).toContainText('Quarto 401 · Leito A'); await expect(gus).toContainText('PDF importado');
    await shot(page, 'clinical-pdf-imported-list');
    await gus.getByRole('link').click();
    await expect(page.getByRole('region', { name: 'Alocação' })).toContainText(/Tasy — censo hospitalar \(colunas\) · Farmácia · arquivo [0-9a-f]{12}/);
    // Mesmo arquivo de novo: aviso de reimportação; descartar não altera nada.
    await page.goto(`${CLIN}/clinical/importar`);
    await page.getByLabel('Arquivo PDF (até 2 MB)').setInputFiles(`${FX}/censo-tasy-sintetico.pdf`); await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await expect(page.getByRole('note').filter({ hasText: 'Este mesmo arquivo já foi importado em' })).toBeVisible();
    await expect(prev.getByRole('status')).toContainText('0 novos');
    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Importação descartada. Nada foi alterado.' })).toBeVisible();
    // MV (linhas): novo paciente com confirmação.
    await page.goto(`${CLIN}/clinical/importar`);
    await page.getByLabel('Arquivo PDF (até 2 MB)').setInputFiles(`${FX}/mapa-leitos-mv-sintetico.pdf`); await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await expect(prev).toContainText('MV — mapa de leitos (linhas)');
    await expect(prev.getByRole('list', { name: 'Linhas do arquivo' }).getByRole('listitem').filter({ hasText: 'PR-10032' })).toContainText('Novo paciente');
    const t = (await sessionToken(context, CLIN)).token, H = { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' };
    const mvId = sql(`SELECT id FROM pdf_imports WHERE organization_id='${ORG}' AND status='previewed'`);
    // Papéis: médico não importa; outra pessoa não confirma a prévia alheia.
    const med = await staffLogin(browser, 'medico'); const tm = (await sessionToken(med.context, CLIN)).token;
    await med.page.goto(`${CLIN}/clinical`); await expect(med.page.getByRole('link', { name: 'Importar lista (PDF)' })).toHaveCount(0);
    const b64 = readFileSync(`${FX}/censo-tasy-sintetico.pdf`).toString('base64');
    expect((await request.post(`${API}/v1/clinical/imports/pdf`, { headers: { ...H, authorization: `Bearer ${tm}` }, data: { fileName: 'c.pdf', contentBase64: b64 } })).status()).toBe(403);
    expect((await request.post(`${API}/v1/clinical/imports/${mvId}/confirm`, { headers: { ...H, authorization: `Bearer ${tm}` }, data: {} })).status()).toBe(403);
    await med.context.close();
    expect((await request.post(`${API}/v1/clinical/imports/pdf`, { headers: H, data: { fileName: 'x.pdf', contentBase64: Buffer.from('<html>').toString('base64') } })).status()).toBe(400);
    await page.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Importação confirmada: 1 novos/ })).toBeVisible();
    expect((await request.post(`${API}/v1/clinical/imports/${mvId}/confirm`, { headers: H, data: {} })).status()).toBe(409);
    expect(sql(`SELECT string_agg(action, ',' ORDER BY id) FROM audit_events WHERE actor_sub='${sub('farmaceutico')}' AND action LIKE 'patient.import.%'`))
      .toBe('patient.import.previewed,patient.import.confirmed,patient.import.previewed,patient.import.discarded,patient.import.previewed,patient.import.confirmed');
    evidence.pdfImport = { layouts: ['tasy-censo-v1', 'mv-mapa-leitos-v1'], confirmedByHuman: true, conflictNotApplied: true }; saveEvidence(); await context.close();
  });

  test('07 negativos de papel/MFA/vínculo com tokens reais na API', async ({ browser, request }) => {
    // Farmacêutico sem MFA: autenticado, mas API exige MFA.
    const noMfa = await staffLogin(browser, 'farmaceutico.semmfa');
    await expect(noMfa.page.getByRole('heading', { name: 'Confirme o login com o aplicativo autenticador' })).toBeVisible(); await expect(noMfa.page.locator('[aria-label="Pacientes vinculados"]')).toHaveCount(0);
    await shot(noMfa.page, 'clinical-pharmacist-without-mfa');
    const t1 = (await sessionToken(noMfa.context, CLIN)).token; expect(claims(t1).amr || []).not.toContain('otp');
    expect((await apiGet(request, 'patients', t1)).status()).toBe(403);
    expect((await apiGet(request, `workflow/clinical/patients/${PAT_A}/alerts`, t1)).status()).toBe(403);
    await noMfa.context.close();
    // Admin técnico com MFA: sem acesso clínico por padrão.
    const adm = await staffLogin(browser, 'admin.tecnico');
    await expect(adm.page.getByRole('heading', { name: 'Seu perfil não tem acesso clínico' })).toBeVisible(); await expect(adm.page.locator('[aria-label="Pacientes vinculados"]')).toHaveCount(0);
    await shot(adm.page, 'clinical-admin-no-clinical-access');
    const t2 = (await sessionToken(adm.context, CLIN)).token;
    const r2 = await apiGet(request, 'patients', t2); expect(r2.status()).toBe(403); expect((await r2.json()).message).toContain('Sem vínculo profissional');
    expect((await apiGet(request, `patients/${PAT_A}/record`, t2)).status()).toBe(403);
    expect((await apiGet(request, 'clinical/worklist', t2)).status()).toBe(403); expect((await apiGet(request, `clinical/patients/${PAT_A}`, t2)).status()).toBe(403);
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
      await p.goto(`${CARE}/care`); await p.getByRole('link', { name: 'Entrar', exact: true }).click(); await kcLogin(p, user); await p.waitForURL(`${CARE}/care`);
      const t = (await sessionToken(ctx, CARE)).token;
      expect((await apiGet(request, 'patients', t)).status()).toBe(403);
      const post = await request.post(`${API}/v1/workflow/clinical/patients/${PAT_B}/interventions`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' }, data: { alertId: randomUUID(), note: 'x', decision: 'accepted' } });
      expect(post.status()).toBe(403);
      // R3: rota antiga com patientId do cliente não existe mais; /care/me resolve só o vínculo da própria identidade.
      expect((await request.post(`${API}/v1/workflow/care/patients/${PAT_A}/symptoms`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' }, data: {} })).status()).toBe(404);
      const me = await request.get(`${API}/v1/care/me`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': ORG } });
      if (user === 'cuidador.a') { expect(me.status()).toBe(403); await expect(p.getByRole('heading', { name: 'Seu acesso ainda não foi liberado' })).toBeVisible(); }
      else {
        expect(me.status()).toBe(200);
        const rid = randomUUID(); const sym = await request.post(`${API}/v1/care/me/symptoms`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': ORG, 'content-type': 'application/json' }, data: { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', requestId: rid } });
        expect(sym.status()).toBe(201); expect(sql(`SELECT patient_id FROM patient_symptom_reports WHERE source_reference='${rid}'`)).toBe(PAT_B);
        // Outra organização no cabeçalho: nenhum vínculo => 403.
        expect((await request.get(`${API}/v1/care/me`, { headers: { authorization: `Bearer ${t}`, 'x-organization-id': '99999999-9999-4999-8999-999999999999' } })).status()).toBe(403);
      }
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
    await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible(); await expect(page.locator('.care-nav')).toHaveCount(0);
    await page.goto(`${CARE}/care/sintoma`); await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible(); await expect(page.getByText('O que você está sentindo?')).toHaveCount(0);
    expect((await page.request.post(`${CARE}/api/care/me/symptoms`, { headers: { origin: CARE, 'content-type': 'application/json' }, data: { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', requestId: randomUUID() } })).status()).toBe(401);
    await shot(page, 'care-error-unauthenticated');
    expect(errors).toEqual([]); await ctx.close();
  });

  test('07d (M15.3) cuidador: convite do paciente, tudo desligado, permissões granulares, histórico e revogação imediata', async ({ browser }) => {
    const careLogin = async (user) => { const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto(`${CARE}/care`);
      await p.getByRole('link', { name: 'Entrar', exact: true }).click(); await kcLogin(p, user); await p.waitForURL(`${CARE}/care`); return { ctx, p }; };
    const post = (p, path, data) => p.request.fetch(`${CARE}/api/care/${path}`, { method: 'POST', headers: { origin: CARE, 'content-type': 'application/json' }, data });
    const pat = await careLogin('paciente.a');
    await pat.p.getByRole('link', { name: 'Cuidador e privacidade' }).click();
    await pat.p.getByLabel('30 dias').check(); await pat.p.getByRole('button', { name: 'Criar código de convite' }).click();
    const code = (await pat.p.getByLabel('Código de convite').innerText()).trim(); expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(sql(`SELECT count(*) FROM caregiver_invites WHERE code_hash LIKE '%${code.replace(/-/g, '')}%'`)).toBe('0'); // código nunca armazenado
    await shot(pat.p, 'care-caregiver-invite');
    const cg = await careLogin('cuidador.a');
    await expect(cg.p.getByRole('heading', { name: 'Seu acesso ainda não foi liberado' })).toBeVisible();
    // Código errado: recusado e auditado; nenhum vínculo.
    await cg.p.fill('#invite-code', 'AAAA-BBBB-CCCC'); await cg.p.getByLabel(/Entendo que verei apenas/).check(); await cg.p.getByRole('button', { name: 'Usar código' }).click();
    await expect(cg.p.getByRole('alert').filter({ hasText: 'Código inválido' })).toBeVisible();
    expect(sql(`SELECT count(*) FROM audit_events WHERE action='care.caregiver.invite.rejected' AND actor_sub='${sub('cuidador.a')}'`)).not.toBe('0');
    await cg.p.fill('#invite-code', code.toLowerCase()); await cg.p.getByRole('button', { name: 'Usar código' }).click();
    await expect(cg.p.getByRole('heading', { level: 1 })).toContainText('Olá, Carla. Você acompanha Ana.');
    await expect(cg.p.getByText('Ana ainda não liberou nenhuma informação para você.')).toBeVisible();
    await expect(cg.p.getByRole('link', { name: 'Minha jornada' })).toHaveCount(0); await expect(cg.p.getByRole('link', { name: 'Cuidador e privacidade' })).toHaveCount(0);
    await expect(cg.p.getByText('Próxima sessão')).toHaveCount(0); await shot(cg.p, 'care-caregiver-nothing-shared');
    // Sem escopo: API recusa jornada, medicamentos, relato e qualquer gestão de cuidador.
    for (const path of ['me/journey', 'me/medications', 'me/caregivers']) expect((await cg.p.request.get(`${CARE}/api/care/${path}`)).status(), path).toBe(403);
    expect((await post(cg.p, 'me/symptoms', { symptomCode: 'nausea', intensity: 'leve', onset: 'hoje', requestId: randomUUID() })).status()).toBe(403);
    expect((await post(cg.p, 'me/caregivers/invites', { termDays: 90 })).status()).toBe(403);
    // Código já usado não serve de novo.
    expect((await post(pat.p, 'caregiver/accept', { code, acceptTerms: true })).status()).toBe(403);
    // Paciente libera a jornada e o registro de sintomas.
    await pat.p.reload(); const card = pat.p.getByRole('article', { name: /Cuidador Carla/ });
    await card.getByLabel('Ver minha jornada (sessões e relatos)').click(); await expect(pat.p.getByRole('status')).toContainText('Permissões atualizadas');
    await expect(card.getByLabel('Ver minha jornada (sessões e relatos)')).toBeChecked();
    await card.getByLabel('Registrar sintomas por mim').click(); await expect(card.getByLabel('Registrar sintomas por mim')).toBeChecked();
    expect(sql(`SELECT array_to_string(scopes, ',' ) FROM caregiver_links WHERE revoked_at IS NULL AND caregiver_sub='${sub('cuidador.a')}'`)).toBe('ver_jornada,registrar_sintoma');
    await cg.p.reload(); await expect(cg.p.getByRole('link', { name: 'Minha jornada' })).toBeVisible(); await expect(cg.p.getByRole('link', { name: 'Meus medicamentos' })).toHaveCount(0);
    await cg.p.getByRole('link', { name: 'Minha jornada' }).click(); await expect(cg.p.getByText(/Ciclo 1/)).toBeVisible();
    expect((await cg.p.request.get(`${CARE}/api/care/me/medications`)).status()).toBe(403);
    const rid = randomUUID(); const sym = await post(cg.p, 'me/symptoms', { symptomCode: 'fatigue', intensity: 'leve', onset: 'hoje', requestId: rid });
    expect(sym.status()).toBe(201);
    expect(sql(`SELECT patient_id||'|'||(details->>'reported_by')||'|'||actor_sub FROM patient_symptom_reports WHERE source_reference='${rid}'`)).toBe(`${PAT_A}|caregiver|${sub('cuidador.a')}`);
    expect((await post(cg.p, `me/medications/66666666-6666-4666-8666-666666666671/adherence`, { status: 'taken', requestId: randomUUID() })).status()).toBe(403); // adesão é do paciente
    // Histórico de acessos visível ao paciente.
    await pat.p.reload(); const log = pat.p.getByRole('region', { name: 'Histórico de acessos do cuidador' });
    await expect(log.getByText(/Carla: Viu a jornada/).first()).toBeVisible(); await expect(log.getByText(/Carla: Registrou um sintoma/).first()).toBeVisible();
    await shot(pat.p, 'care-caregiver-settings');
    const a11y = await new AxeBuilder({ page: pat.p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); evidence.a11y.careCaregivers = a11yMap(a11y);
    // Revogação imediata.
    await pat.p.getByRole('button', { name: 'Encerrar acesso agora' }).click(); await expect(pat.p.getByRole('status')).toContainText('Acesso encerrado');
    expect((await cg.p.request.get(`${CARE}/api/care/me`)).status()).toBe(403);
    await cg.p.reload(); await expect(cg.p.getByRole('heading', { name: 'Seu acesso ainda não foi liberado' })).toBeVisible();
    expect(sql(`SELECT string_agg(DISTINCT action, ',' ORDER BY action) FROM audit_events WHERE metadata->>'actor_role'='patient' AND action LIKE 'care.caregiver.%' AND actor_sub='${sub('paciente.a')}'`)).toContain('care.caregiver.revoked');
    saveEvidence(); await pat.ctx.close(); await cg.ctx.close();
  });

  test('08 token adulterado, sessão forjada vencida e expiração real do token', async ({ browser, request }) => {
    // Login real próprio: não depende do tempo consumido pelos testes 06/07.
    const fresh = await staffLogin(browser, 'farmaceutico');
    const expiryToken = (await sessionToken(fresh.context, CLIN)).token;
    const [h, p, sig] = expiryToken.split('.');
    const forged = JSON.parse(Buffer.from(p, 'base64url')); forged.sub = sub('enfermeira');
    expect((await request.get(`${API}/v1/me`, { headers: { authorization: `Bearer ${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${sig}` } })).status()).toBe(401);
    // Cookie de sessão com expiração passada (cifrado com a chave do ambiente de teste) é rejeitado pelo app.
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: 'onco_session', value: seal({ token: expiryToken, expiresAt: Date.now() - 1000 }), url: CLIN, httpOnly: true, sameSite: 'Lax' }]);
    expect((await ctx.request.get(`${CLIN}/api/work/worklist`)).status()).toBe(401);
    // Expiração real: aguarda exp + tolerância (5 s) e a API recusa o mesmo token antes válido.
    expect((await request.get(`${API}/v1/me`, { headers: { authorization: `Bearer ${expiryToken}` } })).status()).toBe(200);
    const wait = claims(expiryToken).exp * 1000 - Date.now() + 7000;
    evidence.tokens.waitedForExpiryMs = wait; if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    expect((await request.get(`${API}/v1/me`, { headers: { authorization: `Bearer ${expiryToken}` } })).status()).toBe(401);
    saveEvidence(); await ctx.close(); await fresh.context.close();
  });


  test('08b (M15.5) solicitação a médico vinculado: revisão humana, resposta ajustada, conclusão e auditoria', async ({ browser, request }) => {
    const farm = await staffLogin(browser, 'farmaceutico');
    const doc = await staffLogin(browser, 'medico');
    const token=(await sessionToken(farm.context,CLIN)).token;
    const unit=sql(`SELECT unit FROM patient_allocations WHERE organization_id='${ORG}' AND patient_id='${PAT_A}' AND superseded_at IS NULL`);
    const lit=v=>`'${String(v).replaceAll("'","''")}'`;
    sql(`INSERT INTO request_priority_criteria(organization_id,unit,priority,description,sla_minutes) VALUES('${ORG}',${lit(unit)},'routine','Critério demonstrativo: avaliação durante o serviço',60) ON CONFLICT DO NOTHING;
      UPDATE memberships SET display_name='Dra. Sofia (conta sintética)',professional_registration='CRF-SINT-001' WHERE organization_id='${ORG}' AND oidc_sub='${sub('farmaceutico')}' AND role='pharmacist';
      UPDATE memberships SET display_name='Dr. Miguel (conta sintética)',professional_registration='CRM-SINT-001' WHERE organization_id='${ORG}' AND oidc_sub='${sub('medico')}' AND role='physician'`);
    await farm.page.goto(`${CLIN}/clinical/pacientes/${PAT_A}`);
    await farm.page.getByRole('tab',{name:'Solicitações médicas'}).click();
    await farm.page.getByRole('button',{name:'Nova solicitação ao médico'}).click();
    await farm.page.getByLabel('Destinatário',{exact:true}).selectOption(`${sub('medico')}|${STATE.issuer}`);
    await farm.page.locator('fieldset input[type=checkbox]').first().check();
    await farm.page.getByLabel('Justificativa para avaliação médica').fill(`Solicito avaliação humana das evidências vinculadas ${RUN}`);
    await farm.page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
    await farm.page.getByRole('link',{name:'Abrir rascunho para revisar e enviar'}).click();
    await expect(farm.page.getByRole('heading',{name:'Rascunho',exact:true})).toBeVisible();
    const id=farm.page.url().split('/').at(-1);
    const post=(ctx,path,data,origin=CLIN)=>ctx.request.post(`${CLIN}/api/work/${path}`,{headers:{origin,'content-type':'application/json'},data});
    expect((await post(farm.context,`medical-requests/${id}/transition`,{revision:1,to:'sent'})).status()).toBe(400);
    expect((await post(farm.context,`medical-requests/${id}/transition`,{revision:1,to:'sent',confirmed:true},'https://invalid.example')).status()).toBe(403);
    await farm.page.getByRole('button',{name:'Editar justificativa e prioridade'}).click();
    await farm.page.getByLabel('Justificativa revisada').fill(`Justificativa revisada pelo farmacêutico ${RUN}`);
    await farm.page.getByRole('button',{name:'Salvar revisão',exact:true}).click();
    await expect(farm.page.getByRole('status')).toContainText('Rascunho atualizado');
    await expect(farm.page.getByRole('button',{name:'Enviar ao médico'})).toBeDisabled();
    await farm.page.getByLabel(/Revisei as evidências/).focus(); await farm.page.keyboard.press('Space');
    await shot(farm.page,'m155-draft-reviewed');
    evidence.a11y.m155Draft=a11yMap(await new AxeBuilder({page:farm.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze());
    await farm.page.getByRole('button',{name:'Enviar ao médico'}).click();
    await expect(farm.page.getByRole('heading',{name:'Enviada',exact:true})).toBeVisible();
    await expect(farm.page.getByText(/60 minutos; sem escalonamento/)).toBeVisible();
    await expect(farm.page.getByText(/CRF-SINT-001/).first()).toBeVisible();
    expect((await post(farm.context,`medical-requests/${id}/transition`,{revision:2,to:'sent',confirmed:true})).status()).toBe(409);
    await doc.page.goto(`${CLIN}/clinical/solicitacoes`);
    await doc.page.locator(`a[href='/clinical/solicitacoes/${id}']`).click();
    await doc.page.getByRole('button',{name:'Iniciar revisão médica'}).click();
    await doc.page.getByLabel('Resposta médica obrigatória').fill(`Ajustada após avaliação no sistema oficial sintético ${RUN}`);
    await doc.page.getByRole('button',{name:'Ajustada',exact:true}).click();
    await expect(doc.page.getByRole('heading',{name:'Ajustada',exact:true})).toBeVisible();
    await expect(doc.page.getByRole('button',{name:'Registrar conclusão'})).toHaveCount(0);
    await expect(doc.page.getByText('CRM-SINT-001',{exact:false}).first()).toBeVisible();
    await expect(doc.page.getByText(/Não há aviso nem acompanhamento de prazo/)).toBeVisible();
    await shot(doc.page,'m155-physician-adjusted');
    await farm.page.reload();
    await farm.page.getByLabel('Desfecho',{exact:true}).fill('Resposta médica conferida no sistema oficial sintético');
    await farm.page.getByLabel('Referência do registro no sistema oficial').fill(`SINT-OFICIAL-${RUN}`);
    await farm.page.getByRole('button',{name:'Registrar conclusão'}).click();
    await expect(farm.page.getByRole('heading',{name:'Concluída',exact:true})).toBeVisible();
    for(const width of [390,768,1440]) {await farm.page.setViewportSize({width,height:1000});expect(await farm.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot(farm.page,`m155-completed-${width}`);}
    await farm.page.evaluate(()=>document.documentElement.style.zoom='2');expect(await farm.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot(farm.page,'m155-zoom200');
    evidence.a11y.m155Completed=a11yMap(await new AxeBuilder({page:farm.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze());
    const actions=sql(`SELECT string_agg(action,',' ORDER BY id) FROM medical_request_events WHERE request_id='${id}' AND action<>'read'`);
    expect(actions).toBe('created,edited,sent,in_review,adjusted,completed');
    expect(sql(`SELECT count(*) FROM audit_events WHERE metadata->>'request_id'='${id}' AND action='medical_request.completed'`)).toBe('1');
    expect((await apiGet(request,`clinical/medical-requests/${id}`,token,'99999999-9999-4999-8999-999999999999')).status()).toBe(403);
    // Consulta sem nome cadastrado continua auditada; nenhuma transição pode ser feita sem identificação nominal.
    sql(`UPDATE memberships SET display_name=NULL WHERE organization_id='${ORG}' AND oidc_sub='${sub('farmaceutico')}' AND role='pharmacist'`);
    await farm.page.reload();await expect(farm.page.getByRole('heading',{name:'Concluída',exact:true})).toBeVisible();
    await expect(farm.page.getByRole('alert').filter({hasText:'Seu nome profissional não está cadastrado'})).toBeVisible();
    await shot(farm.page,'m155-missing-name-readable');
    sql(`UPDATE memberships SET display_name='Dra. Sofia (conta sintética)' WHERE organization_id='${ORG}' AND oidc_sub='${sub('farmaceutico')}' AND role='pharmacist'`);
    // Pedido órfão também quando o médico vinculado perde a atribuição (não apenas plantão).
    const linkedDraft=await post(farm.context,`patients/${PAT_A}/medical-requests`,{justification:'Revisar evidência sintética antes da perda do vínculo',recipientMode:'specific',recipientIssuer:STATE.issuer,recipientSub:sub('medico'),priority:'routine',evidence:JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('type',e->>'type','id',e->>'id')) FROM medical_requests r,jsonb_array_elements(r.evidence) e WHERE r.id='${id}'`))});
    expect(linkedDraft.status()).toBe(201);const linkedOrphan=await linkedDraft.json();
    expect((await post(farm.context,`medical-requests/${linkedOrphan.id}/transition`,{revision:1,to:'sent',confirmed:true})).status()).toBe(201);
    sql(`UPDATE care_assignments SET active=false WHERE organization_id='${ORG}' AND patient_id='${PAT_A}' AND oidc_sub='${sub('medico')}'`);
    expect(await(await farm.context.request.get(`${CLIN}/api/work/medical-requests/${linkedOrphan.id}`)).json()).toMatchObject({recipientActive:false,status:'sent'});
    await farm.page.goto(`${CLIN}/clinical/solicitacoes/${linkedOrphan.id}`);
    await expect(farm.page.getByRole('alert').filter({hasText:'Destinatário sem acesso ativo'})).toBeVisible();await shot(farm.page,'m155-linked-orphan');
    expect((await doc.context.request.get(`${CLIN}/api/work/medical-requests/${linkedOrphan.id}`)).status()).toBe(403);
    sql(`UPDATE care_assignments SET active=true WHERE organization_id='${ORG}' AND patient_id='${PAT_A}' AND oidc_sub='${sub('medico')}'`);
    // Novas rotas não concedem permissões a outros perfis nem a vínculos inexistentes.
    for(const user of ['admin.tecnico','enfermeira','farmaceutico.semmfa']){
      const x=await staffLogin(browser,user);const t=(await sessionToken(x.context,CLIN)).token;
      expect((await apiGet(request,`clinical/medical-requests/${id}`,t)).status()).toBe(403);await x.context.close();
    }
    evidence.db.m155Linked={requestId:id,actions,orphanRequestId:linkedOrphan.id};saveEvidence();await farm.context.close();await doc.context.close();
  });

  test('08c (M15.5) plantonista sem vínculo: evidências limitadas, escala ausente bloqueia, aceita/recusa, descarta e nega prontuário', async ({ browser, request }) => {
    const farm=await staffLogin(browser,'farmaceutico'),doc=await staffLogin(browser,'medico');
    const token=(await sessionToken(doc.context,CLIN)).token;
    const pat=randomUUID(),lab=randomUUID(),otherLab=randomUUID(),shift=randomUUID(),unit=`Unidade SAM ${RUN}`;
    sql(`INSERT INTO patients(id,organization_id,external_reference,synthetic,display_name,hospital_record) VALUES('${pat}','${ORG}','SAM-${RUN}',true,'Paciente SAM ${RUN}','SAM-${RUN}');
      INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES('${ORG}','${pat}','${STATE.issuer}','${sub('farmaceutico')}');
      INSERT INTO patient_allocations(organization_id,patient_id,unit,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES('${ORG}','${pat}','${unit}','manual','${STATE.issuer}','${sub('farmaceutico')}','pharmacist');
      INSERT INTO clinical_labs(id,organization_id,patient_id,analyte_code,analyte_label,result_value,unit,collected_at,source_reference) VALUES('${lab}','${ORG}','${pat}','SINT','Exame selecionado',1,'x',now(),'SAM-selected'),('${otherLab}','${ORG}','${pat}','SINT2','Exame não selecionado',2,'x',now(),'SAM-hidden');
      INSERT INTO request_priority_criteria(organization_id,unit,priority,description) VALUES('${ORG}','${unit}','routine','Critério demonstrativo da unidade SAM')`);
    const post=(ctx,path,data)=>ctx.request.post(`${CLIN}/api/work/${path}`,{headers:{origin:CLIN,'content-type':'application/json'},data});
    const draft=async()=>{const r=await post(farm.context,`patients/${pat}/medical-requests`,{justification:`Avaliar evidência sintética selecionada ${RUN}`,recipientMode:'on_call',priority:'routine',evidence:[{type:'lab',id:lab}]});expect(r.status()).toBe(201);return r.json();};
    const r=await draft();
    await farm.page.goto(`${CLIN}/clinical/solicitacoes/${r.id}`);await farm.page.getByLabel(/Revisei as evidências/).check();await farm.page.getByRole('button',{name:'Enviar ao médico'}).click();
    await expect(farm.page.getByRole('alert').filter({hasText:'Sem médico de plantão'})).toBeVisible();await shot(farm.page,'m155-error-no-oncall');
    sql(`INSERT INTO on_call_shifts(id,organization_id,unit,physician_issuer,physician_sub,starts_at,ends_at) VALUES('${shift}','${ORG}','${unit}','${STATE.issuer}','${sub('medico')}',now()-interval '1 hour',now()+interval '1 hour')`);
    await farm.page.getByLabel(/Revisei as evidências/).check();await farm.page.getByRole('button',{name:'Enviar ao médico'}).click();await expect(farm.page.getByRole('heading',{name:'Enviada',exact:true})).toBeVisible();
    expect((await apiGet(request,`clinical/patients/${pat}`,token)).status()).toBe(403);
    expect((await apiGet(request,`clinical/patients/${pat}/medical-request-options`,token)).status()).toBe(403);
    await doc.page.goto(`${CLIN}/clinical/solicitacoes/${r.id}`);
    await expect(doc.page.getByText('SAM-selected',{exact:false})).toBeVisible();await expect(doc.page.getByText('SAM-hidden',{exact:false})).toHaveCount(0);
    await expect(doc.page.getByRole('tab',{name:'Prontuário'})).toHaveCount(0);
    await doc.page.getByRole('button',{name:'Iniciar revisão médica'}).click();await doc.page.getByLabel('Resposta médica obrigatória').fill('Solicitação aceita após avaliação humana');await doc.page.getByRole('button',{name:'Aceita',exact:true}).click();await expect(doc.page.getByRole('heading',{name:'Aceita',exact:true})).toBeVisible();await shot(doc.page,'m155-oncall-limited');
    const rd=await(await farm.context.request.get(`${CLIN}/api/work/medical-requests/${r.id}`)).json();
    expect((await post(farm.context,`medical-requests/${r.id}/transition`,{revision:rd.revision,to:'completed',outcome:'Confirmado pelo autor',officialReference:`SINT-SAM-${RUN}`})).status()).toBe(201);
    const rejected=await draft();expect((await post(farm.context,`medical-requests/${rejected.id}/transition`,{revision:1,to:'sent',confirmed:true})).status()).toBe(201);
    await doc.page.goto(`${CLIN}/clinical/solicitacoes/${rejected.id}`);await doc.page.getByRole('button',{name:'Iniciar revisão médica'}).click();await doc.page.getByLabel('Resposta médica obrigatória').fill('Recusada com justificativa médica sintética');await doc.page.getByRole('button',{name:'Recusada',exact:true}).click();await expect(doc.page.getByRole('heading',{name:'Recusada',exact:true})).toBeVisible();
    const discarded=await draft();await farm.page.goto(`${CLIN}/clinical/solicitacoes/${discarded.id}`);await farm.page.getByRole('button',{name:'Descartar rascunho'}).click();await expect(farm.page.getByRole('heading',{name:'Descartada',exact:true})).toBeVisible();
    const orphan=await draft();expect((await post(farm.context,`medical-requests/${orphan.id}/transition`,{revision:1,to:'sent',confirmed:true})).status()).toBe(201);
    sql(`UPDATE on_call_shifts SET ends_at=now()-interval '1 second' WHERE id='${shift}'`);
    const orphanResponse=await farm.context.request.get(`${CLIN}/api/work/medical-requests/${orphan.id}`);
    expect(await orphanResponse.json()).toMatchObject({status:'sent',recipientActive:false});
    await farm.page.goto(`${CLIN}/clinical/solicitacoes/${orphan.id}`);
    await expect(farm.page.getByRole('alert').filter({hasText:'Destinatário sem acesso ativo'})).toBeVisible();
    await shot(farm.page,'m155-orphan-author-warning');
    expect((await apiGet(request,`clinical/medical-requests/${orphan.id}`,token)).status()).toBe(403);
    expect((await apiGet(request,`clinical/medical-requests/${r.id}`,token)).status()).toBe(403);
    expect(sql(`SELECT count(*) FROM audit_events WHERE metadata->>'request_id'='${r.id}' AND metadata->>'access_reason'='on_call'`)).not.toBe('0');
    evidence.a11y.m155Oncall=a11yMap(await new AxeBuilder({page:doc.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze());
    saveEvidence();await farm.context.close();await doc.context.close();
  });

  test('09 resultado axe (WCAG 2.x A/AA): nenhuma violação séria/crítica em Care, Clinical e Admin', async () => {
    const serious = Object.entries(evidence.a11y).flatMap(([k, v]) => v.filter((x) => ['serious', 'critical'].includes(x.impact)).map((x) => `${k}:${x.id}`));
    expect(serious, `violações axe sérias/críticas: ${serious.join(', ')}`).toEqual([]);
  });
});
