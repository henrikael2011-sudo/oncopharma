# Repositório GitHub — configuração (D-011)

## Proteção da branch `main` (Settings → Branches → Branch protection rule, ou Rulesets)
- Require a pull request before merging: **On**; Required approvals: **1**; Dismiss stale approvals on new commits: On; Require approval of the most recent push: On.
- Require status checks to pass: **On**; Require branches to be up to date: On. Checks obrigatórios (jobs de `.github/workflows/quality.yml`): **`unit-and-structure`** (testes, design, governança, build, segurança da API, regras clínicas, readiness, lab e2e) e **`integration`** (bootstrap PostgreSQL 17 + `test:db:required`). Os checks aparecem para seleção após a primeira execução (ex.: "quality / unit-and-structure").
- Require linear history: **On**. Allow force pushes: **Off**. Allow deletions: **Off**. Do not allow bypassing (inclui administradores): On.
- Require conversation resolution: On. (Opcional) Require signed commits.
- Visibilidade: **Private** (D-011). Settings → Code security: secret scanning + push protection, Dependabot alerts.

## CI em todo push
`quality.yml` dispara em `push` e `pull_request`. O job PostgreSQL usa banco efêmero do runner.

## Secrets do CI (Settings → Secrets and variables → Actions)
| Secret | Uso | Regra |
|---|---|---|
| `ONCO_CI_DB_ADMIN_PASSWORD` | senha do superusuário do Postgres efêmero do runner | aleatória, ≥ 32 caracteres, segura para URL (`openssl rand -hex 24`) |
| `ONCO_CI_DB_APP_PASSWORD` | senha da role restrita `oncopharma_app` | diferente da anterior; mesma regra |
São de banco descartável do CI, nunca reutilizar em dev/hml/prod. Sem eles o serviço Postgres do CI não sobe e o job falha (fail-closed). Em PRs de forks, secrets não são expostos — manter o repositório privado.
