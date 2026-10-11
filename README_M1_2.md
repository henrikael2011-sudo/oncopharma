# ONCOPHARMA — M1.2: hardening de banco e validação integrada

**Entrega real de código; integração ainda não executada neste ambiente.** Não usar dados de pacientes reais.

## O que mudou
- Role `oncopharma_app` com SELECT limitado e INSERT somente na auditoria; migrações e seeds usam `DATABASE_URL_ADMIN`.
- Scripts para provisionar credenciais de execução e resetar os dois pacientes sintéticos em DEV com confirmação explícita. A auditoria permanece.
- `npm run doctor` valida variáveis e separação de contas sem imprimir segredos.
- `npm run test:db` testa privilégios e isolamento RLS **somente se** houver PostgreSQL e `psql` disponíveis.
- Testes de código M1.2 incluídos no `npm test`.

## Ordem de execução
1. Instale Node.js >=20, PostgreSQL 17 ou Docker e `psql`. `npm install`.
2. Copie `.env.example` para `.env`; defina senhas distintas e OIDC de desenvolvimento.
3. `npm run db:up`. Execute `npm run db:migrate`.
4. `npm run db:provision-app` com `DATABASE_URL_ADMIN` e `APP_DB_PASSWORD`.
5. Ajuste `DATABASE_URL` para o usuário `oncopharma_app` e sua senha.
6. `npm run doctor`; `npm test`; `npm run test:db`; `npm run build`.
7. Configure provedor OIDC real, MFA e vinculação DEV antes de habilitar `ALLOW_SYNTHETIC_API=true`.
8. Opcionalmente `npm run db:seed` com `DEV_OIDC_SUB` de teste.
9. Para remover registros sintéticos, com ambiente DEV e confirmação: `CONFIRM_SYNTHETIC_RESET=APAGAR-TESTES-ONCOPHARMA npm run db:reset-synthetic`.

## Limites e pendências
- Sem Docker, `psql`, OIDC configurado ou rede de instalação de pacotes não é possível declarar teste integrado concluído.
- O reset não remove eventos de auditoria. Não é mecanismo de exclusão LGPD nem de migração para produção.
- Necessário criar papel operacional com migrações controladas, TLS do banco, backups, observabilidade, autenticação real de paciente e políticas de retenção.
- Acesso clínico real segue bloqueado; `patients` retorna apenas pacientes sintéticos vinculados.
- Testar CI e segurança com banco real antes de M2.
