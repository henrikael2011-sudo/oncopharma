# Matriz de rastreabilidade — referência Plano Diretor v3.0
| Requisito | Implementação | Verificação | Situação |
|---|---|---|---|
| D-001 PWA e infraestrutura real | Next.js/NestJS/PostgreSQL previsto | Build, deploy, PWA offline | PARCIAL |
| D-002 Care/Clinical separados | apps/care-web e apps/clinical-web | check-governance; E2E pendente | PARCIAL |
| D-003/004 Marca e cores aprovadas | packages/design-system; SVG provisório | check-design; revisão visual pendente | PARCIAL |
| D-005 IA com revisão humana | evidence-gate.mjs | testes de bloqueio de autonomia | PARCIAL |
| D-006 Pacientes sintéticos | seeds DEV/HML; produção vazia | testes de seed/RLS pendentes | PARCIAL |
| D-007 FHIR/Tasy/MV autorizados | gateway sintético FHIR R4 | testes unitários, contrato hospitalar pendente | PARCIAL |
| D-008 decisões externas | docs/quality/PILOTO_GATES.md | instituição, IdP, SLA pendentes | ABERTO |
| Seção 5: alerta → intervenção | API M10.1 | teste com PostgreSQL/IdP pendente | PARCIAL |
| Seção 12: Definition of Done | quality gates | nenhum módulo clínico homologado | NÃO CONCLUÍDO |
