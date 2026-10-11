# M1 — Status real e próximo corte

| Componente | Status | Evidência/limite |
|---|---|---|
| NestJS com PostgreSQL via pool | Implementado em código | Exige banco real e teste de integração |
| OIDC Bearer JWT (JWKS) | Implementado em código | Exige configuração de IdP, MFA e teste de integração |
| Controle de acesso por instituição | Implementado em código | Memberships + MFA + vínculo assistencial |
| PostgreSQL RLS | Definido em SQL | FORCE RLS; exige execução/testes em PostgreSQL |
| Auditoria de consulta | Implementado em código | Transacional; política de retenção e trilha externa pendentes |
| Dois pacientes sintéticos | Seed disponível | NÃO inseridos até executar explicitamente seed-dev.sh |
| Login de navegador / sessões | Pendente | Authorization Code + PKCE / BFF a implementar |
| CI/CD e homologação clínica | Pendente | Não habilitar pacientes reais |

**Validação desta entrega:** 9 verificações automatizadas estáticas passaram; dependências não estavam em cache para instalar, então não foi possível executar build, PostgreSQL nem testes de integração neste ambiente.

## Critérios para concluir M1 integralmente
- Login OIDC no portal com PKCE, MFA e expiração/revogação verificadas.
- Testes de integração reais com PostgreSQL e JWT de IdP de teste.
- CI com lint, testes, build, varredura de dependências e migrações.
- RLS, auditoria e negação entre instituições validados por testes negativos.
- Infraestrutura e segredos separados em DEV/HML/PROD.

**Proibição:** usar este pacote em assistência clínica ou com dados pessoais reais.
