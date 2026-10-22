// E2E dos botões do Care (telas dos mockups oficiais 21/10). Clica cada ação e confere o resultado.
// Ambiente local de TESTE com dados fictícios; nada de segredo no repositório. Requer no ambiente:
//   E2E_CARE_URL (ex.: http://localhost:3124) e E2E_CARE_COOKIE (valor da sessão onco_session de um paciente fictício,
//   gerado pelo harness local). Opcional: E2E_REPORT (arquivo JSON com a tabela PASS/FAIL/EM BREVE).
// Uso: node tests/e2e/care-botoes.e2e.mjs
import { chromium } from 'playwright'; import fs from 'node:fs'; import { execSync } from 'node:child_process';
const CARE = process.env.E2E_CARE_URL, COOKIE = process.env.E2E_CARE_COOKIE;
if (!CARE || !COOKIE) { console.error('BLOQUEADO: defina E2E_CARE_URL e E2E_CARE_COOKIE'); process.exit(2); }
const rows = []; let fails = 0;
async function check(screen, device, button, fn) {
  try { const r = await fn(); rows.push({ screen, device, button, result: r?.soon ? 'EM BREVE' : 'PASS', note: r?.note ?? '' }); }
  catch (e) { fails++; rows.push({ screen, device, button, result: 'FAIL', note: String(e.message || e).split('\n')[0].slice(0, 160) }); }
  console.log(rows.at(-1).result.padEnd(8), device.padEnd(8), screen.padEnd(16), button);
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch(); const errs = [];
for (const device of ['desktop', 'celular']) {
  // Opcional: E2E_RESET_CMD (comando do harness local) zera os registros de adesão de hoje antes de cada dispositivo.
  if (process.env.E2E_RESET_CMD) execSync(process.env.E2E_RESET_CMD, { stdio: 'ignore' });
  const mobile = device === 'celular';
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' } : { viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.addCookies([{ name: 'onco_session', value: COOKIE, url: CARE, httpOnly: true, sameSite: 'Lax' }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${device}: ${String(e).slice(0, 160)}`));
  const go = async (path) => { await p.goto(CARE + path); await p.waitForLoadState('networkidle'); await p.locator('main h1').first().waitFor(); };
  const click = (loc) => (mobile ? loc.tap() : loc.click());
  const nav = mobile ? p.locator('.cm-tabs') : p.locator('.cm-side');
  const navLabels = mobile ? [['Início', '/care'], ['Sintomas', '/care/sintoma'], ['Remédios', '/care/medicamentos'], ['Equipe', '/care/equipe'], ['Alertas', '/care/alertas']]
    : [['Início', '/care'], ['Sintomas e febre', '/care/sintoma'], ['Medicação do dia', '/care/medicamentos'], ['Falar com a equipe', '/care/equipe'], ['Alertas', '/care/alertas'], ['Minha jornada', '/care/jornada'], ['Preciso de ajuda', '/care/ajuda'], ['Cuidador e privacidade', '/care/cuidador'], ['Preferências', '/care/preferencias']];
  // Navegação (menu lateral no desktop; abas inferiores no celular)
  await go('/care/alertas');
  for (const [label, href] of navLabels) await check('navegação', device, `${mobile ? 'Aba' : 'Menu'} "${label}"`, async () => {
    await click(nav.getByRole('link', { name: label, exact: true })); await p.waitForURL(CARE + href); await p.waitForLoadState('networkidle');
    ok((await nav.getByRole('link', { name: label, exact: true }).getAttribute('aria-current')) === 'page', 'item não ficou ativo'); });
  // Início
  await go('/care');
  if (!mobile) await check('início', device, 'Enviar check-in', async () => { await click(p.getByRole('button', { name: /Enviar check-in/ })); ok(await p.locator('[data-soon=checkin]').isVisible(), 'mensagem não apareceu'); return { soon: true, note: 'check-in diário sem backend: mensagem "Em breve" com link para Sintomas e febre' }; });
  if (mobile) await check('início', device, 'Estou bem hoje', async () => { await click(p.getByRole('button', { name: 'Estou bem hoje' })); ok(await p.getByText(/Em breve: o check-in diário/).first().isVisible(), 'mensagem não apareceu'); return { soon: true, note: 'check-in diário sem backend: mensagem "Em breve"' }; });
  await check('início', device, 'Marcar como tomada', async () => { if (!(await p.getByRole('button', { name: 'Marcar como tomada' }).count())) throw new Error('sem dose pendente para testar'); const before = await p.locator('[data-next-dose]').innerText(); await click(p.getByRole('button', { name: 'Marcar como tomada' })); await p.locator('[data-home-msg]').waitFor(); ok(/registrado "Tomei"/.test(await p.locator('[data-home-msg]').innerText()), 'sem confirmação'); return { note: `dose ${before} registrada via API (me/medications/:id/adherence)` }; });
  await check('início', device, 'Ligar 192 (alerta de febre)', async () => { const l = p.locator('[data-home-temp] a[href="tel:192"]'); if (!(await l.count())) return { note: 'sem febre recente: botão não exibido' }; ok(await l.isVisible(), 'invisível'); return { note: 'href=tel:192' }; });
  await check('início', device, 'Medir e registrar', async () => { await click(p.getByRole('link', { name: 'Medir e registrar' })); await p.waitForURL(/\/care\/sintoma#temperatura$/); await p.locator('#temperatura').waitFor(); });
  await go('/care');
  await check('início', device, 'Ver detalhes', async () => { await click(p.getByRole('link', { name: 'Ver detalhes' })); await p.waitForURL(CARE + '/care/jornada'); });
  if (mobile) { await go('/care'); await check('início', device, 'Registrar sintoma', async () => { await click(p.getByRole('link', { name: 'Registrar sintoma' })); await p.waitForURL(CARE + '/care/sintoma'); }); }
  // Medicação do dia
  await go('/care/medicamentos');
  await check('medicação', device, 'Tomei / Tomei só parte / Não tomei', async () => {
    const row = p.locator('.cm-med-row').filter({ has: p.getByRole('button', { name: 'Tomei', exact: true }) }).first(); const name = await row.getAttribute('data-med');
    await click(row.getByRole('button', { name: 'Tomei só parte' })); await p.getByText(`${name}: registrado "Tomei só parte" hoje.`).waitFor();
    return { note: `${name}: registrado e pílula "Tomado em parte"` }; });
  await check('medicação', device, 'Alterar', async () => { const name = await p.locator('.cm-med-row').filter({ has: p.getByRole('button', { name: /^Alterar/ }) }).first().getAttribute('data-med'); const row = p.locator(`.cm-med-row[data-med="${name}"]`); await click(row.getByRole('button', { name: /^Alterar/ })); await click(row.getByRole('button', { name: 'Não tomei' })); await p.getByText(`${name}: registrado "Não tomei" hoje.`).waitFor(); });
  await check('medicação', device, 'Marcar como tomada (próximo horário)', async () => { const c0 = await p.locator('[data-med-counter] b').innerText().catch(() => ''); const btn = p.locator('.cm-side-col').getByRole('button', { name: 'Marcar como tomada' }); if (!(await btn.count())) return { note: 'todas as doses já registradas' }; await click(btn); await p.getByText(/registrado "Tomei" hoje/).waitFor(); return { note: mobile ? 'registrado' : `contador ${c0} → ${await p.locator('[data-med-counter] b').innerText()}` }; });
  await check('medicação', device, 'Falar com a equipe', async () => { await click(p.getByRole('link', { name: 'Falar com a equipe' }).last()); await p.waitForURL(CARE + '/care/equipe'); });
  // Sintomas e febre
  await go('/care/sintoma');
  await check('sintomas', device, '+ 0,1 / − 0,1', async () => { const v = p.locator('#temp-value'); const a = await v.inputValue(); await click(p.getByRole('button', { name: 'Aumentar 0,1 grau' })); await click(p.getByRole('button', { name: 'Aumentar 0,1 grau' })); const b2 = await v.inputValue(); await click(p.getByRole('button', { name: 'Diminuir 0,1 grau' })); const c = await v.inputValue();
    ok(Math.round((parseFloat(b2.replace(',', '.')) - parseFloat(a.replace(',', '.'))) * 10) === 2 && Math.round((parseFloat(b2.replace(',', '.')) - parseFloat(c.replace(',', '.'))) * 10) === 1, `${a}→${b2}→${c}`); return { note: `${a} → ${b2} → ${c}` }; });
  await check('sintomas', device, 'Salvar temperatura (36,6 °C)', async () => { await p.fill('#temp-value', '36,6'); await click(p.getByRole('button', { name: 'Salvar temperatura' })); await p.locator('#temperatura [role=status]').waitFor(); });
  await check('sintomas', device, 'Salvar temperatura (37,8 °C → alerta + Ligar 192)', async () => { await p.fill('#temp-value', '37,8'); ok(await p.locator('[data-temp-urgent] a[href="tel:192"]').isVisible(), 'alerta local ausente em 37,8'); await click(p.getByRole('button', { name: 'Salvar temperatura' })); await p.locator('[data-temp-urgent]').waitFor(); return { note: 'limiar 37,8 °C: alerta e tel:192' }; });
  await check('sintomas', device, 'Continuar / Voltar / Enviar para a equipe', async () => {
    await p.getByLabel('Cansaço', { exact: true }).check(); await click(p.getByRole('button', { name: 'Continuar' }));
    await p.getByText('Quanto isso atrapalha você?').waitFor(); await click(p.getByRole('button', { name: 'Voltar' })); await p.getByText('O que você está sentindo?').waitFor(); await click(p.getByRole('button', { name: 'Continuar' }));
    await p.getByLabel(/Leve —/).check(); await click(p.getByRole('button', { name: 'Continuar' })); await p.getByLabel('Hoje', { exact: true }).check(); await click(p.getByRole('button', { name: 'Continuar' }));
    await click(p.getByRole('button', { name: 'Continuar' })); await click(p.getByRole('button', { name: 'Enviar para a equipe' })); await p.getByRole('heading', { name: 'Relato registrado' }).waitFor(); });
  await check('sintomas', device, 'Voltar ao início', async () => { await click(p.getByRole('link', { name: 'Voltar ao início' })); await p.waitForURL(CARE + '/care'); });
  await go('/care/sintoma');
  await check('sintomas', device, 'Febre → Ligar 192', async () => { await p.getByLabel('Febre', { exact: true }).check(); ok(await p.locator('[data-local-urgent] a[href="tel:192"]').isVisible(), 'sem alerta'); });
  // Alertas
  await go('/care/alertas');
  await check('alertas', device, 'Medir agora', async () => { await click(p.getByRole('link', { name: 'Medir agora' })); await p.waitForURL(/\/care\/sintoma#temperatura$/); });
  await go('/care/alertas');
  await check('alertas', device, 'Ligar 192', async () => { ok((await p.locator('.cm-alert-fever a.btn-danger').getAttribute('href')) === 'tel:192', 'href'); return { note: 'href=tel:192' }; });
  await check('alertas', device, 'Ligar para a equipe', async () => { const l = p.locator('a[data-team-call]'); if (await l.count()) { ok(/^tel:\+?\d+$/.test(await l.getAttribute('href')), 'href'); return { note: `href=${await l.getAttribute('href')} (contato do serviço, fictício)` }; } ok(await p.getByText(/Em breve: o telefone do seu serviço/).isVisible(), 'sem aviso'); return { soon: true, note: 'sem contato cadastrado: desabilitado com aviso' }; });
  await check('alertas', device, 'Marcar como tomado', async () => { await click(p.getByRole('link', { name: 'Marcar como tomado' })); await p.waitForURL(CARE + '/care/medicamentos'); });
  // Falar com a equipe
  await go('/care/equipe');
  await check('equipe', device, 'Ligar 192', async () => { ok((await p.locator('.cm-emergency a.btn-danger').getAttribute('href')) === 'tel:192', 'href'); return { note: 'href=tel:192' }; });
  for (const name of ['Ligar agora', 'Ligar']) await check('equipe', device, name, async () => { const l = p.locator('a[data-team-call]').filter({ hasText: new RegExp(`^${name}$`) }); if (await l.count()) { ok(/^tel:/.test(await l.getAttribute('href')), 'href'); return { note: `href=${await l.getAttribute('href')} (contato do serviço, fictício)` }; } ok(await p.getByRole('button', { name: new RegExp(`^${name} \\(em breve\\)`) }).isDisabled(), 'não desabilitado'); return { soon: true, note: 'sem contato cadastrado' }; });
  await check('equipe', device, 'Enviar mensagem', async () => { const bs = p.getByRole('button', { name: /Enviar mensagem \(em breve\)/ }); ok((await bs.count()) === 2 && (await bs.first().isDisabled()) && (await bs.last().isDisabled()), 'esperado desabilitado'); return { soon: true, note: 'mensagens pelo app sem backend: desabilitado "(em breve)"' }; });
  await check('equipe', device, 'Contato do serviço (telefone)', async () => { const l = p.locator('[aria-labelledby=t-serv] a[href^="tel:"]'); if (!(await l.count())) return { soon: true, note: 'nenhum contato cadastrado' }; return { note: `href=${await l.first().getAttribute('href')}` }; });
  await ctx.close();
}
// Sair (por último; encerra a sessão)
{ const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addCookies([{ name: 'onco_session', value: COOKIE, url: CARE, httpOnly: true, sameSite: 'Lax' }]); const p = await ctx.newPage();
  await p.goto(CARE + '/care'); await p.waitForLoadState('networkidle');
  await check('cabeçalho', 'desktop', 'Sair', async () => { await p.locator('.cm-top').getByRole('button', { name: 'Sair' }).click(); await p.waitForLoadState('networkidle'); await p.goto(CARE + '/care'); await p.getByRole('link', { name: 'Entrar', exact: true }).waitFor(); }); await ctx.close(); }
await b.close();
if (errs.length) { fails++; rows.push({ screen: 'geral', device: '-', button: 'erros de JavaScript', result: 'FAIL', note: errs.join(' | ') }); }
if (process.env.E2E_REPORT) fs.writeFileSync(process.env.E2E_REPORT, JSON.stringify(rows, null, 1));
console.log(`\n${rows.filter((r) => r.result === 'PASS').length} PASS · ${rows.filter((r) => r.result === 'EM BREVE').length} EM BREVE · ${fails} FAIL`);
process.exit(fails ? 1 : 0);
