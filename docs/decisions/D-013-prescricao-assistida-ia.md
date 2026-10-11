# D-013 — Rascunho de prescrição assistido por IA

| Campo | Valor |
|---|---|
| ID | D-013 |
| Data | 11/10/2026 |
| Responsável | Henrikael Walisson |
| Situação | **Aprovada (registro); implementação bloqueada até pré-requisitos: enquadramento Anvisa, validação clínica, integração com prontuário oficial** |
| Fase | Posterior — **NÃO implementar agora** |
| Requisito | `docs/product/RF_PRESCRICAO_ASSISTIDA_IA.md` (RF-D013-01) |
| Emenda | Plano Diretor v3 — *Emenda D-013, 11/10/2026* (§1 tabela de decisões e escopo, §3 matriz de papéis, §5 tabela de comportamento, §14 riscos) |

**Decisão:** registrar como requisito aprovado o fluxo em que a IA identifica um problema do paciente relacionado à quimioterapia, sugere medicação conforme protocolo, o médico confirma, a IA gera uma prescrição-rascunho conforme padrões institucionais (somente medicamentos com registro Anvisa, ordem de infusão, dose calculada a partir de dados registrados), e o médico confirma novamente, imprime e assina.

**Garantias obrigatórias:**
- Nenhuma prescrição é gerada sem confirmação médica.
- Cada confirmação do médico fica registrada na auditoria.
- O documento só tem validade após impressão e assinatura do médico.
- A IA produz documento, não decide.

**Nota:** entrada resumida também registrada em `docs/product/DECISOES_M15.md` (linha D-013).
