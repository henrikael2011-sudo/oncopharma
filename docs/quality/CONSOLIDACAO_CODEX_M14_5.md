# Consolidação M14.5 — branch `fix/m14-5` (Grok Bot) + proposta independente Codex

Data: 11/10/2026. Base: `fix/m14-5`. Branch de consolidação: `fix/m14-5-merge`. Baseline comum: M14.4 (`ef70dc7`).
Fonte Codex: `ONCOPHARMA_M14_5.zip` (13 PASS / 0 FAIL / 5 BLOCKED no ambiente Codex, sem PostgreSQL). Diff integral Codex × M14.4 preservado em `docs/history/codex-m14_5/codex-vs-m14_4.diff` (sem artifacts/lockfile).
Critério: só entra o que agrega valor real e não conflita; nada que enfraqueça segurança, altere tokens de marca ou redesenhe.

## Incorporado da proposta Codex
| Item | Arquivos | Por que agrega |
|---|---|---|
| Callback OIDC valida **id_token e access token via JWKS** (assinatura, issuer, audience, exp, **nonce**, **at_hash**, `sub` coincidente); sessão limitada também pelo `exp` real | apps/{care-web,clinical-web,portal}/app/api/auth/callback/route.ts, lib/auth.ts, package.json (`jose`) | Fecha o meu risco R6 (nonce gerado mas nunca validado). Antes o BFF não validava id_token/nonce (só a API validava o access token). |
| Destino pós-login configurável e restrito a caminho local (`AUTH_POST_LOGIN_PATH`) | apps/*/lib/auth.ts | Evita open redirect; **padrão mantido `/care` no Care** (minha correção #6; o padrão Codex `/clinical` reintroduziria o 404). |
| API recusa conectar como superusuário, BYPASSRLS ou role ≠ `oncopharma_app` | services/api/src/database.service.ts | Defesa em profundidade: superusuário contorna RLS; a API agora falha fechada antes do `BEGIN`. |
| Role runtime criada com `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` | infra/scripts/provision-app-role.sh | Endurece o provisionamento (antes só NOBYPASSRLS explícito). |
| `require-postgres.mjs` recusa role com superuser/BYPASSRLS | tests/require-postgres.mjs | Pré-requisito de teste não pode ser satisfeito com conta privilegiada. |
| `checkStaff`: vínculo **e** atribuição na mesma transação com tenant | services/api/src/workflow.controller.ts | Mesmo defeito que corrigi (#5); a forma Codex é equivalente e um pouco melhor (uma conexão/um snapshot) e tem teste unitário. **Adotada a forma Codex.** |
| Testes unitários de segurança da API | tests/m145-api.security.mjs (`npm run test:api:security`) | Cobrem a recusa de role privilegiada e o checkStaff dentro do tenant. |
| Teste PostgreSQL adicional (reset do contexto após ROLLBACK, `SET ROLE` negado, conta admin recusada pelo pré-requisito) | tests/m145-db.integration.mjs | Complementa meus 7 negativos; **Codex não conseguiu executá-lo — aqui foi executado e PASSOU**. |
| Healthchecks `/api/health` em Care, Clinical, Admin | apps/*/app/api/health/route.ts | Healthcheck explícito sem dados; `clinicalOperationsEnabled:false`. |
| CI: `npm ci`; `test:api:security` e `test:rules`; senhas do Postgres efêmero via secrets | .github/workflows/quality.yml, tests/m143-integration-readiness.test.mjs | Build reprodutível pelo lockfile; sem senha literal no workflow. **Exige configurar `ONCO_CI_DB_ADMIN_PASSWORD` e `ONCO_CI_DB_APP_PASSWORD`.** |
| `packages/*` como workspaces; `build:packages`; portal incluído no `build`; `engines` Node 22 | package.json, packages/clinical-rules/package.json, package-lock.json | O build completo passa a cobrir clinical-rules e o portal legado (antes fora do build raiz). |
| validate:evidence v2: node22, lockfile, clinical-rules, api-security-unit, design, governance, **logs sanitizados**, digest de fontes + `source-stability`, `migration-0003`, `release-gate-enforced` (PASS quando o gate bloqueia) separado de `clinical-release` (BLOCKED), `vertical-care-clinical-audit` | tools/validate-real.mjs, tools/source-digest.mjs | Relatório mais granular e auditável; sem trocar BLOCKED por PASS. |
| Ideias de teste E2E portadas para a minha suíte: OTP incorreto recusado; `document.cookie` sem `onco_session`; `nonce` na requisição de autorização; callback com `state` inválido; **verifier PKCE incorreto recusado pelo IdP**; superfícies 390/768/1440 px sem overflow e sem erros de página; Care sem sessão mostra "Autenticação necessária" | tests/e2e/m145-flow.spec.mjs (testes 07b, 07c e asserções em 04/06) | Cobertura extra de OIDC e responsividade (+12 screenshots). |
| `.gitignore`: `*.tsbuildinfo`, `playwright-report/`, `test-results/` | .gitignore | Somente adições. |

## Conflitos resolvidos (mesmo problema, soluções diferentes)
| Tema | Minha solução | Codex | Mantido | Motivo |
|---|---|---|---|---|
| Contraste do rótulo Clinical (axe color-contrast) | `#a8792d` → `#8b642d` (mesma família dourada; já usada no CSS) | `navy #0A344A` | **Minha** | Mantém a hierarquia visual aprovada (acento dourado); trocar para navy muda o papel do acento. Nenhum token alterado nas duas. Continua pendente aprovação de produto (R9). |
| Destino pós-login Care | `/care` fixo | `postLoginPath()` padrão `/clinical` | **Combinação** | Mecanismo Codex (validação de caminho) + padrão `/care` no Care. |
| checkStaff fora do tenant | só `care_assignments` em `withTenant` | ambas as consultas em uma transação | **Codex** | Equivalente em segurança, uma transação; possui teste unitário. |
| Harness E2E/IdP | Keycloak 26.8 + realm efêmero, PostgreSQL real, fluxo Care→Clinical→auditoria | Keycloak 26.0.8 + H2, sem banco (vertical BLOCKED) | **Minha** | Só a minha executa o fluxo vertical persistido; os testes Codex dependiam de `ONCO_TEST_OTP_SECRETS` e de papéis de realm que o produto não usa (autorização vem do banco). Ideias portadas para a minha suíte. |
| CI DB passwords | literais de teste | secrets | **Codex** | Higiene; documentado como pré-requisito do repositório. |

## Não incorporado (e por quê)
- Rotas de login/callback/logout no **admin-web**: nenhuma operação administrativa existe; abrir sessão no Admin amplia superfície sem valor agora (decisão D-008 pendente).
- `.gitignore` do Codex **removia** `*.log`, `.DS_Store`, `coverage/` e `tools/synthetic-lab/.local/` (dados locais do laboratório) — enfraqueceria a proteção contra commit de dados locais.
- Perda do bit executável dos scripts `infra/scripts/*.sh` (artefato do ZIP).
- `tests/e2e-real/*`, `playwright.config.ts` raiz, `tools/run-identity-validation.mjs`, `tools/run-test-stack.mjs`: redundantes com a suíte que já executa o fluxo vertical; dependências de ambiente do container Codex (Chromium alternativo com flags de root).
- `next-env.d.ts` (gerado), artifacts/evidências do ambiente Codex (não reproduzem esta execução; preservados apenas no ZIP original).
- Cor navy no rótulo Clinical (ver conflitos).

## Novo nesta consolidação (não estava em nenhuma das duas)
- **Migração 0008** `infra/migrations/0008_tenant_setting_nullif.sql` (R1): `ALTER POLICY` nas 11 políticas de 0006/0007 para `nullif(current_setting('app.organization_id',true),'')::uuid`. Reproduzido antes (erro 22P02 em `clinical_alerts` e `patient_portal_links` numa sessão reutilizada: `artifacts/validation/m14_5/r1-before-0008.log`); teste `tests/m145-db-0008.integration.mjs` falhou antes e passa depois. Não amplia acesso (sem contexto ⇒ NULL ⇒ 0 linhas; INSERT continua negado). Aplicada por `bootstrap-ci-db.sh`.
