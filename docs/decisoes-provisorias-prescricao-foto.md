# Decisões PROVISÓRIAS — Prescrição por foto (fase A)

> **Não liberado para uso clínico** (`readyForClinicalUse=false`). Dados 100% fictícios.
> As 4 perguntas abaixo estavam pendentes de resposta do Henrikael (spec de 18/10/2026). Foi adotado o padrão mais conservador; cada um está marcado `PROVISÓRIO (Qn …)` no código.

| # | Pergunta pendente | Default PROVISÓRIO adotado | Onde está | Como mudar |
|---|---|---|---|---|
| Q1 | Exemplos de prescrição | Nenhum exemplo real; uma prescrição inventada ("Paciente Fictício 001", medicamentos "A/B fictícios", data 2099) e imagem ilustrativa em texto, sem foto carregada | `apps/clinical-web/lib/prescricao-ficticia.ts` | Substituir `PRESCRICAO_FICTICIA` por exemplos **anonimizados** fornecidos pelo Henrikael (fase A continua sem dado real) |
| Q2 | Protocolos comuns | Nenhum protocolo real nomeado nem regra de dose; rótulo genérico "Esquema Fictício X"; sugestões só pedem conferência | `apps/clinical-web/lib/prescricao-ficticia.ts` | Após a lista de protocolos validada pelo Henrikael, criar biblioteca mínima (etapa 2 do roadmap) com revisão farmacêutica |
| Q3 | Ciência sobre fase B | Fase B **bloqueada**: `FASE_B_HABILITADA=false`; sem upload, câmera, API ou persistência | `apps/clinical-web/lib/prescricao-ficticia.ts` | Só após ciência formal do Henrikael + autorização do HNSG, contrato e AWS São Paulo; mudança em PR separado |
| Q4 | Uso de iPad/Safari | Layout responsivo genérico (lado a lado ≥900px, empilhado abaixo), alvos ≥44px, CSS padrão sem APIs específicas | `components/clinical/PrescricaoFoto.tsx`, `app/globals.css` (bloco M18) | Ajustar breakpoint/gestos após teste real no iPad/Safari do Henrikael |

Rota: `/clinical/prescricao-foto`. Teste: `tests/m18-prescricao-foto.test.mjs`.
