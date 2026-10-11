#!/usr/bin/env bash
set -euo pipefail
# Fail closed: jamais aplicar migrações/seeds em banco de produção.
[[ "${NODE_ENV:-development}" != "production" ]] || { echo 'PROIBIDO: NODE_ENV=production' >&2; exit 1; }
: "${DATABASE_URL_ADMIN:?DATABASE_URL_ADMIN obrigatório}"
command -v psql >/dev/null || { echo 'psql indisponível' >&2; exit 1; }
[[ "$(psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database()')" == 'oncopharma_dev' ]] || { echo 'BLOQUEADO: banco deve ser oncopharma_dev' >&2; exit 1; }

if [[ "${NODE_ENV:-development}" == "production" ]]; then echo 'Seeds proibados em produção' >&2; exit 1; fi
: "${DATABASE_URL_ADMIN:?Informe DATABASE_URL_ADMIN do ambiente de desenvolvimento}"
: "${OIDC_ISSUER:?Informe o issuer OIDC de desenvolvimento}"
: "${DEV_OIDC_SUB:?Informe o sub real de uma conta de teste no provedor OIDC}"
command -v psql >/dev/null || { echo 'psql necessário'; exit 1; }
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -v oidc_issuer="$OIDC_ISSUER" -v oidc_sub="$DEV_OIDC_SUB" -f infra/seeds/seed_two_synthetic_patients.sql

psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f infra/seeds/seed_m2_synthetic.sql
