# ONCOPHARMA — Laboratório integrado DEV (M9)

Fluxo **funcional local**: Care registra sintoma fictício → API Node salva relatório → regra determinística gera alerta → Clinical registra revisão/intervenção → rascunho de orientação → auditoria. Persistência em arquivo JSON local, com gravação atômica. Não há IA ativa, prontuário real, autenticação clínica, aprovação de orientação ou entrega ao paciente.

## Executar

Requer **Node.js 20+**, sem instalar dependências adicionais:

```bash
npm run lab:dev
```

Abrir http://127.0.0.1:4177. Os dados são armazenados em `tools/synthetic-lab/.local/workflow.json`, ignorados pelo Git. Para testar:

```bash
npm run test:lab
```

## Limites de segurança

- **Não usar dados reais.** O laboratório **não é** a API NestJS de produção e **não** usa PostgreSQL ou OIDC.
- O servidor escuta apenas `127.0.0.1`, não fornece CORS, exige JSON, valida campos e aplica limite de tamanho.
- Sem autenticação: qualquer pessoa com acesso ao computador local pode usar o laboratório.
- Alertas urgentes são simulações, sem notificações ou monitoramento real.
- A orientação é somente **rascunho**, nunca aprovada nem entregue.
- Não publicar na internet; não empregar em assistência.

## Próximo passo para uso real

Portar as rotas para NestJS com OIDC/MFA, RBAC e vínculos, transações PostgreSQL com RLS e auditoria; validar migração `0006_clinical_workflow.sql`; criar integração E2E com Postgres e OIDC reais, pentest, avaliação clínica e regulatória, fluxo de urgência com equipe e SLA. Não habilitar INSERT/UPDATE na conta clínica antes de homologação.
