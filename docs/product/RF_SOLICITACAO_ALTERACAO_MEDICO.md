# RF-M15-SAM-01 — Solicitação de alteração ao médico

**Origem:** requisito aprovado pelo responsável do produto (Henrikael Walisson) em 11/10/2026 — decisão **D-012** (`docs/product/DECISOES_M15.md`). Compatível com o Plano Diretor v3 §3 (farmacêutico propõe intervenção; médico decide e prescreve "conforme habilitação e sistema oficial"), §4.2-6 (intervenções/encaminhamento), §5 (encaminhamento com responsável, prazo e confirmação) e D-005 (IA nunca decide). **Não altera D-001..D-008.** Uso somente com dados sintéticos até G01–G09.

## Ficha (modelo §13.1)
| Campo | Definição |
|---|---|
| ID / Nome | RF-M15-SAM-01 — Solicitação de alteração ao médico |
| Público | Profissional com **vínculo assistencial** ao paciente (farmacêutico, enfermagem; médico também pode encaminhar a outro médico) → destinatário médico |
| Objetivo | Registrar, de forma rastreável, um pedido justificado para que o médico avalie mudança em prescrição/conduta identificada a partir do prontuário/medicação. **O ONCOPHARMA nunca altera a prescrição**: o médico age no sistema oficial; aqui só se registra a resposta e o desfecho. |
| Destinatário | (a) **Médico do plantão** — resolvido no envio a partir da escala sintética por unidade (`on_call_shifts`), ou (b) **médico específico** com vínculo ao paciente. Sem plantonista escalado ⇒ envio bloqueado com a mensagem "Sem médico de plantão configurado para esta unidade" (nunca envio silencioso). |
| Entradas | Paciente; destinatário; **justificativa obrigatória** (texto final humano); **evidências vinculadas** (≥ 1: alerta, ordem/administração de medicamento, exame, relato de sintoma); prioridade. |
| Prioridade | Conforme critérios do serviço (`request_priority_criteria` por organização/unidade). Em DEV: critérios **demonstrativos** "rotina / prioritária / urgente", rotulados como não aprovados clinicamente. A prioridade não fecha nem escala nada automaticamente por tempo. |
| Estados | `rascunho` → `enviada` → `em_revisao` → `aceita` \| `ajustada` \| `recusada` (resposta do médico **obrigatória**) → `concluida` (desfecho registrado com referência ao sistema oficial). Auxiliar: `descartada` (somente a partir de `rascunho`, pelo autor). Transições inválidas são rejeitadas no banco. |
| Quem faz o quê | Autor cria/edita rascunho, envia, descarta rascunho e registra conclusão; destinatário (médico) abre (→ `em_revisao`) e responde; ninguém altera prescrição. |
| Permissões | Ver/criar/responder **somente** profissionais com vínculo assistencial ao paciente (`care_assignments`) na mesma organização, com MFA. Médico de plantão sem vínculo prévio: acesso **apenas** à solicitação e às evidências vinculadas, com motivo `on_call` auditado (proposta conservadora P-SAM-1). Admin técnico: **sem acesso**. Paciente/cuidador: sem acesso nesta fase. |
| Auditoria / Provenance | Cada criação, edição, envio, leitura, resposta, conclusão e descarte gera `audit_events` (ator, papel, horário, organização). Cada evidência vinculada guarda tipo, id, `source_reference` e horário de origem (Provenance). A resposta do médico guarda identidade e horário. |
| IA (opcional) | Ver seção abaixo. |
| Segurança | RLS por organização + checagem de vínculo na API; nenhum dado da solicitação em logs; `synthetic=true` obrigatório em DEV. |
| Dependências | M15.4 (Clinical: tarefas/fila, unidades/equipes). |
| Fora de escopo | Escrever no prontuário/sistema de prescrição oficial; notificação push/SMS; escalonamento por SLA (depende de D-008 operação de alertas). |

## Assistência de IA (opcional) — rascunho de justificativa
- Interface `JustificationDrafter` (`draft(evidences) → { text, claims[] }`), cada afirmação (`claim`) com o id da evidência de origem.
- **Implementação atual: `TemplateJustificationDrafter` — determinística, por modelo de texto, sem modelo de IA/LLM.** Identificada assim no código e nesta documentação; nenhum provedor de IA está aprovado. A UI pode exibir o rótulo "Assistência de IA · rascunho".
- O rascunho é rotulado **"Rascunho gerado por IA — não revisado"**, nunca é enviado sozinho: o profissional precisa editar ou confirmar explicitamente; o envio exige texto final humano + confirmação.
- **Rascunho e texto final são armazenados separadamente** (`ai_draft_text`, `ai_draft_claims`, `ai_drafter_version` × `justification`), com indicação se houve edição.
- A IA (ou o modelo) nunca escolhe destinatário, prioridade, nem sugere dose/conduta; não cria afirmações sem evidência vinculada; campos ausentes permanecem ausentes.

## Critérios de aceite / testes
1. Unit: máquina de estados (todas as transições válidas/ inválidas), resolução de plantonista (com/sem escala, fronteira de horário), drafter determinístico (toda frase com evidência; nada inventado; rótulo presente).
2. DB/RLS (PG17, role `oncopharma_app`): sem vínculo → nega ver/criar/responder; outra organização → 0 linhas/INSERT negado; admin técnico → negado; transição inválida → erro; resposta sem texto → erro; draft ≠ final preservados.
3. E2E (Keycloak de teste, senha+TOTP): farmacêutico seleciona evidências do paciente sintético A → gera rascunho (rótulo visível) → edita/confirma → envia ao **médico do plantão** → médico (TOTP) abre e responde "ajustada" com texto → farmacêutico registra conclusão → auditoria reconstrói a sequência; negativos: admin 403, profissional sem vínculo 403; axe sem violações sérias.

## Propostas conservadoras (aguardam aprovação)
- **P-SAM-1:** plantonista sem vínculo prévio vê só a solicitação + evidências vinculadas (não o prontuário inteiro), acesso auditado com motivo `on_call`.
- **P-SAM-2:** apenas o autor registra `concluida`, informando a referência do registro no sistema oficial (texto livre); o médico pode registrar observação, mas não conclui pelo autor.
- **P-SAM-3:** rascunho pode ser descartado (`descartada`) apenas antes do envio; após `enviada` não há exclusão (somente estados finais).
