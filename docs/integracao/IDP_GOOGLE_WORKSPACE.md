# Guia de cadastro — Google Workspace (instituição sem Office 365) — D-009

> Status: **rascunho para uso futuro**; nenhum cadastro agora. Somente contas de teste/sintéticas. MFA por **app autenticador**; **SMS e ligação proibidos**.

## Limitações honestas do Google para a nossa arquitetura
1. **Access tokens do Google são opacos** (não são JWT): a nossa API valida JWT por JWKS e não consegue validá-los.
2. **O ID token do Google normalmente não traz `amr`/`acr`**: não há prova por token de que houve 2SV, nem de qual método foi usado. Não inferimos MFA por domínio (`hd`) ou e-mail — o código falha fechado (`tests/m15-oidc-providers.mjs`).
3. **Sem logout iniciado pelo app** (o discovery do Google não publica `end_session_endpoint`).
4. **Grupos não vêm no ID token** (exigem Admin SDK/Cloud Identity).

**Mitigação proposta (mais conservadora):** um **broker OIDC** (Keycloak — o mesmo IdP de teste já validado no E2E) hospedado na AWS sa-east-1 (`https://login.<env>.<dominio>`). O Google autentica a pessoa (2SV imposto pelo Workspace, sem SMS); o broker restringe ao domínio institucional, exige o **TOTP próprio por app autenticador** e emite os tokens JWT para os apps, com `amr=["otp"]` assinado. Custo: o profissional usa dois segundos fatores (Google + broker). Alternativa sem o fator do broker = aceitar MFA "por política" sem prova por token — **não implementada**; exigiria aceite formal de risco.

## 1. Cliente OAuth no Google (um por ambiente) — "ONCOPHARMA Login (broker) – <env>"
1. Google Cloud console, projeto da organização da instituição → APIs & Services → OAuth consent screen → User type **Internal**; nome "ONCOPHARMA"; escopos `openid`, `email`, `profile`.
2. Credentials → Create OAuth client ID → **Web application** → nome `ONCOPHARMA Login (broker) – <env>`.
3. Authorized redirect URI: `https://login.<env>.<dominio>/realms/oncopharma/broker/google/endpoint`.
4. Guardar Client ID e Client secret (canal seguro; ver §5).

## 2. Os três apps (registrados por nós no broker, não no Google)
| Cliente no broker | Redirect URI | Pós-logout |
|---|---|---|
| ONCOPHARMA Care (`oncopharma-care-web`) | `https://care.<env>.<dominio>/api/auth/callback` | `https://care.<env>.<dominio>/` |
| ONCOPHARMA Clinical (`oncopharma-clinical-web`) | `https://clinical.<env>.<dominio>/api/auth/callback` | `https://clinical.<env>.<dominio>/` |
| ONCOPHARMA Admin (`oncopharma-admin-web`) | `https://admin.<env>.<dominio>/api/auth/callback` | `https://admin.<env>.<dominio>/` |
Caminhos conforme `apps/*/app/api/auth/{login,callback,logout}/route.ts`. Clientes confidenciais com PKCE S256 obrigatório, sem implicit/direct grant; audience `oncopharma-api`; mapeamento de `amr`. Mesma configuração validada em `infra/idp-test/setup-keycloak-test.mjs`. IdP Google no broker com **hosted domain** = domínio da instituição. **Referências AMR do broker:** em cada execução do fluxo (formulário de senha → `pwd`, formulário OTP → `otp`) configurar `default.reference.maxAge` **≥ tempo de sessão ociosa** (ex.: `900` s). Com `0` o Keycloak omite a referência quando a troca do código ocorre ≥1 s após o OTP (`auth_time + maxAge < agora`) e o `amr` sai vazio — MFA aparece como "não confirmado" de forma intermitente (corrigido no IdP de teste no M15.4). Care: pacientes normalmente não têm conta Workspace — identidade de pacientes é decisão pendente. Admin: sem login no código ainda.

## 3. 2-Step Verification sem SMS (Admin console)
1. Security → Authentication → **2-step verification** → OU/grupo dos profissionais:
   - Allow users to turn on 2SV: **On**; **Enforcement: On** (data definida); período de inscrição para novos usuários (ex.: 1 semana).
   - **Methods: "Any except verification codes via text, phone call"** (permite Google Authenticator/app TOTP, prompt do Google e chaves de segurança). Opção mais forte: "Only security key".
   - Frequency: não permitir "trust this device" para o grupo clínico (se a política institucional permitir).
2. Opcional: Advanced Protection Program para administradores.
3. Restringir o app: Security → API controls → App access control → tornar o cliente ONCOPHARMA **Trusted** e bloquear apps não configurados para o grupo, se aplicável.

## 4. Grupos → papéis
Grupos `oncopharma-farmaceuticos-<env>@`, `-enfermagem-`, `-medicos-`, `-admintecnico-` (papéis `pharmacist`, `nurse`, `physician`, `technical_admin`). Como o ID token não traz grupos, a TI envia a lista de membros por canal seguro (ou autoriza leitura via Cloud Identity Groups API em fase futura); os vínculos são cadastrados em `memberships` (autorização continua no banco + RLS).

## 5. O que a TI devolve para nós
- Domínio principal do Workspace (para restrição `hd`) e OU/grupo dos profissionais.
- Client ID e Client secret do cliente OAuth do broker (gravados pela TI no AWS Secrets Manager ou link de uso único; nunca e-mail/chat).
- Print da configuração de 2SV (enforcement + métodos sem SMS/ligação).
- E-mails dos grupos e matriz grupo→papel; contas de teste com 2SV ativo.
- Não há end-session endpoint do Google; o logout do app encerra a sessão do broker (`OIDC_END_SESSION_ENDPOINT` do broker).

## 6. Configuração nos nossos apps (apontam para o broker)
| Variável | Valor |
|---|---|
| `OIDC_ISSUER` | `https://login.<env>.<dominio>/realms/oncopharma` |
| `OIDC_AUTHORIZATION_ENDPOINT` / `OIDC_TOKEN_ENDPOINT` / `OIDC_JWKS_URI` / `OIDC_END_SESSION_ENDPOINT` | `<issuer>/protocol/openid-connect/{auth,token,certs,logout}` |
| `OIDC_AUDIENCE` | `oncopharma-api` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | por app (segredo no Secrets Manager) |
| `OIDC_SCOPE` | `openid profile email` |
| `OIDC_SUBJECT_CLAIM` | `sub` (estável no broker) |
| `OIDC_MFA_AMR` | `otp` |

## 7. Revalidação do R5 no Google
1. Conferir que o ID token do Google (no broker) **não** traz `amr` — registrar como limitação, não como falha nossa.
2. Conferir no token do broker: `iss`, `aud=oncopharma-api`, `amr` contém `otp`, `sub` estável — **inclusive quando a troca do código acontece alguns segundos após o OTP** (repetir o login aguardando ≥2 s antes do callback; regressão coberta pelo E2E 05b).
3. Negativos: conta fora do domínio → recusada no broker; conta sem TOTP do broker → sem MFA → API 403; conta com 2SV desligado → bloqueada pelo enforcement do Workspace.
4. Rodar a suíte E2E contra o broker de hml e registrar em `validate:evidence`.
