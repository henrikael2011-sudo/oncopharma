# ONCOPHARMA — imagem dos apps Next.js (care-web, clinical-web, admin-web). M15.1.
# Uso: docker build -f infra/docker/web.Dockerfile --build-arg APP=care-web -t oncopharma/care-web:<sha> .
# Não construída localmente nesta entrega (Docker indisponível no ambiente de validação).
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/care-web/package.json apps/care-web/
COPY apps/clinical-web/package.json apps/clinical-web/
COPY apps/admin-web/package.json apps/admin-web/
COPY apps/portal/package.json apps/portal/
COPY services/api/package.json services/api/
COPY packages/clinical-rules/package.json packages/clinical-rules/
RUN npm ci --no-audit --no-fund

FROM deps AS build
ARG APP
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 ONCO_STANDALONE=1
RUN test -n "$APP" && npm run build -w @oncopharma/${APP}

FROM node:22-bookworm-slim AS run
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
WORKDIR /srv
COPY --from=build --chown=1000:1000 /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=1000:1000 /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build --chown=1000:1000 /repo/apps/${APP}/public ./apps/${APP}/public
ENV APP_DIR=apps/${APP}
USER 1000:1000
# PORT, ONCO_ENVIRONMENT, OIDC_* e segredos vêm do ECS (Secrets Manager). Nada sensível na imagem.
CMD ["sh", "-c", "exec node $APP_DIR/server.js"]
