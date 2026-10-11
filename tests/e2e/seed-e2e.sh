#!/usr/bin/env bash
# M14.5 — seeds sintéticos + vínculos das contas do IdP de teste. Fail-closed fora de oncopharma_dev.
set -euo pipefail
[[ "${NODE_ENV:-}" == "test" ]] || { echo 'Seed E2E apenas em NODE_ENV=test' >&2; exit 2; }
: "${DATABASE_URL_ADMIN:?}"; : "${E2E_STATE_FILE:?}"
j(){ node -e "const s=require(process.argv[1]);console.log(process.argv[2]==='iss'?s.issuer:s.users[process.argv[2]].sub)" "$E2E_STATE_FILE" "$1"; }
export OIDC_ISSUER="$(j iss)" DEV_OIDC_SUB="$(j farmaceutico)"
bash infra/scripts/seed-dev.sh
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -q -f infra/seeds/seed_m2_1_synthetic.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -q -f infra/seeds/seed_m15_2_care.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -q -v iss="$OIDC_ISSUER" -v sub_nurse="$(j enfermeira)" -v sub_physician="$(j medico)" -v sub_admin="$(j admin.tecnico)" \
  -v sub_pharm_nomfa="$(j farmaceutico.semmfa)" -v sub_patient_a="$(j paciente.a)" -v sub_patient_b="$(j paciente.b)" -v sub_caregiver="$(j cuidador.a)" -f tests/e2e/seed-e2e-identities.sql
echo 'Seeds sintéticos E2E aplicados.'
