# CHANGELOG — ONCOPHARMA M14.5 (branch `fix/m14-5`)

Data: 11/10/2026 · Autor: Grok Bot, a pedido de Henrikael Walisson · Base: M14.4 (ZIP interno SHA-256 `e8c492bb…396d`, commit `ef70dc7`)
Referência imutável: Plano Diretor v3.0, decisões D-001 a D-008. **Sem redesenho, sem mudança de tokens de marca, sem novas funcionalidades de produto.**

## Ambiente e reprodutibilidade
- Node 22.23.3 / npm 10.9.9; `npm install --no-audit --no-fund` concluído (351 pacotes); **`package-lock.json` gerado e versionado**.
- PostgreSQL 17.11 local (apt), banco efêmero `oncopharma_dev`, role restrita `oncopharma_app`; segredos só em variáveis de ambiente (fora do repositório).
- Playwright 1.64 com Chrome do sistema (`/usr/bin/google-chrome`) e axe-core; IdP de **teste** Keycloak 26.8.0 (modo dev, JDK 21) com contas sintéticas.

## Correções de causa-raiz (código existente)
| # | Sintoma real (log) | Causa | Correção | Arquivos |
|---|---|---|---|---|
| 1 | `next build` clinical-web/portal: "You're importing a component that needs useState…" | diretiva `'use client'` estava na 2ª linha (após um import), logo era ignorada | `'use client'` movida para a 1ª linha | apps/{care-web,clinical-web,portal}/components/ClinicalAccess.tsx |
| 2 | `next build` care-web: "Property 'rule_version' does not exist on type 'Alert'" | tipo `Alert` não declarava campo retornado pela API | `rule_version?: string` no tipo | apps/*/components/WorkflowReview.tsx |
| 3 | Aviso Next: raiz do workspace inferida por lockfile externo | ausência de `outputFileTracingRoot` | raiz do monorepo fixada | apps/*/next.config.ts |
| 4 | API 500 ao registrar sintoma: `could not determine data type of parameter $4` (PostgreSQL) | parâmetros não tipados em `jsonb_build_object` nos INSERT de auditoria | casts explícitos `::text` / `::int` | services/api/src/{workflow,clinical}.controller.ts |
| 5 | Farmacêutico atribuído recebia 403 "Paciente não atribuído" em alertas/intervenções | `checkStaff` consultava `care_assignments` (FORCE RLS) **fora** do contexto de tenant → 0 linhas | consulta executada dentro de `withTenant(org)` (RLS mantida, nenhum bypass) | services/api/src/workflow.controller.ts |
| 6 | Login Care redirecionava para `/clinical` (404 no app Care) | callback copiado do portal | callback Care → `/care` | apps/care-web/app/api/auth/callback/route.ts |
| 7 | Care sem acesso visível a login/logout | lacuna funcional | link "Entrar com sua conta de teste" e botão "Encerrar sessão" com classes existentes | apps/care-web/components/CareSymptomReport.tsx |
| 8 | Negação exibida como "Forbidden" (inglês) ao paciente | proxy repassava `{error:"Forbidden"}` do NestJS | 4xx exibe a `message` pt-BR da API (≤200 caracteres) | apps/*/lib/workflow-proxy.ts |
| 9 | Confirmação "Revisão registrada…" nunca aparecia | `load()` limpava a mensagem logo após defini-la | mensagem definida após recarregar | apps/*/components/WorkflowReview.tsx |
| 10 | axe (WCAG AA) sério: contraste 3,45:1 do rótulo "AMBIENTE PROFISSIONAL" | cor derivada `#a8792d` sobre `#eef3f6` | `#8b642d` (cor já existente na mesma folha, 4,75:1). **Tokens de marca inalterados** | apps/*/app/globals.css, packages/design-system/app/globals.css |
| 11 | Logout local mantinha a sessão SSO do IdP (reentrada silenciosa) | sem logout RP-initiated | se `OIDC_END_SESSION_ENDPOINT` estiver configurado, o logout redireciona ao IdP | apps/{care-web,clinical-web,portal}/app/api/auth/logout/route.ts, .env.example |

## Testes e ferramentas adicionados
- `tests/m145-db-rls.integration.mjs` (incluído em `test:db:required` e no CI): RLS entre tenants, `patientId` vindo do cliente, INSERT/UPDATE entre tenants, `audit_events` (só INSERT no tenant; sem SELECT/UPDATE/DELETE; append-only até para admin), bypass por superusuário/`row_security=off`/`SET ROLE`.
- `tests/e2e/*` + `npm run test:e2e`: fluxo Care → API/PostgreSQL → Clinical → intervenção → auditoria; OIDC+PKCE, TOTP real, negativos de papel/MFA/vínculo, CSRF, idempotência, logout, expiração real de token, teclado e axe.
- `infra/idp-test/setup-keycloak-test.mjs` (`npm run idp:test:setup`): realm efêmero de teste, clientes públicos PKCE S256, audience `oncopharma-api`, claim `amr`, 8 contas sintéticas.
- `tools/validate-real.mjs`: release M14.5; checks `e2e-care-clinical`, `oidc-mfa-test-idp`, `release-gate`; `oidc-mfa` (IdP institucional) continua BLOCKED; usa Chrome do sistema se não houver Chromium.
- `.github/workflows/quality.yml`: `DATABASE_URL_ADMIN` disponível no passo de testes DB (fixtures sintéticas efêmeras).
- Versão `0.14.5-dev`.

## O que NÃO mudou
Decisões D-001..D-008, tokens (deepTeal #063F3B, emerald #15735D, navy #0A344A, gold #D7A858, mint #B9E1D0, canvas #F5F8F7, ink #152C32, danger #B42318), símbolos Care/Clinical, textos de segurança, migrações SQL 0001–0007, guards de MFA/RBAC/RLS (nenhum foi afrouxado). `apps/portal` mantido (decisão de descontinuação pendente).
