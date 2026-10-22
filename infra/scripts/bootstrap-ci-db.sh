#!/usr/bin/env bash
set -euo pipefail
[[ "${NODE_ENV:-}" == "test" ]] || { echo 'CI bootstrap apenas em NODE_ENV=test' >&2; exit 2; }
: "${DATABASE_URL_ADMIN:?URL administrativa obrigatória}"
: "${APP_DB_PASSWORD:?Senha de role runtime obrigatória}"
command -v psql >/dev/null || { echo 'psql ausente' >&2; exit 2; }
[[ "$(psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database()')" == 'oncopharma_dev' ]] || { echo 'Banco incorreto' >&2; exit 2; }
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f infra/migrations/0001_foundation.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f infra/migrations/0002_identity_and_audit.sql
bash infra/scripts/provision-app-role.sh
for migration in 0004_oncology_record.sql 0005_structured_record.sql 0006_clinical_workflow.sql 0007_m10_patient_links.sql 0008_tenant_setting_nullif.sql 0009_care_patient.sql 0010_caregiver.sql 0011_clinical_worklist.sql 0012_patient_allocation.sql 0013_pdf_import.sql 0014_medical_requests.sql 0016_care_temperature.sql 0017_medication_transcription.sql 0018_med_transcription_source.sql; do
  psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f "infra/migrations/$migration"
done
# Não utilizar seed nem identidades reais em CI. RLS testada com tenant sem dados.
echo 'Migrações e role de execução preparadas em banco efêmero de CI.'
