# ONCOPHARMA M14.5 - validação técnica reproduzível

Referência: Plano Diretor v3 (D-001 a D-008) e dossiê M14.4. Produto em desenvolvimento. **Sem homologação clínica; sem dados reais.**

## Resultado e decisão

**NO-GO para piloto integrado ou uso assistencial.** GO apenas para continuar desenvolvimento sintético isolado. PostgreSQL 17 não iniciou neste container; RLS integrado, vínculos e RBAC/ABAC da aplicação e o fluxo persistido Care -> Clinical -> auditoria continuam BLOCKED. O IdP local de teste não é uma escolha aprovada de provedor institucional (D-008).

Validação: 2026-10-11T18:59:32.152Z até 2026-10-11T19:02:57.997Z. Checks: 13 PASS, 0 FAIL, 5 BLOCKED. Os checks têm escopos diferentes e não equivalem a uma contagem de casos independentes.

| Check | Resultado | Exit |
|---|---|---|
| node22 | PASS | - |
| lockfile | PASS | - |
| local-tests | PASS | 0 |
| lab-unit-tests | PASS | 0 |
| clinical-rules | PASS | 0 |
| full-build | PASS | 0 |
| api-security-unit | PASS | 0 |
| design | PASS | 0 |
| governance | PASS | 0 |
| release-gate-enforced | PASS | 1 |
| clinical-release | BLOCKED | - |
| postgres-required | BLOCKED | - |
| migration-0003 | BLOCKED | - |
| browser-surfaces | PASS | - |
| oidc-core | PASS | - |
| oidc-mfa | BLOCKED | - |
| vertical-care-clinical-audit | BLOCKED | - |
| source-stability | PASS | - |

`readyForClinicalUse=false`, `clinicalApproval=false`, `readyForIntegratedValidation=false`.

## Alterações localizadas

- Node 22; lockfile versionado; CI com `npm ci`; segredos do banco CI fornecidos por variáveis/secrets.
- Compilação: `use client` antes dos imports e `rule_version` no tipo de alerta; mesmas correções no portal de compatibilidade.
- Contraste do pequeno rótulo Clinical corrigido usando **navy #0A344A já aprovado**. Tokens, símbolos e navegação preservados; referência canônica atualizada em conjunto.
- Consulta de atribuições profissionais executada com contexto de tenant. API e pré-requisito DB recusam superusuário, BYPASSRLS e role diferente de `oncopharma_app`. Testes unitários não substituem prova RLS no banco.
- Callback OIDC valida ID token e access token com JWKS, assinatura, issuer, audience, expiração, nonce e at_hash quando presente. Destino de retorno configurável e restrito a um caminho local. Admin recebe apenas a infraestrutura de sessão; nenhuma operação administrativa foi habilitada.
- Healthchecks, Playwright/axe, IdP Keycloak efêmero com seis contas sintéticas e TOTP obrigatório, sem sessão ou token simulado.
- Evidências v2 com digest de fontes e PASS/FAIL/BLOCKED separados. Gate clínico continua fechado.

## Reprodução

Pré-requisitos: Node 22; npm com rede; PostgreSQL 17 efêmero executado por usuário não-root; `psql`; Chromium Playwright; Java 17 compatível com Keycloak 26.0.8 de teste. O ambiente de teste Keycloak usa H2 **em memória**, exclusivamente para identidade; não substitui PostgreSQL da aplicação.

```bash
npm ci --no-audit --no-fund
npm run build
npm run verify:local
npm run test:rules
npm run test:api:security
npm run check:design
npm run check:governance
npm run quality:gate  # exit 1 esperado enquanto G01-G09 estiverem bloqueados
```

Os pacotes JS existentes são validados por `node --check` e testes. O design-system canônico é conferido contra as cópias compiladas nos apps. Os serviços FHIR/IA em JS são cobertos por `test:extended`; não existe build de um serviço executável independente nesses diretórios.

### PostgreSQL

Fornecer `DATABASE_URL_ADMIN`, `APP_DB_PASSWORD` e `DATABASE_URL` da role restrita apenas em ambiente seguro. Nenhum segredo deve ser escrito no projeto.

```bash
NODE_ENV=test bash infra/scripts/bootstrap-ci-db.sh
NODE_ENV=test npm run test:db:required
```

0003_runtime_permissions.sql é chamada por `provision-app-role.sh`, entre 0002 e 0004. A chamada foi confirmada no código; **a execução no banco não foi comprovada aqui**. Bootstrap neste ambiente: exit 2, conexão recusada. PostgreSQL 17.10 está disponível como binário, mas `initdb` recusa root. O container mapeia apenas UID 0; `runuser` e remapeamento por `unshare` são proibidos; Docker está ausente. Cliente psql 16.15 foi obtido e executado, sem servidor disponível.

Testes negativos preparados em `tests/m145-db.integration.mjs`: dados de dois tenants preenchidos, leitura cruzada, INSERT auditoria permitido no tenant e negado fora, elevação de role, recusa da conta administrativa e restauração do contexto transacional. **Não executados**. Superusuário PostgreSQL consegue contornar RLS por definição; a defesa é impedir seu uso pela API e pelos testes runtime, sem alegar que FORCE RLS bloqueia superusuário.

### Navegador e identidade

```bash
npx playwright install chromium
# KEYCLOAK_HOME deve apontar para uma distribuição local de teste.
# Opcional: ONCO_BROWSER_EXECUTABLE para um Chromium já instalado.
npm run test:identity:real
npm run validate:evidence
```

`run-identity-validation.mjs` gera senhas, segredos TOTP e chave de sessão em memória, passa-os por variáveis aos processos de teste e provisiona o realm pela API administrativa. Não salva credenciais em arquivo. MFA usa o fluxo real de senha + OTP REQUIRED e o AMR de execuções concluídas; grant direto dos clientes da aplicação é desabilitado; PKCE S256 obrigatório.

As superfícies são verificadas em 390, 768 e 1440 px, incluindo teclado, contraste via axe, overflow, estado sem sessão e erro de envio. Testes automatizados sem violações não certificam toda a WCAG 2.2 AA; leitores de tela, zoom 200%, orientações clínicas e testes de usabilidade completos continuam pendentes.

OIDC core: seis contas, OTP incorreto recusado, OTP real aceito, assinatura/JWKS/issuer/audience/AMR/papel no token, cookie HttpOnly/SameSite Lax, token indisponível em document.cookie, JWT ausente/adulterado recusado, state inválido, CSRF de logout e intervenção, verifier PKCE incorreto, logout **local da aplicação** e expiração efetiva da sessão. `Secure` é obrigatório em produção; testes locais usam HTTP/localhost em desenvolvimento. Logout global SSO/revogação no IdP não foi implementado nem comprovado.

A API aceita o JWT legítimo e chega ao limite de banco, retornando 503. Isso **não prova autorização institucional por papel**. O Admin permanece uma estrutura sem operações; validar identidade não libera ações administrativas.

O fluxo vertical real e o patientId de outro paciente estão preparados em `tests/e2e-real/vertical.spec.ts`, selecionado somente quando as duas URLs DB são fornecidas e os pré-requisitos passam. Sem PostgreSQL, o runner não inventa dados, não contorna login e marca o fluxo integrado BLOCKED.

No container utilizado, chamadas separadas de execução possuem namespaces de rede distintos. O runner inicia servidores, IdP e testes no mesmo processo de orquestração. O download padrão Chromium do Playwright veio inválido; a rodada final usou Chromium 153.0.8010.0 com flags de execução para root, **sem desativar a segurança web ou a proteção de origem**. Esse navegador alternativo é um recurso do ambiente; não foi incluído no produto.

### CI

Configurar os secrets `ONCO_CI_DB_ADMIN_PASSWORD` e `ONCO_CI_DB_APP_PASSWORD` com valores diferentes e seguros para uso em URL. O serviço efêmero usa Postgres 17. O CI foi atualizado, mas **não foi executado em GitHub Actions nesta entrega**. O pipeline atual não provisiona automaticamente Keycloak e navegador no runner; isso deve ser configurado antes de declarar E2E no CI.

## Evidências e histórico

- `artifacts/validation/validation-report.json`: resultado final e digest de fontes.
- `artifacts/validation/*.log`: rodada final; `artifacts/m14.5/logs/`: tentativas, erros e correções, incluindo instalação e bootstrap.
- `artifacts/m14.5/playwright-results.json`, `axe-*.json`, `healthchecks.json` e `screenshots/`: evidências reais.
- `CHANGELOG_M14_5.md`, `ARQUIVOS_ALTERADOS_M14_5.md`, `docs/product/MATRIZ_RASTREABILIDADE.md` e diff contra M14.4.
- PDF acumulado preserva as 37 páginas históricas e acrescenta esta revisão, sem reescrever o histórico.

SHA-256 do ZIP de baseline M14.4: `e8c492bbe9f2101a8cf56acc6d801ce790f25642a3dabee09f4f11432a49396d`. Digest final das fontes validadas: `4ad867aebc22a4bfb3de8771ea1cfbb70034fbfb786697ade1559661eab4dc4a`.

## Riscos e limites

1. PostgreSQL/RLS, INSERT audit_events no banco e isolamento do fluxo real não validados neste ambiente; testes preparados aguardam execução.
2. RBAC/ABAC, vínculo Care e permissões por instituição dependem do banco. Não converter login/TOTP em prova de autorização.
3. Correções de tenant/role têm evidência unitária e compilação; comportamento SQL ainda exige validação integrada.
4. Sem logout global/revogação OIDC comprovados, sem login administrativo operacional, sem configuração IdP institucional aprovada.
5. Migrações de fundação não foram comprovadas como idempotentes, rollback/restauração não realizados, concorrência e desempenho não homologados.
6. PWA/offline, leitores de tela, zoom, governança institucional, LGPD/SaMD, responsáveis/SLA de alertas e validação clínica continuam pendentes.
7. Fonte de clínica/IA não recebeu aprovação nova; nenhuma prescrição, mudança de dose, liberação de ciclo ou orientação automática habilitada.

**A entrega é uma evolução técnica parcial com evidências; não é um piloto integrado aprovado.**

Referência do IdP: https://www.keycloak.org/docs/26.0.8/server_admin/index.html (fluxos REQUIRED, OTP e AMR). Essa versão foi usada somente em teste efêmero e não recomenda um IdP ou versão de produção.
