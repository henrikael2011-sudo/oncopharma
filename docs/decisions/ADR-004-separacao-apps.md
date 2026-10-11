# ADR-004 — Segregação de experiências (M10.3)
**Status:** Implementada estruturalmente; testes de deployment pendentes.
**Base:** D-001, D-002, seção 9 do Plano Diretor v3.0.
**Decisão:** criar `apps/care-web`, `apps/clinical-web`, `apps/admin-web` com deploys independentes; preservar `apps/portal` como legado temporário para migração gradual. Marca compartilhada em `packages/design-system` com verificador de divergência.
**Consequência:** as rotas públicas e o login devem ser configurados por aplicação e domínio; a separação de UI não substitui autorização no backend. Não apagar o portal antes dos testes E2E de paridade.
