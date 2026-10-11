# Diretrizes de design de interface — ONCOPHARMA

**Origem:** requisitos de interface definidos por Henrikael em 11/10/2026 (*Emenda UI, 11/10/2026* ao Plano Diretor v3, §2.3).
**Complementa:** `docs/product/PLANO_DIRETOR_V3_BASELINE.md` §2 e `docs/design/DESIGN-SYSTEM.md`. Não altera tokens de marca nem cores clínicas de gravidade.
**Status:** aprovado como diretriz; implementação por milestone, com critérios de aceite abaixo.

## 1. Care — paciente/cuidador em casa
Bem facilitado e simples.
- Letra grande (corpo mínimo equivalente a 18 px; suportar zoom 200% sem perda de conteúdo).
- Alto contraste (meta WCAG 2.2 AA; preferir AAA em textos principais).
- **Um passo por tela**: uma pergunta ou ação por vez, com "próximo passo" sempre explícito.
- Botões grandes (alvo de toque ≥ 48×48 px), rótulos em linguagem cotidiana.
- Sem dose, automedicação ou recomendação autônoma de medicamento para o paciente.

**Aceite:** fluxo de registro de sintoma concluível só com toques, uma decisão por tela; axe sem violações sérias/críticas; teste com zoom 200%.

## 2. Clinical — ambiente hospitalar
Mais opções, mas **sem poluir a tela**.
- Somente informações essenciais visíveis por padrão; detalhes sob demanda (expandir, abrir paciente, abas).
- Hierarquia clara: alerta/gravidade e pendências antes de dados secundários.
- Filtros e ações agrupados; evitar painéis simultâneos com muitos dados.

**Aceite:** tela inicial do Clinical mostra apenas lista priorizada + ações principais; detalhe só após interação.

## 3. Privacidade na tela — dados só ao clicar no paciente
- Dados clínicos do paciente **só aparecem ao clicar no paciente** (tela/painel de detalhe, com acesso auditado).
- A lista/painel mostra apenas o mínimo para identificar e priorizar: **nome/identificação segura, alerta/gravidade, pendência** (e localização, ver §5).
- **Nunca** exibir o detalhe de todos os pacientes ao mesmo tempo (sem grade de diagnósticos, medicamentos ou exames de vários pacientes).

**Aceite:** resposta da API de lista não contém campos clínicos detalhados; teste E2E confirma que detalhe exige seleção e gera evento de auditoria.

## 4. Busca de pacientes (Clinical)
- Barra de busca para localizar pacientes por identificação segura (nome, registro/prontuário, leito).
- Resultados restritos ao **vínculo assistencial / ABAC** (organização, unidade, equipe, atribuição); a busca não revela existência de pacientes fora do escopo.
- Resultado da busca segue a regra §3 (mínimo na lista; detalhe ao clicar).

**Aceite:** usuário sem vínculo recebe lista vazia (não 403 com indício de existência); teste RLS/ABAC cobre busca.

## 5. Organização por alocação hospitalar (Clinical)
- Pacientes agrupados por **unidade / andar / quarto / leito**.
- Alocação puxada do sistema hospitalar por botão **"Sincronizar"**, via `services/integration-gateway`:
  - FHIR R4: `Location` e `Encounter.location` (com `status`/`period`);
  - ou HL7 v2 ADT: A01 (admissão), A02 (transferência), A03 (alta).
- Exibir **origem** (sistema/integração) e **horário da última sincronização**; indicar falha/defasagem.
- Integração real segue **D-007** (somente com autorização, contrato e validação técnica). Antes disso, usar o **simulador** (`tools/synthetic-lab` / gateway sintético FHIR) com dados sintéticos.

**Aceite:** sincronização com simulador atualiza agrupamento; origem e horário visíveis; evento de auditoria por sincronização.

## 6. Alocação manual (fallback)
- Se o hospital não fornecer alocação, preenchimento **manual** permitido para papéis habilitados.
- Registro marcado como **"manual"**, com **autor e hora na auditoria**.
- Dado **sincronizado prevalece**; havendo divergência com valor manual, o sistema **avisa o conflito** (sem sobrescrever silenciosamente o histórico).

**Aceite:** alocação manual aparece com selo "manual"; sincronização posterior substitui e registra conflito na auditoria.

## Rastreabilidade
Itens UI-01..UI-06 registrados em `docs/product/MATRIZ_RASTREABILIDADE.md` (seção "Emenda UI / D-013, 11/10/2026").
