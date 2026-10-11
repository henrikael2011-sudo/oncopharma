# ONCOPHARMA M1.1 — Autenticação web com PKCE (código)

## Entregue
- Fluxo Authorization Code + PKCE S256 e verificação de `state` com validade de 10 minutos.
- Sessão de curta duração em cookie HttpOnly, SameSite=Lax, criptografada AES-256-GCM, sem armazenamento de token no JavaScript do navegador.
- BFF Next.js consulta API NestJS com Bearer no servidor; dados sintéticos continuam bloqueados por padrão.
- Logout local com POST e validação de origem.
- Interface profissional mostra estado de autenticação, MFA e vínculos, quando configurado.

## Limites e riscos pendentes
- **Não testado com um provedor OIDC real**; exige configuração e validação de interoperabilidade.
- O backend NestJS valida assinatura/audience/issuer do token de acesso; o portal não usa o ID token como prova de autenticação. Antes de produção: validação completa do retorno OIDC, política de nonce/ID token, proteção contra login CSRF, revogação/logout no provedor e hardening de sessão.
- Ausência de refresh token é deliberada; login será solicitado após expiração.
- É obrigatório HTTPS, CSP, rate limiting, CSRF completo, rotação de chaves, controle de sessão centralizado, observabilidade e testes end-to-end antes de dados reais.
- Nenhum acesso clínico de produção, prontuário, IA ou integração hospitalar foi liberado.

## Próximo marco M1.2
- Provedor OIDC homologado; testes PostgreSQL e permissões negativas, pipeline CI e validação de sessão/CSRF, segredos gerenciados.
