# Backlog rastreável — M0 / M1

| ID | Marco | Item | Estado | Critério de aceite |
|---|---|---|---|---|
| M0-01 | M0 | Monorepo npm workspaces | Implementado | Portal e API com scripts separados |
| M0-02 | M0 | Tokens e identidade SVG provisória | Implementado | Care casa; Clinical infusão; paleta aprovada; sem ® |
| M0-03 | M0 | Rotas responsivas Care e Clinical | Implementado | Navegação sem acesso a dados clínicos |
| M0-04 | M0 | ADR, backlog, instruções e testes | Implementado | Documentação e testes básicos disponíveis |
| M0-05 | M0 | Aprovação final de vetores | Pendente | Revisão de marca, contraste, variantes e registro |
| M1-01 | M1 | Provedor OIDC e MFA profissionais | Pendente | Testes de sessão, MFA, recuperação e bloqueio |
| M1-02 | M1 | RBAC + ABAC e vínculo assistencial | Pendente | Testes de acesso entre pacientes/instituições |
| M1-03 | M1 | Migrações versionadas e RLS | Pendente | Isolamento institucional e rollback testados |
| M1-04 | M1 | Auditoria de acesso e alterações | Pendente | Registro imutável/consultável com retenção definida |
| M1-05 | M1 | CI/CD e ambientes DEV/HML/PROD | Pendente | Deploy reproduzível e segredos separados |
| M1-06 | M1 | Política LGPD e governança clínica | Pendente | Responsáveis, contratos, avaliação de riscos |

**Regra:** o termo “Implementado” em M0 indica somente fundação visual/técnica; não indica homologação assistencial.

## Atualização M1 — 10/10/2026
Implementação inicial de persistência, JWT, MFA por claim, autorização de tenant e auditoria. **Itens M1 permanecem pendentes de testes integrados, login do portal, CI/CD e homologação.** Ver `STATUS-M1.md`.
