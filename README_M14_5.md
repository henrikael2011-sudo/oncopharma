# ONCOPHARMA M14.5 — Validação integrada técnica em DEV sintético

**Base imutável:** Plano Diretor v3.0, decisões D-001 a D-008. **Não homologado para uso assistencial.** Somente pacientes e contas sintéticos.
Branch `fix/m14-5` sobre o baseline M14.4 intocado (`ef70dc7`); consolidação em `fix/m14-5-merge`. Detalhes das mudanças: `CHANGELOG_M14_5.md`; arquivos alterados: `ARQUIVOS_ALTERADOS_M14_5.txt`.

## Resultado CONSOLIDADO (branch `fix/m14-5-merge`; `npm run validate:evidence` em 11/10/2026, 16:2x BRT)
Consolidação com a proposta independente do Codex: ver **`docs/quality/CONSOLIDACAO_CODEX_M14_5.md`** (o que entrou, conflitos, o que ficou de fora).

| Check | Estado | Evidência |
|---|---|---|
| node22 / lockfile (`npm ci` limpo) | PASS / PASS | `m14_5/npm-ci.log` |
| local-tests (`verify:local`) | PASS | `local-tests.log` (59+15+1+4) |
| lab-unit-tests (`test:lab`) | PASS | `lab-unit-tests.log` |
| clinical-rules (`test:rules`) | PASS | `clinical-rules.log` (5) |
| postgres-required (`test:db:required`, PostgreSQL 17, role `oncopharma_app`) | PASS | `postgres-required.log` — 12/12 (2 originais + 7 negativos M14.5 + 1 Codex + 2 migração 0008) |
| migration-0003 / migration-0008-nullif | PASS / PASS | `m14_5/bootstrap-merge.log`, `m14_5/r1-before-0008.log` |
| full-build (care, clinical, admin, API, clinical-rules, portal) | PASS | `full-build.log` |
| api-security-unit (`test:api:security`) | PASS | `api-security-unit.log` (2) |
| design / governance | PASS / PASS | `design.log`, `governance.log` |
| e2e-care-clinical (Playwright + Chrome + Keycloak de teste, 4 serviços) | PASS | `e2e-care-clinical.log`, `m14_5/e2e-*.json`, `screens/*.png` — 11/11 |
| oidc-mfa-test-idp | PASS | mesma suíte; **IdP de TESTE local** |
| vertical-care-clinical-audit | PASS | testes 04, 06 |
| oidc-mfa (IdP institucional) | **BLOCKED** | D-008: IdP não escolhido |
| release-gate-enforced (`quality:gate` sai 1 e bloqueia) | PASS | `release-gate.log` |
| clinical-release (G01–G09) | **BLOCKED** | sem aprovações formais |
| browser-lab-render | PASS | `lab-browser.png` |
| source-stability | PASS | digest igual antes/depois |

Total: **18 PASS, 0 FAIL, 2 BLOCKED**. Flags: `readyForIntegratedValidation=false`, `readyForClinicalUse=false`, `clinicalApproval=false`.
Histórico: a 1ª rodada M14.5 (`fix/m14-5`) teve 7 PASS + 2 BLOCKED com o esquema v1 de checks; a do Codex, 13 PASS/0 FAIL/5 BLOCKED (sem PostgreSQL). Os números não são comparáveis entre esquemas.

## O que o E2E comprova (com dados reais do fluxo, sem bypass)
1. Healthchecks: API `/v1/health` e `/v1/ready` (banco), Care, Clinical, Admin.
2. Sem sessão: API 401 (sem token e token inválido); proxies 401.
3. Paciente A entra no Care via OIDC Authorization Code + **PKCE S256** (state, client_id verificados); cookie `onco_session` **HttpOnly, SameSite=Lax**; token com `iss`, `aud=oncopharma-api`, `sub` da conta.
4. Relato sintético operado **por teclado** → persistido no PostgreSQL → alerta `needs_review`; febre fictícia → `urgent_review`; **idempotência** por requestId.
5. Negativos Care: `patientId` de outro paciente → 403 "Conta não vinculada ao paciente"; CSRF (origem estranha / sem Origin) → 403; Content-Type indevido → 415; logout com origem inválida → 403.
6. Logout → **logout RP-initiated no IdP** → novo login exige credenciais.
7. Profissionais cadastram **TOTP real** (required action do IdP); farmacêutico entra com senha+TOTP (`amr` contém `otp`), vê "MFA: confirmado pelo token", abre prontuário sintético, revisa o alerta criado pelo Care e registra intervenção.
8. Auditoria reconstruída no banco: `symptom.created` (sub do paciente) → `intervention.created` (sub do farmacêutico); leituras auditadas (`patient.list`, `patient.record.read`, `alert.list`); alerta `acknowledged`; **nenhuma orientação automática ao paciente** (`patient_guidance` vazio).
9. Negativos com tokens reais: farmacêutico **sem MFA** → 403; **admin técnico** com MFA → sem acesso clínico; enfermeira atribuída só a A → 403 para B; organização forjada → 403; paciente/cuidador → 403 em rotas profissionais e no relato de outro paciente.
10. (Consolidação/Codex) OTP incorreto recusado; `document.cookie` sem token; `nonce` enviado e **validado no id_token**; `state` inválido e **verifier PKCE incorreto** não criam sessão; superfícies em 390/768/1440 px sem overflow e sem erros de página.
11. Token adulterado → 401; cookie de sessão vencido → 401; **expiração real** do token (aguardada) → 401.
12. Acessibilidade: axe WCAG 2.x A/AA sem violações sérias/críticas em Care, Clinical (com e sem sessão) e Admin; link "Pular para o conteúdo" pelo teclado.

## Como reproduzir (DEV efêmero; segredos só por variáveis de ambiente)
```bash
nvm use 22 && npm ci --no-audit --no-fund
npm run verify:local && npm run test:lab && npm run test:rules && npm run build && npm run test:api:security && npm run check:design && npm run check:governance
npm run quality:gate            # esperado: BLOQUEADO
# PostgreSQL 17 com banco oncopharma_dev; DATABASE_URL_ADMIN (admin) e APP_DB_PASSWORD via env
NODE_ENV=test bash infra/scripts/bootstrap-ci-db.sh
export DATABASE_URL=postgres://oncopharma_app:<senha>@127.0.0.1:5432/oncopharma_dev
npm run test:db:required
# IdP de TESTE: Keycloak 26 `kc.sh start-dev --http-port=8080` com KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD
export KC_URL=http://localhost:8080 E2E_USER_PASSWORD=<aleatória> E2E_STATE_FILE=/tmp/fora-do-repo.json
npm run test:e2e                # recria o realm, aplica seeds sintéticos, sobe API + 3 apps
npm run validate:evidence       # consolida PASS/FAIL/BLOCKED
```
Observação: os fluxos sintéticos só funcionam com `NODE_ENV≠production` (proteção existente); por isso o E2E usa `next dev` para Care/Clinical e `next start` para Admin.

## Riscos e observações novas (não corrigidos por exigirem decisão ou migração)
- R1 — **RESOLVIDO na consolidação** pela migração 0008 (`nullif`), com teste vermelho→verde.
- R2 — Migrações 0001/0004/0005 não são idempotentes (CREATE sem IF NOT EXISTS): bootstrap exige banco novo (ok no CI efêmero).
- R3 — O formulário Care pede o UUID do paciente; a API bloqueia paciente não vinculado (testado), mas o Plano prevê paciente derivado da identidade. Decisão de UX/produto.
- R4 — Cuidador: modelo de autorização (escopo, prazo, revogação — Plano §3/§4.1-8) não implementado; hoje negado por padrão (testado).
- R5 — `amr` depende do IdP: o Keycloak emitiu `["otp"]` (sem `pwd`). Mapear MFA (amr/acr) no IdP escolhido e repetir a suíte.
- R6 — Sessão = vida do access token (≤30 min), sem refresh; `nonce` e `at_hash` **agora validados** no id_token (consolidação, proposta Codex). Logout no IdP só se `OIDC_END_SESSION_ENDPOINT` for configurado (obrigatório em homologação).
- R7 — Código duplicado: care-web contém componentes de Clinical não usados; `apps/portal` duplica Care+Clinical. Descontinuação segura pendente.
- R8 — CI do GitHub Actions não foi executado (sem repositório remoto); a validação foi local e efêmera. O IdP de teste não está no CI. O CI agora exige os secrets `ONCO_CI_DB_ADMIN_PASSWORD` e `ONCO_CI_DB_APP_PASSWORD`.
- R9 — Mudança visual mínima (cor do rótulo "AMBIENTE PROFISSIONAL" `#a8792d`→`#8b642d`, por WCAG) e links de login/logout no Care: **pedem aprovação do responsável de produto** (reversíveis).

## Go / No-go
- Continuar para ambiente de **homologação técnica** (IdP e hospedagem reais, dados sintéticos): **GO condicionado** às decisões D-008 abaixo e à reexecução da suíte lá.
- **Piloto assistencial: NO-GO.** **Uso clínico: NÃO.** Gate G01–G09 bloqueado; sem aprovação clínica, LGPD/RIPD, avaliação SaMD/Anvisa, instituição-piloto e operação de alertas.

## Decisões necessárias do responsável
1. IdP de homologação (ex.: Keycloak gerenciado, Entra ID, Auth0, gov.br para pacientes?) e política de MFA para profissionais. 2. Hospedagem/região (residência de dados). 3. Repositório remoto para rodar o CI. 4. Aprovar ou reverter R9. 5. Destino de `apps/portal`. 6. Modelo do cuidador e seleção do paciente no Care (R3/R4).
