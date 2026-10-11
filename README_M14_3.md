# ONCOPHARMA M14.3 — Correção de bloqueadores verificáveis

**Base obrigatória:** Plano Diretor v3.0 (D-001 a D-008). Care/Clinical e identidade visual não foram alterados.

## Corrigido no código
- Pipeline de CI utilizava `oncopharma_ci`, incompatível com o bloqueio `oncopharma_dev` das migrações. Corrigido para banco efêmero `oncopharma_dev`.
- Pipeline não criava a role `oncopharma_app`, não executava as migrações e testava permissões com a conta administrativa. Agora prepara migrações/role e testa com credenciais de execução restrita.
- Faltava política de INSERT RLS na tabela `audit_events`, embora a API precisasse inserir eventos. Política por instituição adicionada.
- Pré-requisito do teste de PostgreSQL agora recusa contas diferentes de `oncopharma_app`.
- Adicionados testes automatizados estáticos de regressão dessas correções.

## Pendências que NÃO podem ser declaradas resolvidas
- Build Next/Nest não executado neste ambiente: dependências npm não disponíveis em cache; instalação offline falha `ENOTCACHED`.
- PostgreSQL/psql e Docker não estão disponíveis neste runtime; CI foi corrigida, mas precisa ser executada em GitHub Actions ou máquina preparada.
- OIDC/MFA real depende de provedor e credenciais autorizados. Não inventar identidades nem desligar autenticação.
- Testes E2E reais de navegador e acessibilidade; avaliação clínica, SaMD/LGPD e autorização institucional.

## Próximo procedimento de validação (CI)
1. Executar GitHub Actions Quality em repositório privado, sem dados reais.
2. Conferir logs de migrações, role e `test:db:required`; corrigir qualquer falha.
3. Provisionar provedor OIDC de homologação e usuários fictícios, sem compartilhar segredos em arquivos.
4. Testar Care → API → Clinical em navegador e coletar evidências.
5. Manter `quality:gate` bloqueado até aprovações clínicas, regulatórias e institucionais.

**Estado:** correções de CI e SQL preparadas e testadas estaticamente. Nenhuma alegação de homologação ou implantação.
