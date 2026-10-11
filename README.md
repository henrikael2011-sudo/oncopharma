# ONCOPHARMA — Fundação M1.1

Veja [README_M1_1.md](README_M1_1.md), [STATUS-M1.1](docs/product/STATUS-M1.1.md) e o histórico de M1 abaixo.

# ONCOPHARMA — Fundação M1 (evolução do M0)

Produto profissional em construção. Identidade e páginas Care/Clinical preservadas do M0. **Ainda não apto a receber dados reais ou orientar assistência.**

## O que foi acrescentado
- PostgreSQL via `pg`, serviço NestJS e `/v1/ready`.
- Middleware OIDC JWT: valida assinatura via JWKS, `iss`, `aud`, expiração e `sub`.
- Rotas protegidas `GET /v1/me` e `GET /v1/patients`.
- Regra para `/patients`: `ALLOW_SYNTHETIC_API=true`, `NODE_ENV != production`, MFA, vínculo institucional e atribuição ativa do paciente; retorna **somente pacientes sintéticos**.
- Migração SQL com memberships, care_assignments, audit_events, RLS e trilha append-only.
- Seed idempotente de **dois pacientes sintéticos**, não executado automaticamente.

## Requisitos
Node >=20, npm, PostgreSQL 17, `psql`, e provedor OIDC compatível com JWT de acesso e JWKS. Docker opcional; não incluído neste ambiente de entrega.

## Instalação
```bash
npm install
cp .env.example .env
# Configure banco, OIDC_ISSUER, OIDC_AUDIENCE e OIDC_JWKS_URI com valores reais de DESENVOLVIMENTO.
# Exportar variáveis: set -a; source .env; set +a
npm run db:up             # requer Docker, opcional se PostgreSQL já estiver ativo
npm run db:migrate        # requer psql e DATABASE_URL
# Opcional: defina DEV_OIDC_SUB com sub de usuário de teste com MFA, depois:
npm run db:seed
npm run dev:api
npm run dev:portal
```
`GET /v1/health` é liveness, `GET /v1/ready` é prontidão do banco. `GET /v1/me` exige Bearer JWT. `GET /v1/patients` exige também header `x-organization-id` do laboratório (`11111111-1111-4111-8111-111111111111`) e habilitação explícita.

**Não colar tokens ou senhas em chats, prints, arquivos versionados ou exemplos.**

## Testes
```bash
npm test
npm run test:m1
npm run build
```
Testes `node --test` são verificações estáticas de segurança, **não** substituem testes de integração ou auditoria. O build depende da instalação de pacotes. Neste ambiente de geração, a instalação offline não pôde ser concluída (pacotes ausentes no cache), portanto build e testes de integração não foram executados. Não há login visual completo nem integração hospitalar.

## Arquitetura
- `apps/portal`: identidade visual e duas experiências (M0)
- `services/api`: validação JWT, PostgreSQL, guards, endpoints restritos (M1)
- `infra/migrations`: SQL; `infra/seeds`: dois pacientes sintéticos
- `docs/product/STATUS-M1.md`: limites e próximos critérios
- `docs/architecture/ADR-003-m1-identidade-persistencia.md`: decisões e riscos

## Próximo marco
M1.1: integrar login OIDC Authorization Code + PKCE no portal; testes reais do PostgreSQL, autorização negativa, CI/CD e controle de segredos.


## M1.2
Veja [README_M1_2.md](README_M1_2.md) para segregação de roles, doctor, testes DB e reset sintético.
