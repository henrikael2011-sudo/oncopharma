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

## Atualização M14.5 (11/10/2026) — evidências reais em DEV sintético
Necessidade → tela → regra → API → teste → aprovação. Tabela acima preservada como histórico M14.4.

| Requisito (Plano v3) | Tela / componente | Regra / API | Teste (evidência) | Situação M14.5 |
|---|---|---|---|---|
| D-001 PWA/infra real | 3 apps Next.js + API NestJS | `npm run build` | full-build PASS; lockfile versionado | PARCIAL (PWA offline e deploy pendentes) |
| D-002 Care/Clinical separados | care-web :3001 / clinical-web :3002 / admin-web :3003 | clientes OIDC distintos | e2e-care-clinical PASS (01, 04, 06) | PARCIAL (portal legado pendente) |
| D-003/004 Marca e cores | design-system, globals.css | tokens inalterados; contraste AA | check:design PASS; axe sem sérias/críticas (e2e 03, 09) | PARCIAL (arte vetorial final pendente; ajuste R9 aguarda aprovação) |
| D-005 IA com revisão humana | WorkflowReview | intervenção exige justificativa; sem orientação automática | e2e 06 (`patient_guidance` vazio) | PARCIAL |
| D-006 Somente sintéticos | seeds DEV; produção vazia | `synthetic=true` obrigatório (RLS WITH CHECK) | m145-db-rls (relato não sintético rejeitado) | PARCIAL |
| D-007 FHIR/Tasy/MV | gateway sintético | — | testes unitários (inalterados) | PARCIAL |
| D-008 decisões externas | — | IdP, hospedagem, piloto, SLA | oidc-mfa (institucional) BLOCKED | ABERTO |
| §3 RBAC+ABAC, MFA profissionais | ClinicalAccess | `/v1/patients`, `/v1/workflow/clinical/*` (MFA, vínculo, atribuição) | e2e 07 (sem MFA 403; admin sem acesso; não atribuído 403; org forjada 403) | VERIFICADO EM DEV |
| §4.1-3 Registrar sintoma (Care) | CareSymptomReport | `POST /v1/workflow/care/patients/:id/symptoms` + vínculo de identidade | e2e 04; m145-db-rls (patientId do cliente) | VERIFICADO EM DEV (R3 UX pendente) |
| §4.1-8 Cuidador | — | sem modelo de autorização; negado por padrão | e2e 07 (cuidador 403) | NÃO IMPLEMENTADO |
| §5 alerta → revisão → intervenção | WorkflowReview | `GET alerts`, `POST interventions` | e2e 06 (alerta `acknowledged`, intervenção pelo farmacêutico) | VERIFICADO EM DEV |
| §5/§8 Auditoria reconstruível | — | `audit_events` append-only, INSERT por tenant | e2e 06; m145-db-rls (audit) | VERIFICADO EM DEV |
| §8 Segregação por instituição (RLS) | — | FORCE RLS; role sem BYPASSRLS | m145-db-rls (cross-tenant, superuser, row_security) | VERIFICADO EM DEV |
| §8 Sessão, CSRF, logout, expiração | auth routes | cookie HttpOnly/Lax; Origin; RP logout; exp | e2e 04, 08 | VERIFICADO COM IdP DE TESTE |
| §11 Teclado, leitor de tela, contraste | layouts | skip link; axe WCAG A/AA | e2e 03, 04, 06, 09 | PARCIAL (zoom 200%, leitores reais e dispositivos pequenos pendentes) |
| §12 DoD | — | quality gates | release-gate BLOCKED | NÃO CONCLUÍDO (sem aprovação de produto/clínica) |
