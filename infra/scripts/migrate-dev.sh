#!/usr/bin/env bash
set -euo pipefail
# Fail closed: jamais aplicar migrações/seeds em banco de produção.
[[ "${NODE_ENV:-development}" != "production" ]] || { echo 'PROIBIDO: NODE_ENV=production' >&2; exit 1; }
: "${DATABASE_URL_ADMIN:?DATABASE_URL_ADMIN obrigatório}"
command -v psql >/dev/null || { echo 'psql indisponível' >&2; exit 1; }
[[ "$(psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database()')" == 'oncopharma_dev' ]] || { echo 'BLOQUEADO: banco deve ser oncopharma_dev' >&2; exit 1; }

if [[ "${NODE_ENV:-development}" == "production" ]]; then echo 'Bloqueado em produção' >&2; exit 1; fi
: "${DATABASE_URL_ADMIN:?Configure DATABASE_URL_ADMIN com o banco DEV}"
command -v psql >/dev/null || { echo 'psql necessário'; exit 1; }
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f infra/migrations/0001_foundation.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f infra/migrations/0002_identity_and_audit.sql
printf 'Migrações M1 executadas no banco informado.
'
