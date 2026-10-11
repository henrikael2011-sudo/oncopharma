# RF-D013-01 — Rascunho de prescrição assistido por IA

**Decisão:** D-013 (`docs/decisions/D-013-prescricao-assistida-ia.md`)
**Data:** 11/10/2026 • **Solicitante:** Henrikael Walisson
**Situação:** **Aprovada (registro); implementação bloqueada até pré-requisitos: enquadramento Anvisa, validação clínica, integração com prontuário oficial.**
**Fase:** posterior. **NÃO implementar agora.** Nenhum código, endpoint, tela ou prompt de LLM deve ser criado para este requisito antes do desbloqueio formal.

> Princípio: **a IA produz documento, não decide.** Nenhuma prescrição é gerada sem confirmação médica; cada confirmação do médico fica na auditoria; o documento só vale após impressão e assinatura do médico.

## 1. Fluxo descrito
1. **Identificação do problema:** a IA identifica um problema do paciente (ex.: náusea/problema estomacal, tontura) possivelmente relacionado à quimioterapia, a partir de relatos e dados registrados.
2. **Sugestão de medicação:** a IA sugere medicação possível conforme o protocolo da quimioterapia em uso (protocolo institucional versionado), apresentando justificativa, fontes e dados faltantes.
3. **1ª confirmação médica:** o médico confirma, ajusta ou rejeita a sugestão. Rejeição encerra o fluxo. A confirmação é registrada na auditoria (quem, quando, o quê, versão do protocolo, entradas usadas).
4. **Rascunho de prescrição:** a IA gera prescrição-rascunho completa conforme padrões da instituição:
   - somente medicamentos com registro válido na Anvisa;
   - ordem de infusão;
   - dose calculada **por regras determinísticas** a partir de peso, altura/superfície corporal, função renal/hepática e demais dados já registrados — a IA **nunca inventa dose**;
   - marcação clara de "RASCUNHO — requer confirmação e assinatura médica".
5. **2ª confirmação médica, impressão e assinatura:** o médico revisa e confirma novamente; o documento é impresso e assinado pelo médico (ou assinado eletronicamente com ICP-Brasil, quando aplicável). A confirmação é registrada na auditoria.

## 2. Garantias obrigatórias
- Nenhuma prescrição é gerada sem confirmação médica (duas confirmações: sugestão e rascunho).
- Cada confirmação do médico fica na auditoria (`audit_events` append-only), com versão do protocolo, das regras de dose e das entradas.
- Impressão + assinatura do médico são condição de validade; o sistema não envia prescrição a farmácia/administração sem isso.
- Dupla checagem farmacêutica antes da dispensação/administração.
- Paciente/cuidador nunca recebem a sugestão de medicamento ou dose (Plano v3 §2.3 e §5.2).

## 3. Análise de compatibilidade com o Plano Diretor v3
- **Compatível com o espírito da D-005** (IA explica e propõe; decisão humana obrigatória): o médico decide em dois pontos e assina.
- **Conflita com o texto vigente do Plano v3**:
  - §1 — "Fora de escopo da primeira liberação: **prescrição automática**";
  - §3 matriz de papéis — "Prescrever/alterar terapia — Farmacêutico: **Não via sugestão de IA**; Médico: conforme habilitação e **sistema oficial**";
  - §5 — "Sugestão de suporte: **opções de avaliação, nunca ordem médica automática**";
  - §5.2 — "prescrição **no sistema oficial**".
- **Encaminhamento:** emenda formal do Plano registrada como *Emenda D-013, 11/10/2026* (texto original preservado; D-013 vale apenas para fase posterior). A primeira liberação continua sem prescrição.

## 4. Pré-requisitos antes de implementar
1. **Enquadramento Anvisa como SaMD** — RDC 657/2022 (software como dispositivo médico) e RDC 751/2022 (classificação de risco/regularização); classe de risco provavelmente **III**; avaliação regulatória formal.
2. **Validação clínica** com comitê clínico e instituição-piloto.
3. **Regras CFM** de prescrição e assinatura (ICP-Brasil para prescrição eletrônica).
4. **Integração autorizada** com prontuário/sistema oficial (D-007).
5. **Protocolos institucionais versionados** e aprovados por papel designado.
6. **Dupla checagem farmacêutica** incorporada ao fluxo.
7. **Rastreio de cada confirmação** (auditoria reconstruível).
8. **Regras determinísticas de dose** — limites máximos, ajuste renal/hepático, superfície corporal, arredondamento institucional — implementadas e testadas **antes de qualquer LLM**; o LLM nunca calcula nem inventa dose.

## 5. Rastreabilidade
Registrado em `docs/product/MATRIZ_RASTREABILIDADE.md` como **BLOQUEADO — depende de decisão regulatória**. Ao ser incorporado à análise de lacunas M15.0 (PR #2), deve constar com o mesmo status.

---
**Nota de segurança:** exemplos de sintomas e medicamentos ilustram requisitos de produto, não constituem orientação terapêutica.
