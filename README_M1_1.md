# ONCOPHARMA M1.1

Evolução incremental de M1, preservando M0, Care e Clinical.

## Novidades
- Login OIDC Authorization Code + PKCE via Next.js Route Handlers.
- Sessão criptografada em cookie HttpOnly e BFF para API clínica.
- Página Clinical mostra estado da autenticação, MFA e pacientes sintéticos se liberados.

## Configurar
1. `npm install`
2. Copiar `.env.example` para `.env`; configurar `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URI`, `OIDC_AUTHORIZATION_ENDPOINT`, `OIDC_TOKEN_ENDPOINT`, `OIDC_CLIENT_ID`, `SESSION_ENCRYPTION_KEY`, `PORTAL_ORIGIN`, banco e credenciais de desenvolvimento.
3. Registrar redirect URI `http://localhost:3000/api/auth/callback` no provedor OIDC. Client público com PKCE obrigatório, sem client secret.
4. `npm run db:up && npm run db:migrate`; configurar vínculo de teste e opcionalmente `npm run db:seed`.
5. `npm run dev:api` e `npm run dev:portal`; acessar `/clinical`.
6. `npm test`; `npm run build` após instalar dependências.

**Atenção:** código preparado, não homologado, não executar com pacientes reais. Não versionar `.env` ou credenciais.
