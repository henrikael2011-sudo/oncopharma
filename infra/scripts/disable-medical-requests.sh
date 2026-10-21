#!/usr/bin/env bash
set -euo pipefail
[[ "${NODE_ENV:-}" == "test" ]] || { echo 'Desativação somente em NODE_ENV=test' >&2; exit 2; }
: "${DATABASE_URL_ADMIN:?URL administrativa obrigatória}"
command -v psql >/dev/null || { echo 'psql ausente' >&2; exit 2; }
psql -X "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback/0014_disable_medical_requests.sql
echo 'M15.5 desativada para o app; dados e histórico preservados.'
