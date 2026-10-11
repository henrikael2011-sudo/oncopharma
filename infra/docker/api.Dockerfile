# ONCOPHARMA — imagem da API NestJS. M15.1. Não construída localmente (Docker indisponível).
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/care-web/package.json apps/care-web/
COPY apps/clinical-web/package.json apps/clinical-web/
COPY apps/admin-web/package.json apps/admin-web/
COPY apps/portal/package.json apps/portal/
COPY services/api/package.json services/api/
COPY packages/clinical-rules/package.json packages/clinical-rules/
RUN npm ci --no-audit --no-fund
COPY services/api services/api
RUN npm run build -w @oncopharma/api && npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production
WORKDIR /srv
COPY --from=build --chown=1000:1000 /repo/node_modules ./node_modules
COPY --from=build --chown=1000:1000 /repo/services/api/dist ./dist
COPY --from=build --chown=1000:1000 /repo/services/api/package.json ./package.json
USER 1000:1000
CMD ["node", "dist/main.js"]
