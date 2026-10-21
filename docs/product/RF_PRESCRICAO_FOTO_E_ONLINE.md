# RF — Prescrição por foto e prescrição online editável

Registrado em 21/10/2026 a pedido de Henrikael Walisson. Status: **planejado** — não liberado para uso clínico.
Referências: PR #15 (fase A, página `/clinical/prescricao-foto`, dados fictícios), PR #11 (base), `RF_PRESCRICAO_ASSISTIDA_IA.md`, `RF_SOLICITACAO_ALTERACAO_MEDICO.md` (M15.5).
Marco: fase A em **M18 (PR #15)**; itens 2 e 3 em fase B, bloqueada (`FASE_B_HABILITADA=false`) até validação clínica, LGPD e Anvisa.

## 1. Foto da prescrição → versão online editável
- Farmacêutico fotografa/anexa a prescrição; o sistema mostra a foto de um lado e os itens transcritos do outro, editáveis.
- Cada item: Validar / Desvalidar / Voltar a pendente; rodapé com o resumo do que falta.
- Enquanto não houver liberação: **somente dados fictícios**.

## 2. Criação automática a partir só da foto
- Quando a foto for legível, o sistema gera sozinho a prescrição online.
- Sempre como **rascunho** ("Resumo com IA · rascunho"), com o aviso "A IA não decide".
- Nenhum item fica validado sem ação do farmacêutico; nada é liberado automaticamente.

## 3. Abrir prescrição existente como documento editável
- Clicar num paciente que já tem prescrição no sistema abre a prescrição numa página editável estilo documento (tipo Word).
- Histórico de versões: quem editou, quando, o que mudou (trilha de auditoria imutável).
- Permissões por papel (RBAC/ABAC) e RLS por organização.

## 4. Cuidado regulatório
- Alterar o conteúdo da prescrição em si é atribuição do **médico prescritor**.
- O farmacêutico registra validação, observações e intervenções; mudanças de conduta seguem como solicitação ao médico (M15.5, D-012).
- Seguir RDC Anvisa 657/2022 e LGPD; sem dados reais até validação clínica de Henrikael.

## 5. Conferência assistida por IA (auxiliar) e biblioteca de referência
> A IA **só auxilia**: nunca corrige, libera nem decide. A liberação final é sempre do **farmacêutico/médico**. A fase B continua bloqueada até os protocolos estarem carregados e validados.

### 5a. Conferência lado a lado com a foto
- Foto de um lado, itens transcritos do outro (mesma tela do item 1).
- Conferência auxiliar por IA: doses × **peso/superfície corporal (SC)** e × **protocolo quimioterápico**.
- Prontidão para a administração do dia seguinte, ligada à **Programação de amanhã** e ao **Rótulo bloqueado** (o rótulo só é liberado após a conferência humana). Ver CHECKLIST C5.

### 5b. Fluxo fictício "Maria"
1. Identificar a paciente pela foto (ex.: "Maria", fictícia).
2. Confirmar que ela existe no sistema com **≥ 2 identificadores** (ex.: nome completo + prontuário/data de nascimento). **Nunca criar paciente automaticamente**: sem correspondência ⇒ aviso e ação humana.
3. Identificar o protocolo.
4. Conferir as doses com a massa corporal/SC.
5. Cada conferência aprovada fica com **"conferido" em verde**; as divergências ficam sinalizadas.

### 5c. Tela de conferência
- Dados do paciente; protocolo (ex.: **FOLFOX**); por medicamento (ex.: **5-FU**), conferência de dose de ataque/carga com estado **ok / divergente**.
- A IA **sugere** a ordem de manipulação e a ordem de infusão (rascunho, a ser validado).
- Divergência ⇒ mostrar (1) a divergência concreta (valor encontrado × esperado), (2) a regra/fonte que a fundamenta, (3) a correção sugerida ou o próximo passo (ex.: **solicitação ao médico, M15.5**). **Nunca correção automática.**

### 5d. Conferência de diluição (por medicamento)
- Diluente, volume, concentração final e estabilidade, cada um ok/divergente com a fonte.

### 5d-bis. Volume a aspirar (mL) por medicamento/rótulo, com a regra de três na tela
- Para cada medicamento/rótulo, o sistema mostra o **volume em mL a aspirar** e o cálculo por regra de três. Ex.: dose prescrita 30 mg e concentração da bula X mg/mL ⇒ **30 ÷ X = Y mL**.
- A concentração vem da **bula do produto registrado na Anvisa/apresentação selecionada** (nome comercial, fabricante, apresentação).
- A tela mostra as entradas (dose, unidade, concentração, apresentação), a fonte, a **regra de arredondamento** aplicada e o valor antes e depois do arredondamento.
- Sinaliza quando o volume passa do frasco e informa **quantos frascos/apresentações** são necessários.
- **Exibição só auxiliar**: nada é aplicado automaticamente; a validação final é do farmacêutico.

### 5f. Card bula Anvisa × guia Einstein, estabilidade da bolsa e overfill
- Por fármaco, um card cruza a bula Anvisa e o guia Einstein com estado **bate / diverge / falta**, citando a fonte de cada campo (ver `REFERENCIA_BULAS_ANVISA_QUIMIOTERAPICOS.md` §3).
- Estabilidade da bolsa (temperatura, luz, tempo) e **overfill** da bolsa/diluente considerados no volume final e na concentração.

### 5g. (Novo) Tela por fármaco
- Uma tela por fármaco com validação (Validar/Desvalidar), **tempo de infusão** e **ordem** (manipulação e infusão) sugeridos pela IA como rascunho.

### 5h. (Novo) Botão "Próximo passo"
- Avança para o próximo fármaco/conferência pendente; diante de divergência, leva ao próximo passo indicado (ex.: solicitação ao médico, M15.5). Nunca valida sozinho.

### 5i. (Novo) Etiqueta por medicação com dose em mL
- Prévia da etiqueta de cada medicação com a dose em mg **e o volume em mL** (5d-bis), diluente e volume final; continua como **Rótulo bloqueado** até a validação do farmacêutico (ver CHECKLIST C5).

### 5e. Fontes
- **Primária (alinhada à Anvisa):** bulas registradas na Anvisa (Bulário Eletrônico) e protocolos oncológicos de alto nível adotados no Brasil (normas Anvisa/MS, DDT/PCDT de oncologia do Ministério da Saúde).
- **Complementar:** NCCN, ESMO e protocolos institucionais.
- Referência de bulas: [`REFERENCIA_BULAS_ANVISA_QUIMIOTERAPICOS.md`](REFERENCIA_BULAS_ANVISA_QUIMIOTERAPICOS.md) (em elaboração por outro trabalho).

## 6. (Proposto) Anotação com caneta/dedo na foto e na tela de conferência
- Camada de anotação sobre a foto da prescrição e sobre a tela de conferência (5c).
- Técnica: sobreposição HTML canvas/SVG com **Pointer Events API** (`pointerType` `pen`, `pressure`); rejeição da palma ignorando `touch` enquanto a caneta estiver ativa. Alvos: **Safari iPadOS + Apple Pencil** e **Chrome Android + stylus**.
- Os traços são salvos como **JSON vetorial**, ligados à versão do rascunho, com autor e horário na trilha de auditoria.
- A anotação é **nota do farmacêutico** e **nunca altera o conteúdo da prescrição**. Há exportação de imagem achatada para registro.
- Hoje: a página é responsiva (alvos ≥ 44 px), mas **não tem desenho**.
- Marco: junto da UI da fase A (continuação do PR #15), com dados fictícios.

## 7. (Aprovado) Código de barras/QR na etiqueta e leitura do frasco/bolsa no preparo
- **Duas fontes de leitura, com o mesmo fluxo de conferência:**
  1. **QR gerado pelo sistema** na etiqueta do frasco (5i).
  2. **Código de barras ORIGINAL do fabricante** na embalagem/frasco (EAN-13 / GS1 DataMatrix com GTIN, lote, validade).
  - Nas duas: GTIN → registro Anvisa na base → comparação com a prescrição e com a etapa do protocolo.
- No preparo, o farmacêutico lê o frasco/bolsa físico: **GS1 DataMatrix/EAN** (GTIN, lote, validade; **SNCM/IUM** quando aplicável), pela câmera (**BarcodeDetector API**, com fallback **zxing**) ou por leitor USB/Bluetooth.
- O sistema mapeia **GTIN → registro Anvisa** do produto cuja bula está na base e compara com a prescrição e com a etapa do protocolo.
- Se bater, a etapa é liberada para continuar (a liberação final segue humana). Produto diferente, validade vencida ou lote errado ⇒ **alerta imediato**, registrado na auditoria.
- Na demonstração, só dados fictícios.

## Checklist (vivo)
Checklist mestre: [`CHECKLIST_PLANEJAMENTO_COMPLETO.md`](CHECKLIST_PLANEJAMENTO_COMPLETO.md).
- [ ] **1. Foto → versão online editável (fase A):** *PARCIAL*. PR #15 (rascunho), `/clinical/prescricao-foto`, dados fictícios. Falta: respostas Q1–Q4 (`docs/decisoes-provisorias-prescricao-foto.md`) e merge. Ref.: `spec-validacao-prescricao` etapa 1, Plano Diretor v3 §4.2 #6.
- [ ] **2. Criação automática só pela foto:** *FALTA*, fase B (M20 proposto). Falta: OCR/transcrição com confiança por campo, sempre rascunho validado item a item, a IA não decide. Bloqueado: fase B (HNSG/contrato/AWS SP/repositório privado, D-010/D-011) e RDC 657/2022. Ref.: D-005, D-013, `RF_PRESCRICAO_ASSISTIDA_IA.md`.
- [ ] **3. Prescrição existente como documento editável:** *FALTA*, M19 (proposto). Falta: página documento, versões imutáveis (autor/hora/diff), RBAC/ABAC + RLS. Bloqueado: quem edita o quê. Ref.: §3 papéis, D-012 (M15.5).
- [ ] **4. Cuidado regulatório:** *PENDENTE*. A autoria do conteúdo é do prescritor; o farmacêutico só valida, observa e intervém via M15.5. Falta: enquadramento SaMD (RDC 657/2022), assinatura ICP-Brasil se o documento for oficial, LGPD/RIPD. Ref.: D-013, LACUNAS §8–9.
- [ ] **5. Conferência assistida e biblioteca:** *FALTA*, M18/M19 (biblioteca mínima); com dado real, só na fase B. Ref.: spec etapas 2–3, CHECKLIST C5/N3, D-005.
  - [ ] 5a. Lado a lado com a foto + conferência de dose × peso/SC × protocolo
  - [ ] 5a. Prontidão para amanhã ligada à Programação de amanhã / Rótulo bloqueado (C5)
  - [ ] 5b. Fluxo fictício "Maria": identificar paciente pela foto, ≥ 2 identificadores, nunca criar automaticamente
  - [ ] 5b. Identificar protocolo; conferir massa corporal/SC; "conferido" verde por conferência; divergências sinalizadas
  - [ ] 5c. Tela: dados do paciente, protocolo (FOLFOX), dose de ataque por medicamento (5-FU) ok/divergente
  - [ ] 5c. IA sugere ordem de manipulação e de infusão (rascunho)
  - [ ] 5c. Divergência = valor concreto + regra/fonte + correção sugerida/próximo passo (M15.5); nunca correção automática
  - [ ] 5d. Diluição por medicamento: diluente, volume, concentração final, estabilidade
  - [ ] 5d-bis. Volume em mL por medicamento/rótulo, com a regra de três visível (dose ÷ concentração = mL)
  - [ ] 5d-bis. Concentração da bula do produto registrado/apresentação selecionada; entradas e fonte exibidas
  - [ ] 5d-bis. Regra de arredondamento explícita (valor antes e depois)
  - [ ] 5d-bis. Alerta de volume acima do frasco + nº de frascos/apresentações; só auxiliar, validação final do farmacêutico
  - [ ] 5f. Card bula Anvisa × guia Einstein (bate/diverge/falta) por fármaco
  - [ ] 5f. Estabilidade da bolsa e overfill no volume/concentração final
  - [ ] 5g. (Novo) Tela por fármaco: validação, tempo de infusão, ordem
  - [ ] 5h. (Novo) Botão "Próximo passo" (sem validação automática)
  - [ ] 5i. (Novo) Etiqueta por medicação com dose em mL; Rótulo bloqueado até a validação
  - [ ] 5e. Fontes: Anvisa (bulas) + protocolos adotados no Brasil; complementar NCCN/ESMO/institucional; `REFERENCIA_BULAS_ANVISA_QUIMIOTERAPICOS.md`
  - [ ] 5e. Pendências: fontes e licenciamento (NCCN/ESMO exigem licença), carga versionada, validação farmacêutica do Henrikael
  - [ ] Liberação final sempre do farmacêutico/médico; fase B bloqueada até protocolos carregados e validados
- [ ] **6. (Proposto) Anotação caneta/dedo:** *FALTA*, continuação do PR #15 (fase A, fictícia). Ref.: Q4 iPad/Safari (`docs/decisoes-provisorias-prescricao-foto.md`), D-005.
  - [ ] Componente de sobreposição canvas/SVG com Pointer Events (pen/pressure, rejeição da palma)
  - [ ] Esquema de armazenamento + migração (traços JSON vetorial por versão do rascunho, autor/horário)
  - [ ] RLS por organização + trilha de auditoria
  - [ ] Anotação nunca altera a prescrição; exportação de imagem achatada
  - [ ] Testes em iPad real (Safari + Apple Pencil) e Android real (Chrome + stylus)
- [ ] **7. (Aprovado) Código de barras/QR + leitura do frasco/bolsa:** *FALTA*, M19 (fictício na demonstração). Ref.: 5i, C5 (Rótulo bloqueado), 5e (bulas na base).
  - [ ] Geração de QR/código na etiqueta
  - [ ] Componente de leitura (BarcodeDetector + zxing; leitor USB/BT)
  - [ ] Leitura do código ORIGINAL do fabricante (EAN-13/GS1 DataMatrix: GTIN, lote, validade) → registro Anvisa → mesmo fluxo de conferência
  - [ ] Tabela GTIN ↔ registro Anvisa (produto com bula na base)
  - [ ] Lógica de conferência da etapa (prescrição + etapa do protocolo; GTIN/lote/validade/SNCM-IUM)
  - [ ] Alerta imediato + auditoria de cada leitura
  - [ ] Testes (unit, E2E com códigos fictícios, aparelho real)

## Consolidação validada em 21/10/2026
Código conferido no branch `m18-prescricao-foto-provisoria`: `apps/clinical-web/app/clinical/prescricao-foto/page.tsx`, `components/clinical/PrescricaoFoto.tsx`, `lib/prescricao-ficticia.ts`; **sem API nem migração** de prescrição por foto (só `medical-requests` do M15.5). Não liberado para uso clínico.

| Item | Descrição | Onde está no doc | O que falta no código | Marco | Bloqueado? |
|---|---|---|---|---|---|
| 1 | Foto → versão online editável | §1, 5a | Página `/clinical/prescricao-foto` só com dados fictícios fixos (`lib/prescricao-ficticia.ts`); itens **não editáveis**; sem upload de foto, API ou tabela | M18 (PR #15) | Q1–Q4 provisórias |
| 2 | Criação automática, sempre rascunho | §2 | Inexistente: sem OCR/transcrição, sem modelo de rascunho | Fase B (M20) | Sim (fase B, Anvisa) |
| 3 | Prescrição existente como documento com histórico | §3 | Inexistente: `clinical_medication_orders` só leitura (`RecordTab.tsx`); sem versões/diff | M19 | Sim (quem edita) |
| 4 | Alterar a prescrição é do médico | §4 | Regra documentada; o fluxo de solicitação existe (M15.5 `medical-requests.controller.ts`) mas não está ligado à página | M19 | Sim (regulatório) |
| 5b | Identificação por ≥ 2 identificadores, sem criar cadastro | 5b | Inexistente: nome fixo fictício, sem busca/correspondência de paciente | M18/M19 | Não |
| 5a | IA confere protocolo e dose × massa corpórea (verde/divergência) | 5a, 5b | Só estados manuais verde/âmbar/riscado; sem cálculo de SC, dose ou protocolo | M19 | Sim (protocolos validados) |
| 5c | Sugere ordem de manipulação e infusão | 5c, 5g | Inexistente (só texto fixo de sugestão) | M19 | Sim |
| 5c | Aponta problema concreto + regra e sugere correção | 5c | Inexistente; sem motor de regras de dose | M19 | Sim |
| 5d | Confere diluição | 5d | Inexistente | M19 | Sim |
| 5e | Base Anvisa prioritária (bulas + MS); internacionais como complemento | 5e | Só documental (`REFERENCIA_BULAS_ANVISA_QUIMIOTERAPICOS.md`, bulas em coleta); nada carregado no código | M18/M19 | Sim |
| 5f | Card bula Anvisa × guia Einstein (bate/diverge/falta) | 5f | Cards 5-FU/oxaliplatina só no documento de referência §3; nenhuma UI | M19 | Sim (Einstein inacessível; licença) |
| 5f | Estabilidade da bolsa e overfill | 5f | Inexistente | M19 | Sim |
| 5g | (Novo) Tela por fármaco com validação, tempo de infusão e ordem | 5g | Validação existe só por campo genérico; sem tempo de infusão/ordem | M19 | Não (UI fictícia possível) |
| 5h | (Novo) Botão "Próximo passo" | 5h | Inexistente | M18 (continuação do PR #15) | Não |
| 5i | (Novo) Etiqueta por medicação com dose em mL | 5i | Inexistente | M19 | Sim (critérios de conferência) |
| 5d-bis | Regra de três (mL a aspirar) | 5d-bis | Inexistente | M19 | Sim (concentrações validadas) |
| 6 | Caneta/dedo | §6 | Inexistente: sem canvas/Pointer Events, sem tabela/RLS | M18 (continuação do PR #15) | Não |
| — | Fase B bloqueada | §2, §4 | Cumprido: `FASE_B_HABILITADA=false`, `readyForClinicalUse=false` | — | Sim |
| 5e | Pendências: fontes, carregar protocolos, validar | 5e, checklist | Nenhuma carga/validação; nenhum dado em `clinical_protocol_versions` para esses esquemas | M18/M19 | Sim (Henrikael) |
| 7 | (Aprovado) Duas fontes de leitura (QR do sistema na etiqueta + código original do fabricante EAN-13/GS1), mesmo fluxo de conferência | §7 | Inexistente: geração de QR, componente de leitura, tabela GTIN↔registro, lógica de conferência da etapa, auditoria, testes | M19 | Não (fictício); dados reais = fase B |
