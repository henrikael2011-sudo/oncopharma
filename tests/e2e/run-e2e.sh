#!/usr/bin/env bash
# M14.5 — orquestra E2E local: IdP de teste (realm recriado) -> seeds sintéticos -> Playwright (inicia API + 3 apps).
# Requer no ambiente (nunca no repositório): DATABASE_URL, DATABASE_URL_ADMIN, KC_URL, KC_BOOTSTRAP_ADMIN_USERNAME,
# KC_BOOTSTRAP_ADMIN_PASSWORD, E2E_USER_PASSWORD, E2E_STATE_FILE (fora do repo). Keycloak já em execução em KC_URL.
set -euo pipefail
export NODE_ENV=test
for v in DATABASE_URL DATABASE_URL_ADMIN KC_URL KC_BOOTSTRAP_ADMIN_USERNAME KC_BOOTSTRAP_ADMIN_PASSWORD E2E_USER_PASSWORD E2E_STATE_FILE; do
  [[ -n "${!v:-}" ]] || { echo "BLOQUEADO: $v ausente" >&2; exit 2; }; done
curl -fsS "$KC_URL/realms/master/.well-known/openid-configuration" >/dev/null || { echo "BLOQUEADO: IdP de teste indisponível em $KC_URL" >&2; exit 2; }
node infra/idp-test/setup-keycloak-test.mjs
bash tests/e2e/seed-e2e.sh
export E2E_SESSION_KEY="$(openssl rand -base64 32)"
export INTEGRATION_GATEWAY_TOKEN="$(openssl rand -hex 32)"  # token de serviço efêmero API ↔ integration-gateway
[[ -f services/api/dist/main.js ]] || npm run build -w @oncopharma/api
[[ -d apps/admin-web/.next ]] || npm run build -w @oncopharma/admin-web
unset NODE_ENV
npx playwright test -c tests/e2e/playwright.config.mjs "$@"
