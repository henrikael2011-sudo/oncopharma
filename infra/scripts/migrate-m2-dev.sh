#!/usr/bin/env bash
set -euo pipefail
# Fail closed: jamais aplicar migrações/seeds em banco de produção.
[[ "${NODE_ENV:-development}" != "production" ]] || { echo 'PROIBIDO: NODE_ENV=production' >&2; exit 1; }
: "${DATABASE_URL_ADMIN:?DATABASE_URL_ADMIN obrigatório}"
command -v psql >/dev/null || { echo 'psql indisponível' >&2; exit 1; }
[[ "$(psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database()')" == 'oncopharma_dev' ]] || { echo 'BLOQUEADO: banco deve ser oncopharma_dev' >&2; exit 1; }

[[ "${NODE_ENV:-development}" != production ]] || exit 1
: "${DATABASE_URL_ADMIN:?Informe DATABASE_URL_ADMIN}"
[[ "$(psql "$DATABASE_URL_ADMIN" -Atqc 'SELECT current_database()')" == oncopharma_dev ]] || { echo 'Apenas oncopharma_dev' >&2; exit 1; }
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f infra/migrations/0004_oncology_record.sql
