# M10 — Critérios de validação integrada

1. PostgreSQL real: migrar 0001–0007 com usuário de migração; conferir RLS e privilégios do papel runtime.
2. OIDC real: testar JWKS, expiração, audience, issuer, MFA, revogação de vínculo e conta Care.
3. Care: sem vínculo → 403; vínculo sintético → 201/200; repetição do mesmo requestId → sem duplicação; texto inválido → 400.
4. Clinical: profissional sem MFA ou sem atribuição → 403; com atribuição → listar alertas e criar intervenção; outro tenant → 403.
5. Auditoria: cada criação, consulta e intervenção gera evento na mesma transação; rollback remove alterações parciais.
6. Revisar políticas SQL e privilégio `audit_events` com DB real antes de aceitar migração.
7. Segurança: não inserir pacientes reais; nenhuma orientação automatizada; nenhum envio de mensagens.
8. Frontend: conectar UI Care e Clinical ao backend autenticado após OIDC; fluxo de sessão no browser ainda não está homologado.

**Status:** implementação inicial do fluxo em NestJS e migração SQL; sem prova de integração end-to-end até executar ambiente real.
