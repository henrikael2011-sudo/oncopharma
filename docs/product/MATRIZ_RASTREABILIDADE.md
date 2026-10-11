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


## M14.5 CONSOLIDADO (Grok + Codex, `fix/m14-5-merge`, 11/10/2026)
| Requisito (Plano v3) | Implementação | Evidência | Estado |
|---|---|---|---|
| §8 Segregação por instituição (RLS) — robustez de sessão | migração 0008 (`nullif` em 11 políticas) | m145-db-0008 (vermelho antes, verde depois) | VERIFICADO EM DEV |
| §8 Menor privilégio no banco | API recusa superusuário/BYPASSRLS; role NOSUPERUSER… (Codex) | api-security-unit; m145-db (Codex) | VERIFICADO EM DEV |
| §8 Autenticação OIDC (integridade do login) | id_token/nonce/at_hash/JWKS no callback (Codex) | e2e 04, 06, 07b | VERIFICADO COM IdP DE TESTE |
| §11 Responsividade | — | e2e 07c (390/768/1440, sem overflow) | PARCIAL (zoom 200% e leitores reais pendentes) |
| §12 Reprodutibilidade / CI | `npm ci`, secrets, testes extras no CI (Codex) | npm-ci.log; CI não executado (sem repositório) | PARCIAL |
| D-008 decisões externas | — | oidc-mfa institucional e clinical-release BLOCKED | ABERTO |

## M15 — novos requisitos aprovados
| Requisito | Tela | Regra | API | Teste | Aprovação |
|---|---|---|---|---|---|
| RF-M15-SAM-01 Solicitação de alteração ao médico (D-012) | Clinical: "Solicitar alteração ao médico" (autor) e "Solicitações recebidas" (médico) | vínculo assistencial + MFA; estados rascunho→enviada/em revisão→aceita/ajustada/recusada→concluída; app nunca altera prescrição; IA só rascunho rotulado | `/v1/workflow/clinical/patients/:id/change-requests` (planejado M15.5) | unit (estados, plantão, drafter); DB/RLS negativos (sem vínculo, outra org, admin); E2E farmacêutico→plantonista→auditoria | Requisito aprovado pelo responsável; implementação pendente (M15.5) |

## Emenda UI / D-013 (11/10/2026)
| Requisito | Implementação | Verificação | Estado |
|---|---|---|---|
| D-013 Rascunho de prescrição assistido por IA (`RF_PRESCRICAO_ASSISTIDA_IA.md`) | — (não implementar) | — | **BLOQUEADO — depende de decisão regulatória** (Anvisa SaMD RDC 657/2022 e 751/2022, validação clínica, CFM/ICP-Brasil, integração com prontuário oficial) |
| UI-01 Care simples (letra grande, alto contraste, um passo por tela, botões grandes) | `docs/diretrizes-design.md` §1 | axe + zoom 200% + E2E Care | ABERTO |
| UI-02 Clinical sem poluição (essencial visível, detalhe sob demanda) | `docs/diretrizes-design.md` §2 | revisão de UX + E2E Clinical | ABERTO |
| UI-03 Dados do paciente só ao clicar; lista mínima | `docs/diretrizes-design.md` §3 | teste de contrato da API de lista + E2E + auditoria | ABERTO |
| UI-04 Busca de pacientes respeitando vínculo/ABAC | `docs/diretrizes-design.md` §4 | testes RLS/ABAC da busca | ABERTO |
| UI-05 Alocação hospitalar por "Sincronizar" (FHIR Location/Encounter.location ou HL7 ADT A01/A02/A03) | `docs/diretrizes-design.md` §5; simulador até D-007 | E2E com simulador; auditoria de sincronização | ABERTO (integração real depende de D-007) |
| UI-06 Alocação manual marcada, auditada; sincronizado prevalece com aviso de conflito | `docs/diretrizes-design.md` §6 | teste de conflito manual × sincronizado | ABERTO |
| UI-07 Importação de PDF de pacientes do dia (layout por fornecedor, pré-visualização, confirmação, origem/hash, divergência, auditoria, storage criptografado) | `docs/product/RF_IMPORTACAO_PDF_PACIENTES.md`; `docs/diretrizes-design.md` §7 | E2E com PDFs sintéticos | ABERTO (aprovado); **dados reais BLOQUEADO** até autorização do hospital + DPO/LGPD, ambiente sa-east-1 restrito e repositório privado |
