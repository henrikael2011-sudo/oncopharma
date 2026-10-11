# ONCOPHARMA M14.5 — Validação integrada técnica em DEV sintético

**Base imutável:** Plano Diretor v3.0, decisões D-001 a D-008. **Não homologado para uso assistencial.** Somente pacientes e contas sintéticos.
Branch `fix/m14-5` sobre o baseline M14.4 intocado (`ef70dc7`). Detalhes das mudanças: `CHANGELOG_M14_5.md`; arquivos alterados: `ARQUIVOS_ALTERADOS_M14_5.txt`.

## Resultado (`artifacts/validation/validation-report.json`, gerado por `npm run validate:evidence` em 11/10/2026)
| Check | Estado | Evidência |
|---|---|---|
| local-tests (`verify:local`: unit, extended, lab e2e, design, governança, readiness) | PASS | `artifacts/validation/local-tests.log` (79 testes: 59+15+1+4) |
| lab-unit-tests (`test:lab`) | PASS | `lab-unit-tests.log` |
| postgres-required (`test:db:required`, PostgreSQL 17, role `oncopharma_app`) | PASS | `postgres-required.log` — 9/9 (2 originais + 7 negativos M14.5) |
| full-build (`npm run build`: care, clinical, admin, API) | PASS | `full-build.log`; falhas originais em `m14_5/baseline-m14_4-build-*.log` |
| e2e-care-clinical (Playwright + Chrome, 4 serviços) | PASS | `e2e-care-clinical.log`, `m14_5/e2e-results.json`, `m14_5/e2e-evidence.json`, `screens/*.png` — 9/9 |
| oidc-mfa-test-idp (OIDC+PKCE, TOTP, sessão, CSRF, logout, expiração, papéis) | PASS | mesma suíte; **IdP de TESTE local (Keycloak dev)** |
| oidc-mfa (IdP de homologação institucional) | **BLOCKED** | D-008: IdP não escolhido; repetir a suíte no IdP real |
| release-gate (`quality:gate`) | **BLOCKED** (esperado) | G01–G09 sem aprovações formais |
| browser-lab-render | PASS | `lab-browser.png` (laboratório sintético; não substitui o E2E) |

Flags: `readyForIntegratedValidation=false` (oidc-mfa institucional BLOCKED), `readyForClinicalUse=false`, `clinicalApproval=false`.
Verificações avulsas: `check:design` PASS, `check:governance` PASS, `bootstrap-ci-db.sh` PASS (0003 é aplicada por `provision-app-role.sh`: GRANTs + política INSERT de `audit_events` confirmados).

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
10. Token adulterado → 401; cookie de sessão vencido → 401; **expiração real** do token (aguardada) → 401.
11. Acessibilidade: axe WCAG 2.x A/AA sem violações sérias/críticas em Care, Clinical (com e sem sessão) e Admin; link "Pular para o conteúdo" pelo teclado.

## Como reproduzir (DEV efêmero; segredos só por variáveis de ambiente)
```bash
nvm use 22 && npm install --no-audit --no-fund
npm run verify:local && npm run test:lab && npm run build && npm run check:design && npm run check:governance
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
- R1 — Políticas de 0006/0007 usam `current_setting(...)::uuid` sem `nullif`: numa conexão reutilizada, consulta fora de `withTenant` gera erro (fail-closed, porém 500). Propor migração 0008 padronizando com `nullif`.
- R2 — Migrações 0001/0004/0005 não são idempotentes (CREATE sem IF NOT EXISTS): bootstrap exige banco novo (ok no CI efêmero).
- R3 — O formulário Care pede o UUID do paciente; a API bloqueia paciente não vinculado (testado), mas o Plano prevê paciente derivado da identidade. Decisão de UX/produto.
- R4 — Cuidador: modelo de autorização (escopo, prazo, revogação — Plano §3/§4.1-8) não implementado; hoje negado por padrão (testado).
- R5 — `amr` depende do IdP: o Keycloak emitiu `["otp"]` (sem `pwd`). Mapear MFA (amr/acr) no IdP escolhido e repetir a suíte.
- R6 — Sessão = vida do access token (≤30 min), sem refresh; `nonce` gerado mas não validado (não há id_token). Logout no IdP só se `OIDC_END_SESSION_ENDPOINT` for configurado (obrigatório em homologação).
- R7 — Código duplicado: care-web contém componentes de Clinical não usados; `apps/portal` duplica Care+Clinical. Descontinuação segura pendente.
- R8 — CI do GitHub Actions não foi executado (sem repositório remoto); a validação foi local e efêmera. O IdP de teste não está no CI.
- R9 — Mudança visual mínima (cor do rótulo "AMBIENTE PROFISSIONAL" `#a8792d`→`#8b642d`, por WCAG) e links de login/logout no Care: **pedem aprovação do responsável de produto** (reversíveis).

## Go / No-go
- Continuar para ambiente de **homologação técnica** (IdP e hospedagem reais, dados sintéticos): **GO condicionado** às decisões D-008 abaixo e à reexecução da suíte lá.
- **Piloto assistencial: NO-GO.** **Uso clínico: NÃO.** Gate G01–G09 bloqueado; sem aprovação clínica, LGPD/RIPD, avaliação SaMD/Anvisa, instituição-piloto e operação de alertas.

## Decisões necessárias do responsável
1. IdP de homologação (ex.: Keycloak gerenciado, Entra ID, Auth0, gov.br para pacientes?) e política de MFA para profissionais. 2. Hospedagem/região (residência de dados). 3. Repositório remoto para rodar o CI. 4. Aprovar ou reverter R9. 5. Destino de `apps/portal`. 6. Modelo do cuidador e seleção do paciente no Care (R3/R4).
