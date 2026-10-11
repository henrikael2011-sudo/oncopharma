# Lacunas do Plano Diretor v3.0 — situação em M15 (11/10/2026)

Base: `main` @ `4edb263` (M14.5 consolidado) + PR #1 (D-009..D-011). Legenda: **FEITO** (código + teste + evidência em DEV sintético), **PARCIAL**, **FALTA**, **BLOQUEADO-DECISÃO** (depende de decisão clínica/LGPD/hospital — não será implementado sem aprovação).
Nada aqui altera D-001..D-008 nem os tokens de marca. "FEITO" nunca significa homologado para uso assistencial.

## 1. Decisões e limites (§1)
| Req. | Situação | Evidência | Lacuna / próximo passo |
|---|---|---|---|
| D-001 PWA responsiva + infra real | PARCIAL | 3 apps Next.js + API NestJS + PG17; build PASS; 390/768/1440 px sem overflow (e2e 07c); Terraform rascunho `infra/aws` (PR #1) | **Falta manifest/ícones PWA e service worker seguro (sem cache de dados clínicos)** → M15.6 |
| D-002 Care e Clinical separados | FEITO | `apps/care-web` :3001, `apps/clinical-web` :3002, clientes OIDC distintos; e2e 01/04/06 | Componentes do Clinical duplicados dentro do care-web e `apps/portal` legado → limpeza M15.1 |
| D-003/D-004 marca e cores | PARCIAL | tokens em `packages/design-system/app/globals.css`; `check:design` PASS | Arte final vetorial e manual de marca = **BLOQUEADO-DECISÃO** (designer/aprovação); modo claro/escuro testado: FALTA (M15.6) |
| D-005 IA com decisão humana | PARCIAL | `services/ai-orchestrator/src/evidence-gate.mjs` (só valida rascunho com referências aprovadas); intervenção exige ação humana | Sem IA ativa (correto). RAG/LLM = BLOQUEADO-DECISÃO (biblioteca clínica aprovada) |
| D-006 sintéticos; produção vazia | FEITO (DEV) | `synthetic=true` obrigatório (CHECK + RLS); seeds versionados; Terraform `data_classification` | Reset idempotente com confirmação/registro: PARCIAL (`reset-synthetic-dev.sh` sem trilha) → M15.4 |
| D-007 integração só autorizada | PARCIAL | `services/integration-gateway` (FHIR R4 sintético, `clinicalWrites:false`) | Simulador de hospital conectado ao Clinical: FALTA → M15.4 |
| D-008 externas | PARCIAL | IdP/hospedagem/repositório decididos (D-009..D-011) | Instituição-piloto, operação de alertas/SLA: BLOQUEADO-DECISÃO |
| D-013 rascunho de prescrição assistido por IA (*Emenda D-013*) | BLOQUEADO-DECISÃO | `RF_PRESCRICAO_ASSISTIDA_IA.md`; `docs/decisions/D-013-prescricao-assistida-ia.md` | **Depende de decisão regulatória** (Anvisa SaMD RDC 657/2022 e 751/2022, validação clínica, CFM/ICP-Brasil, integração com prontuário oficial). Fase posterior; não implementar agora |

## 2. Identidade visual (§2)
| Req. | Situação | Evidência | Lacuna |
|---|---|---|---|
| Sub-marcas Care (casa+acolhimento) / Clinical (bolsa de infusão) | PARCIAL | `public/brand/care.svg`, `clinical.svg` provisórios | Vetores finais: BLOQUEADO-DECISÃO |
| WCAG 2.2 AA, foco, alvos amplos | PARCIAL | axe A/AA sem violações sérias (e2e 03/09); skip link | Zoom 200%, leitor de tela real, alvos ≥ 24 px verificados: FALTA (M15.6) |
| Estados loading/vazio/erro em todos os componentes | PARCIAL | erros de envio no Care; "Faça login" no Clinical | Padronizar e testar estados em cada tela nova (DoD) |
| Care: um objetivo por tela, próximo passo, sem dose ao paciente | PARCIAL | formulário único; nenhuma orientação automática (e2e 06) | Telas Care do §4.1 → M15.2/M15.3 |
| Clinical: incerteza, dados faltantes, origem | FEITO (M15.4a) | `source_reference` nos registros; regra `MISSING_CONTEXT` | Mostrar origem/horário e "Não é possível concluir" na UI → M15.4 |

## 3. Papéis e permissões (§3)
| Req. | Situação | Evidência | Lacuna |
|---|---|---|---|
| Paciente registra o próprio sintoma | FEITO (M15.2) | `GET /v1/care/me` + `POST /v1/care/me/symptoms` resolvem o paciente por `patient_portal_links` (org+issuer+sujeito); rota com `patientId` removida (404); e2e 04/07, `tests/m152-*.mjs` | — |
| Cuidador: escopo autorizado, revogável | FEITO (M15.3) | migração 0010, `care.controller.ts` (`need()`), e2e 07d, `tests/m153-*.mjs` | **R4: modelo convite + consentimento por escopo + prazo + revogação + auditoria** (M15.3) |
| Farmacêutico revisa alerta / propõe intervenção | FEITO (DEV) | `GET alerts`, `POST interventions`; MFA + vínculo + atribuição (e2e 06/07) | — |
| Enfermagem "conforme atribuição"; Médico | FEITO (M15.4a, P-CLIN-1) | papéis `nurse`/`physician` em `STAFF`; atribuição por paciente testada (e2e 07) | Matriz fina por recurso (enfermagem não propõe intervenção farmacêutica) → M15.4 |
| Gestor clínico (filas, indicadores, auditoria) | FALTA | papel inexistente | Papel `clinical_manager` + telas → M15.4/M15.7 |
| Admin técnico sem acesso clínico | FEITO (negativo) | admin com MFA → sem acesso clínico (e2e 07) | Admin sem login e sem funções → M15.7 |
| RBAC + ABAC (organização, equipe, consentimento, finalidade, emergência auditada) | PARCIAL | RLS por organização; `care_assignments`; MFA | Unidade/equipe, finalidade e "quebra de vidro" auditada: FALTA (quebra de vidro = BLOQUEADO-DECISÃO de política) |
| MFA, sessões expiráveis, segregação | FEITO (IdP de teste) | e2e 04/06/08; RLS negativos (m145-db-*) | Repetir no IdP institucional (D-009) |

## 4.1 Care
| # | Tela | Situação | Evidência | Plano |
|---|---|---|---|---|
| 1 | Boas-vindas/acesso, consentimentos, acessibilidade, cuidador | PARCIAL | login OIDC, logout RP | Consentimento de uso (termo) = texto BLOQUEADO-DECISÃO (jurídico); preferência de acessibilidade (fonte grande/contraste) → M15.6 |
| 2 | Início "Como você está hoje?", próximo ciclo, lembretes, ajuda | FEITO (M15.2) | — | M15.2 (próximo ciclo a partir de `treatment_cycles`; lembretes sem push nesta fase) |
| 3 | Registrar sintoma: questionário adaptativo (duração, intensidade, início, sinais de alerta), confirmação | FEITO (M15.2, conteúdo demonstrativo P-CARE-2) | código + descrição livre; febre → `urgent_review` | Questionário estruturado sintético (perguntas = conteúdo **demonstrativo**, não aprovado clinicamente) → M15.2 |
| 4 | Minha jornada (ciclos, histórico em linguagem simples) | FEITO (M15.2) | — | M15.2 (recorte permitido; somente dados autorizados) |
| 5 | Meus medicamentos (prescrição validada, horários, adesão relatada) | FEITO (M15.2, sem dose P-CARE-3) | tabelas `clinical_medication_orders` | M15.2 (somente leitura + adesão relatada; nunca alterar dose) |
| 6 | Mensagens e orientações (canal institucional real) | BLOQUEADO-DECISÃO | `patient_guidance` exige aprovação | Canal/horários reais dependem da instituição; exibir só orientações `approved` (M15.2) |
| 7 | Preciso de ajuda (urgência, contatos reais) | FEITO (M15.2; contatos configuráveis P-CARE-4) | — | Tela com orientação genérica "procure atendimento/ligue 192" + contatos **configuráveis** (vazios em DEV); conteúdo final BLOQUEADO-DECISÃO → M15.2 |
| 8 | Cuidador e privacidade (granular, prazo, revogação, histórico de acessos) | FEITO (M15.3) | — | M15.3 (R4) |

## 4.2 Clinical
| # | Tela | Situação | Evidência | Plano |
|---|---|---|---|---|
| 1 | Painel (vinculados, fila de alertas, tarefas, pré-ciclos, pendências) | FEITO (M15.4a) | `/v1/me`, `/v1/patients`, alertas por paciente | Fila consolidada por gravidade/estado → M15.4 |
| 2 | Pacientes: busca e filtros | FEITO (M15.4a) | seletor de paciente | Filtros protocolo/ciclo/gravidade/pendência → M15.4 |
| 3 | Prontuário longitudinal | PARCIAL (linha do tempo com origem: FEITO M15.4a; diagnóstico/estadiamento/biomarcadores: FALTA) | `GET /v1/patients/:id/record` (ciclos, observações, alergias, medidas, exames, ordens, administrações, avaliações) | Linha do tempo com origem/horário na UI; diagnóstico/estadiamento/biomarcadores: tabelas FALTA → M15.4 |
| 4 | Avaliação pré-ciclo (checklist disponíveis/ausentes, parecer) | FEITO (M15.4a) | `evaluateSyntheticPreCycle` (testado) + `clinical_reviews` | Expor checklist + parecer persistido → M15.4 |
| 5 | Inteligência clínica | BLOQUEADO-DECISÃO | evidence-gate | Apenas regras determinísticas; nada de LLM |
| 6 | Intervenções (aceitar/ajustar/rejeitar, encaminhamento, responsável, prazo, desfecho) | FEITO (M15.4a) | `clinical_interventions` (decision pending/accepted/declined/referred) | Tarefa/encaminhamento com responsável/prazo/desfecho → M15.4 |
| 6a | **RF-M15-SAM-01 Solicitação de alteração ao médico** (D-012; plantão/médico vinculado, justificativa, evidências, prioridade, estados, IA-rascunho determinístico) | FALTA | — | **M15.5** (`docs/product/RF_SOLICITACAO_ALTERACAO_MEDICO.md`) |
| 7 | Protocolos versionados | PARCIAL | `clinical_protocol_versions` (aprovação obrigatória) | Visualização somente leitura → M15.4; aprovação = papel designado (BLOQUEADO-DECISÃO) |
| 8 | Indicadores | FALTA | — | Indicadores operacionais sintéticos (tempo até revisão, nº intervenções) → M15.7 |
| 9 | Admin (profissionais, equipes, permissões, conectores, trilhas) | FALTA | admin-web estático | M15.7 |

## 5. Comportamentos
| Req. | Situação | Evidência | Plano |
|---|---|---|---|
| Sintoma: validar, salvar, sinais críticos por regra, confirmação | FEITO (básico) | e2e 04; idempotência por requestId | Questionário M15.2 |
| Dado hospitalar chega (autentica, reconcilia, deduplica, provenance) | PARCIAL | `reconcileSynthetic` (unit) | Simulador conectado + provenance persistida → M15.4 |
| **Estados de alerta §5.1** (Detectado → Aguardando revisão → Em avaliação → Encaminhado → Em acompanhamento → Resolvido; Descartado com justificativa; Duplicado vinculado; sem fechamento por tempo) | PARCIAL | hoje `open/acknowledged/resolved` | **Migração 0009 com a máquina de estados completa + transições auditadas** → M15.4 |
| Encaminhamento/tarefa com confirmação de recebimento | FEITO (M15.4a) | — | M15.4 |
| Dados insuficientes → "Não é possível concluir" | FEITO (M15.4a) | regra `MISSING_CONTEXT` | UI + teste → M15.4 |
| Alerta crítico (febre) → orientação imediata + escalonamento configurado | PARCIAL | `urgent_review` | Mensagem imediata ao paciente com texto **provisório** para revisão + escalonamento "não configurado" explícito (sem prometer monitoramento) → M15.2 |

## 6–7. Inteligência, dados e integração
| Req. | Situação | Evidência | Plano |
|---|---|---|---|
| Regras determinísticas primeiro; LLM não suprime alerta | PARCIAL | `packages/clinical-rules` (`test:rules`) | Versionamento por regra já existe (`rule_version`) |
| RAG, avaliação de desempenho | BLOQUEADO-DECISÃO | — | — |
| Entidades nucleares (§7) | PARCIAL | 21 tabelas; faltam Facility, CareTeam, Consent, CaregiverAccess, Diagnosis/CancerStage/Biomarker, Task, Notification, IntegrationJob | Consent/CaregiverAccess (M15.3), Task (M15.4), IntegrationJob/Provenance (M15.4), CareTeam/Facility (M15.4/M15.5) |
| FHIR R4/HL7/Tasy/MV | PARCIAL (sintético) | gateway FHIR | Integração real BLOQUEADO-DECISÃO (D-007) |

## 8–9. Segurança e arquitetura
| Req. | Situação | Evidência |
|---|---|---|
| Criptografia trânsito/repouso, segredos gerenciados | PARCIAL | Terraform KMS/TLS/Secrets Manager (não aplicado) |
| Backups restauráveis testados / DR | FALTA | PITR configurado no rascunho; teste de restauração pendente |
| Logs sem dados clínicos desnecessários | PARCIAL | logs de validação sanitizados; WAF mascara cookie/authorization |
| LGPD/RIPD, SaMD/Anvisa | BLOQUEADO-DECISÃO | G01–G09 |
| API versionada/OpenAPI | PARCIAL | `/v1` sim; OpenAPI FALTA → M15.1 |
| Jobs assíncronos, Redis | FALTA (não necessário ainda) | — |
| Observabilidade (métricas/tracing) | FALTA | CloudWatch no rascunho |
| CI/CD, IaC | PARCIAL | CI GitHub ativo (PR #1); deploy não existe; Dockerfiles FALTA → M15.1 |

## 11–12. Testes e DoD
| Req. | Situação |
|---|---|
| Paciente A FOLFOX/neuropatia; Paciente B AC-T/náusea/febre | PARCIAL — seeds com os dois pacientes; cenários B "febre" e A "parestesia" sem E2E dedicado → M15.2/M15.4 |
| Acessos indevidos, duplicatas | FEITO (RLS, idempotência, 403s) |
| Perda de rede, latência | FALTA → M15.6 |
| Leitores de tela, zoom 200%, aparelhos pequenos | PARCIAL (390 px ok) → M15.6 |
| DoD item 12 (aprovação do responsável) | Toda entrega fica "aguardando aprovação de produto" |

## Emendas de 11/10/2026 (D-013 e Emenda UI)
| Req. | Situação | Documento | Lacuna / próximo passo |
|---|---|---|---|
| D-013 Rascunho de prescrição assistido por IA | BLOQUEADO-DECISÃO — **depende de decisão regulatória** | `RF_PRESCRICAO_ASSISTIDA_IA.md` | Aprovada (registro); implementação bloqueada até enquadramento Anvisa, validação clínica e integração com prontuário oficial. Regras determinísticas de dose antes de qualquer LLM |
| UI-01 Care simples (letra grande, alto contraste, um passo por tela, botões grandes) | FALTA | `docs/diretrizes-design.md` §1 | → M15.2 / M15.6 (axe, zoom 200%) |
| UI-02 Clinical sem poluição (essencial visível, detalhe sob demanda) | FEITO (M15.4a) | `docs/diretrizes-design.md` §2 | → M15.4 |
| UI-03 Dados do paciente só ao clicar; lista mínima (identificação segura, gravidade, pendência) | FEITO (M15.4a) | `docs/diretrizes-design.md` §3 | → M15.4 (contrato da API de lista + E2E + auditoria do detalhe) |
| UI-04 Busca de pacientes respeitando vínculo/ABAC | FEITO (M15.4a) | `docs/diretrizes-design.md` §4 | → M15.4 (testes RLS/ABAC da busca) |
| UI-05 Alocação hospitalar (unidade/andar/quarto/leito) via "Sincronizar" — FHIR Location/Encounter.location ou HL7 ADT A01/A02/A03 | FALTA | `docs/diretrizes-design.md` §5 | → M15.4 com simulador; integração real depende de D-007 |
| UI-06 Alocação manual marcada "manual", auditada; sincronizado prevalece com aviso de conflito | FALTA | `docs/diretrizes-design.md` §6 | → M15.4 |
| UI-07 Importação de PDF de pacientes do dia (layout por fornecedor, pré-visualização obrigatória, confirmação humana, origem/hash, divergência, auditoria, storage criptografado) | FALTA (requisito aprovado); dados reais BLOQUEADO-DECISÃO | `RF_IMPORTACAO_PDF_PACIENTES.md`; `docs/diretrizes-design.md` §7 | Só PDFs sintéticos até autorização formal do hospital (farmácia/direção + DPO/LGPD, tutela da saúde), ambiente sa-east-1 restrito e repositório privado. Marco a definir (sugestão: após M15.4) |

## Plano de marcos (um branch e um PR por marco; cada um com unit + DB PG17 + Playwright E2E + axe)
| Marco | Branch | Escopo (sem decisões clínicas/LGPD/hospital) |
|---|---|---|
| M15.1 | `m15.1-fundacao` | Remover duplicações (Clinical dentro do care-web), OpenAPI da API, Dockerfiles, modo sintético explícito (substitui dependência de `NODE_ENV`) |
| M15.2 | `m15.2-care-paciente` | **R3** paciente derivado da identidade (`GET /v1/care/me`); Início, Registrar sintoma estruturado, Minha jornada, Meus medicamentos (leitura + adesão relatada), Preciso de ajuda, orientações só `approved`, febre → mensagem imediata provisória |
| M15.3 | `m15.3-cuidador` | **R4** convite + consentimento por escopo + prazo + revogação + histórico de acessos auditado |
| M15.4 | `m15.4-clinical` (4a núcleo) → `m15.4b-alocacao` (Sincronizar/manual) → `m15.4c-pdf` (importação PDF sintética) | Estados de alerta §5.1 (migração), fila/painel, linha do tempo com origem, pré-ciclo, tarefas/encaminhamento, simulador hospitalar FHIR conectado | FEITO (M15.4a) 
| M15.5 | `m15.5-solicitacao-medico` | **RF-M15-SAM-01 (D-012)**: unidades + escala de plantão sintética, critérios de prioridade, solicitação com evidências e Provenance, estados rascunho→enviada/em revisão→aceita/ajustada/recusada→concluída, resposta do médico, `TemplateJustificationDrafter` (determinístico, rotulado), RLS/auditoria; E2E farmacêutico → plantonista → auditoria |
| M15.6 | `m15.6-pwa-a11y` | Manifest/SW seguro, preferências de acessibilidade, zoom 200%, rede lenta/offline |
| M15.7 | `m15.7-admin` | Login no Admin, profissionais/equipes/vínculos (sem dados clínicos), trilha de auditoria, indicadores operacionais |

## Propostas conservadoras para aprovação (o Plano deixa a escolha em aberto)
**P-R3 — paciente derivado da identidade.** O Care nunca recebe/mostra UUID. A API resolve o paciente por `patient_portal_links` (issuer + sujeito) dentro do tenant. Um link ativo ⇒ paciente automático; mais de um (ex.: cuidador de dois pacientes) ⇒ lista com nome sintético/rótulo, sem identificador interno. Nenhum link ⇒ "Conta ainda não vinculada; procure a equipe" (sem autocadastro).

**P-R4 — cuidador (mais conservador):**
1. Só o **paciente** convida (equipe não concede em nome dele nesta fase); convite com código de uso único, **expira em 72 h**, vinculado ao e-mail informado; o cuidador entra com conta própria no IdP.
2. Escopos granulares, **todos desligados por padrão**: `ver_jornada`, `ver_medicamentos`, `registrar_sintoma`. Nunca: mensagens, prontuário completo, dados de outros pacientes. Cuidador não pode convidar terceiros.
3. **Prazo obrigatório**, máximo 90 dias (renovação explícita pelo paciente).
4. Revogação imediata pelo paciente (efeito na próxima requisição; sessões do cuidador perdem acesso).
5. Todo acesso do cuidador gera `audit_events` e aparece ao paciente em "Histórico de acessos".
6. Registro feito pelo cuidador fica marcado `source=caregiver` com a identidade do cuidador.
7. Pendente de decisão (BLOQUEADO-DECISÃO): cuidador de paciente incapaz/menor (representação legal), aceite jurídico do termo de consentimento.

## Atualização M15.4b — alocação hospitalar
| Item | Status | Evidência |
|---|---|---|
| Agrupamento por unidade/andar/quarto/leito | FEITO (M15.4b) | `Worklist.tsx` (grupos), `GET /v1/clinical/worklist` (`allocation`, `lastSync`) |
| "Sincronizar" via integration-gateway + hospital simulado (FHIR R4 Encounter.location / HL7 ADT PV1-3), origem e horário | FEITO (M15.4b) | `services/integration-gateway/src/{server,location-feed}.mjs`, `simulator/hospital-sim.mjs`, `POST /v1/clinical/allocations/sync` |
| Manual quando o hospital não informa, com autoria/horário; aviso de divergência | FEITO (M15.4b) | migração `0012`, `AllocationPanel.tsx`, E2E 06c, `tests/m154b-*` |
| Cabeçalho Clinical em 390px sem sobreposição (achado hml) | FEITO (M15.4b) | CSS `.clinical-header`, E2E 06 (asserção de sobreposição a 390px) |
| Importação de PDF hospitalar | PENDENTE → M15.4c | — |

