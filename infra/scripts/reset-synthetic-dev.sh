#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL_ADMIN:?Informe banco de desenvolvimento}"
[[ "${NODE_ENV:-development}" != production ]] || { echo 'Proibido em produção' >&2; exit 1; }
command -v psql >/dev/null || exit 1
DB_NAME=$(psql "$DATABASE_URL_ADMIN" -Atqc 'SELECT current_database()')
[[ "$DB_NAME" == oncopharma_dev ]] || { echo 'Banco não permitido' >&2; exit 1; }
[[ "${CONFIRM_SYNTHETIC_RESET:-}" == 'APAGAR-TESTES-ONCOPHARMA' ]] || { echo 'Defina CONFIRM_SYNTHETIC_RESET=APAGAR-TESTES-ONCOPHARMA' >&2; exit 1; }
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
ALTER TABLE clinical_observations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_cycles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE oncology_protocols NO FORCE ROW LEVEL SECURITY;
ALTER TABLE care_assignments NO FORCE ROW LEVEL SECURITY;
ALTER TABLE patients NO FORCE ROW LEVEL SECURITY;
DELETE FROM clinical_observations WHERE organization_id='11111111-1111-4111-8111-111111111111';
DELETE FROM treatment_cycles WHERE organization_id='11111111-1111-4111-8111-111111111111';
DELETE FROM oncology_protocols WHERE organization_id='11111111-1111-4111-8111-111111111111';
DELETE FROM care_assignments WHERE organization_id='11111111-1111-4111-8111-111111111111';
DELETE FROM memberships WHERE organization_id='11111111-1111-4111-8111-111111111111';
DELETE FROM patients WHERE organization_id='11111111-1111-4111-8111-111111111111' AND synthetic=true;
-- Auditoria intencionalmente preservada como trilha imutável.
ALTER TABLE clinical_observations FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_cycles FORCE ROW LEVEL SECURITY;
ALTER TABLE oncology_protocols FORCE ROW LEVEL SECURITY;
ALTER TABLE care_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
COMMIT;
SQL
printf 'Pacientes e vínculos de teste excluídos; auditoria preservada.\n'
