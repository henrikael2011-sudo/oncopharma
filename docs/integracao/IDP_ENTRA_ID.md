# Guia de cadastro — Microsoft Entra ID (instituição com Office 365) — D-009

> Status: **rascunho para uso futuro**. O app ainda não foi apresentado à instituição; nenhum cadastro deve ser feito agora.
> Somente contas de teste/sintéticas até aprovação G01–G09. MFA por **app autenticador**; **SMS e ligação proibidos**.

## Caminhos usados pelo código (não alterar)
| Item | Valor | Origem no código |
|---|---|---|
| Login | `https://<app>.<env>.<dominio>/api/auth/login` | `apps/*/app/api/auth/login/route.ts` |
| Redirect URI (callback) | `https://<app>.<env>.<dominio>/api/auth/callback` | `apps/*/app/api/auth/callback/route.ts` |
| Pós-logout | `https://<app>.<env>.<dominio>/` | `apps/*/app/api/auth/logout/route.ts` (`post_logout_redirect_uri`) |

`<app>` = `care`, `clinical`, `admin`; `<env>` = `dev`, `hml` (produção sem prefixo). Ex.: `https://clinical.hml.<dominio>/api/auth/callback`.
Fluxo: Authorization Code + **PKCE S256** + `state` + `nonce`; cliente web confidencial (BFF no servidor), segredo enviado como `client_secret_post`. Licença necessária para Acesso Condicional: **Entra ID P1**.

## 1. Registrar a API — "ONCOPHARMA API"
1. Entra admin center → App registrations → New registration → nome `ONCOPHARMA API (<env>)`, contas *somente deste diretório*. Sem redirect URI.
2. Expose an API → Application ID URI `api://<API_CLIENT_ID>` → Add a scope `oncopharma.access` (Admins and users; descrição "Acesso ao ONCOPHARMA").
3. Manifest: `"requestedAccessTokenVersion": 2` (em manifests antigos: `accessTokenAcceptedVersion: 2`). Obrigatório: o código valida o mesmo issuer v2.0 no id_token e no access token.
4. Token configuration → Add optional claim → Access token → `amr` (e também no ID token).
5. App roles (Allowed member types: Users/Groups): `pharmacist`, `nurse`, `physician`, `technical_admin`. O claim `roles` é usado para **conciliação/provisionamento** dos vínculos; a autorização em tempo de execução continua no banco (`memberships`, RLS).

## 2. Registrar os apps — "ONCOPHARMA Care", "ONCOPHARMA Clinical", "ONCOPHARMA Admin"
Para cada app (um registro por app e por ambiente, ex.: `ONCOPHARMA Clinical (hml)`):
1. New registration → plataforma **Web** → Redirect URI `https://<app>.<env>.<dominio>/api/auth/callback`; adicionar também `https://<app>.<env>.<dominio>/` (o Entra exige que o `post_logout_redirect_uri` esteja registrado).
2. Authentication: **não** habilitar implicit/hybrid (sem tokens no front-channel); "Allow public client flows" = **No**.
3. Certificates & secrets → New client secret (validade máx. 6–12 meses; registrar data de expiração).
4. API permissions → Microsoft Graph delegadas `openid`, `profile`, `email`; My APIs → `ONCOPHARMA API` → `oncopharma.access` → **Grant admin consent**.
5. Token configuration → optional claim `amr` no ID token.
6. Enterprise applications → (o app) → Properties → **Assignment required = Yes** (Clinical e Admin); Users and groups → atribuir apenas os grupos autorizados.

> **Care (pacientes/cuidadores):** pacientes normalmente **não** existem no diretório da instituição. Para testes em hml use contas sintéticas internas; a solução de identidade de pacientes (ex.: Entra External ID, gov.br) é decisão pendente.
> **Admin:** o código ainda não tem login no admin-web; registrar agora apenas se for conveniente; ativação depende de M15.x.

## 3. MFA por app autenticador, sem SMS
1. Protection → Authentication methods → Policies:
   - **Microsoft Authenticator**: Enabled (grupo dos profissionais); modo Any (push + phone sign-in); number matching (padrão).
   - **Software OATH tokens** (outros apps autenticadores TOTP): Enabled se a instituição quiser permitir.
   - **SMS**: Disabled. **Voice call**: Disabled. **Email OTP**: Disabled para membros.
   - Concluir a migração das políticas legadas (MFA/SSPR) para *Migration complete*, senão métodos legados (SMS) podem continuar valendo.
2. Authentication strengths → New → `ONCOPHARMA – App autenticador`: marcar Microsoft Authenticator (push), Passwordless (Authenticator), Password + Software OATH token, Windows Hello for Business, Passkeys/FIDO2. **Não** marcar nenhuma combinação com SMS/voz.
3. Conditional Access → Authentication contexts → criar **`c1`** "ONCOPHARMA – MFA app autenticador".
4. Conditional Access → New policy `ONCOPHARMA – exigir app autenticador`: Users = grupo(s) ONCOPHARMA; Target resources = apps ONCOPHARMA Care/Clinical/Admin/API **e** Authentication context `c1`; Grant = **Require authentication strength** `ONCOPHARMA – App autenticador`; Session = sign-in frequency 12 h. Começar em *Report-only*, depois *On*.
5. Política adicional recomendada: bloquear acesso fora do Brasil/locais confiáveis (decisão institucional).

## 4. Grupos → papéis
| Grupo (sugestão) | App role na ONCOPHARMA API | `memberships.role` |
|---|---|---|
| `ONCOPHARMA-Farmaceuticos-<env>` | pharmacist | pharmacist |
| `ONCOPHARMA-Enfermagem-<env>` | nurse | nurse |
| `ONCOPHARMA-Medicos-<env>` | physician | physician |
| `ONCOPHARMA-AdminTecnico-<env>` | technical_admin | technical_admin (sem acesso clínico) |
Atribuir os grupos aos app roles em Enterprise applications → ONCOPHARMA API → Users and groups.

## 5. O que a TI devolve para nós (canal seguro; segredos **nunca** por e-mail/chat)
- Tenant ID; Application (client) ID e Application ID URI da ONCOPHARMA API; nome do escopo.
- Client ID de Care, Clinical e Admin por ambiente.
- Client secrets: gravados pela própria TI no AWS Secrets Manager (`oncopharma/<env>/<app>_oidc_client`) ou por link de uso único; com data de expiração.
- ID do Authentication context (`c1`), nome da authentication strength e print da política CA.
- Object IDs dos grupos e a matriz grupo→papel; contas de teste (sintéticas) com Authenticator registrado.

## 6. Configuração nos nossos apps
| Variável | Valor (Entra) | Onde |
|---|---|---|
| `OIDC_ISSUER` | `https://login.microsoftonline.com/<TENANT_ID>/v2.0` | API e apps |
| `OIDC_AUTHORIZATION_ENDPOINT` | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/authorize` | apps |
| `OIDC_TOKEN_ENDPOINT` | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token` | apps |
| `OIDC_JWKS_URI` | `https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys` | API e apps |
| `OIDC_END_SESSION_ENDPOINT` | `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/logout` | apps |
| `OIDC_AUDIENCE` | `<API_CLIENT_ID>` (GUID; tokens v2) | API e apps |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | por app (segredo via Secrets Manager) | apps |
| `OIDC_SCOPE` | `openid profile email api://<API_CLIENT_ID>/oncopharma.access` | apps |
| `OIDC_SUBJECT_CLAIM` | `oid` (o `sub` do Entra é pareado por aplicação) | API e apps |
| `OIDC_MFA_AMR` | `mfa` (no Entra `otp` significa SMS/e-mail — não aceitar) | API |
| `OIDC_MFA_ACRS` / `OIDC_ACRS_REQUEST` | `c1` / `c1` | API / apps |
| `PORTAL_ORIGIN` | `https://<app>.<env>.<dominio>` | apps |
Vínculos (`memberships`, `care_assignments`, `patient_portal_links`) usam `oidc_issuer` = issuer acima e `oidc_sub` = **oid**.

## 7. Revalidação do R5 (claim de MFA) no Entra
1. Com conta de teste, decodificar o access token **só em ambiente de teste** e conferir: `ver=2.0`, `iss`, `aud=<API_CLIENT_ID>`, `oid`, `amr` contém `mfa`, `acrs` contém `c1`, `roles`. Repetir com alguns segundos entre o MFA e o retorno ao app: o `amr` deve continuar presente (no IdP de teste Keycloak isso falhava com `maxAge=0`; no Entra o `amr` não depende desse ajuste, mas a conferência é a mesma).
2. Negativos: conta só com SMS → login bloqueado pelo CA; token sem `acrs=c1` → API responde 403 "MFA obrigatório" (coberto por `tests/m15-oidc-providers.mjs`); conta fora dos grupos → bloqueada pela atribuição obrigatória.
3. Rodar a suíte `tests/e2e/m145-flow.spec.mjs` adaptada ao IdP real (o cadastro TOTP do teste 05 é substituído pelo Authenticator) e registrar a evidência em `validate:evidence` (check `oidc-mfa`).
