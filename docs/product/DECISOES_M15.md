# Registro de decisões — M15 (D-009 a D-011)

Aprovadas por Henrikael Walisson em 11/10/2026. **Não alteram D-001 a D-007.** Fecham parte de **D-008** (decisões externas): IdP, hospedagem e repositório. Continuam abertos em D-008: instituição-piloto, SLA de alertas, aprovações G01–G09, identidade de pacientes/cuidadores.

| ID | Decisão | Consequências técnicas | Evidência / documento |
|---|---|---|---|
| **D-009** | Login institucional: **Microsoft Entra ID** se a instituição usa Office 365; caso contrário **Google Workspace**. MFA por **app autenticador nativo** nos dois; **SMS proibido**. | Entra: Acesso Condicional com authentication strength sem SMS + Authentication context `c1` exigido no token (`OIDC_MFA_ACRS`), `OIDC_MFA_AMR=mfa`, identificador `oid`. Google: access token opaco e sem `amr` ⇒ broker OIDC (Keycloak) com TOTP próprio; MFA nunca inferido por domínio. | `docs/integracao/IDP_ENTRA_ID.md`, `docs/integracao/IDP_GOOGLE_WORKSPACE.md`, `services/api/src/auth.guard.ts`, `tests/m15-oidc-providers.mjs` |
| **D-010** | Hospedagem: **AWS sa-east-1 (São Paulo)**; dados no Brasil (LGPD). | Terraform restrito a sa-east-1 (validação de variável); sem replicação entre regiões; ambientes dev/hml/prod separados (contas e workspaces). | `infra/aws/` |
| **D-011** | Repositório GitHub com **proteção da branch main** e **CI em todo push**. | PR obrigatório, checks obrigatórios = jobs do workflow `quality`, sem force push, histórico linear; secrets `ONCO_CI_DB_ADMIN_PASSWORD`/`ONCO_CI_DB_APP_PASSWORD`. | `docs/infra/GITHUB_REPO.md`, `.github/workflows/quality.yml` |

Observação (11/10/2026): o repositório foi criado **público** (`henrikael2011-sudo/oncopharma`) com 0 aprovações obrigatórias — diverge de D-011 ("privado", 1 revisão). Recomenda-se tornar privado e exigir 1 aprovação antes de qualquer dado não sintético.
