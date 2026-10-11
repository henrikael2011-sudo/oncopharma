#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL_ADMIN:?Configure DATABASE_URL_ADMIN de desenvolvimento}"
: "${APP_DB_PASSWORD:?Configure APP_DB_PASSWORD forte}"
if [[ "${NODE_ENV:-development}" == production ]]; then echo 'Proibido em produção' >&2; exit 1; fi
command -v psql >/dev/null || { echo 'psql não encontrado' >&2; exit 1; }
DB_NAME=$(psql "$DATABASE_URL_ADMIN" -Atqc 'SELECT current_database()')
[[ "$DB_NAME" == oncopharma_dev ]] || { echo 'Banco não é oncopharma_dev' >&2; exit 1; }
# Password via variável psql, sem concatenar SQL.
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" <<'SQL'
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='oncopharma_app')
  THEN 'CREATE ROLE oncopharma_app LOGIN NOINHERIT NOBYPASSRLS'
  ELSE 'ALTER ROLE oncopharma_app LOGIN NOINHERIT NOBYPASSRLS' END \gexec
ALTER ROLE oncopharma_app PASSWORD :'app_password';
SQL
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f infra/migrations/0003_runtime_permissions.sql
printf 'Role de execução configurada. Use DATABASE_URL com usuário oncopharma_app na API.\n'
