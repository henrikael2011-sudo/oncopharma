# ONCOPHARMA — PLANO DIRETOR DO PRODUTO
**Versão:** 3.0 • **Data:** 10/10/2026 • **Estado:** baseline de planejamento; produto ainda não homologado para uso assistencial

> **Propósito deste documento:** ser a fonte única de verdade sobre escopo, identidade visual, funcionamento, regras clínicas, arquitetura, prioridades e critérios de entrega. Decisões novas devem atualizar este arquivo e o registro de decisões, nunca ficar apenas dispersas em conversas.

## 0. RESUMO EXECUTIVO
O ONCOPHARMA será uma plataforma PWA de acompanhamento oncológico com duas experiências de usuário — **ONCOPHARMA Care** (paciente/cuidador) e **ONCOPHARMA Clinical** (equipe multiprofissional) — apoiadas por serviços internos de **Intelligence** (correlação e apoio à decisão) e **Admin** (governança, usuários, protocolos e integrações). O diferencial é transformar dados fragmentados em **avaliações clínicas acionáveis, justificadas e rastreáveis**, sem prescrever, alterar terapia ou encerrar alertas automaticamente.

**Produto real desde a fundação:** backend, banco, autenticação, controle de acesso, versionamento, testes e ambientes segregados. Os dois pacientes usados na implementação serão inteiramente sintéticos; produção nasce vazia. A implantação clínica exige validação, segurança, enquadramento regulatório e operação assistencial definidos.

## 1. DECISÕES APROVADAS E LIMITES
| ID | Decisão | Situação |
|---|---|---|
| D-001 | Uma plataforma PWA responsiva, com código e infraestrutura de produção | Aprovada |
| D-002 | Duas interfaces: Care simples e Clinical multiprofissional | Aprovada |
| D-003 | Marca principal ONCOPHARMA, sub-marcas Care e Clinical | Aprovada |
| D-004 | Identidade verde-esmeralda, azul-petróleo e dourado, fundos escuros e versões claras acessíveis | Direção aprovada; arte final vetorial pendente |
| D-005 | IA explica correlações e propõe opções fundamentadas; decisão humana obrigatória | Aprovada |
| D-006 | 1–2 pacientes sintéticos em DEV/HML; produção sem dados de teste | Aprovada |
| D-007 | Integração Tasy/MV/FHIR apenas mediante autorização, contrato e validação técnica | Princípio aprovado |
| D-008 | Hospedagem, provedor de login, instituição-piloto e modelo de operação de alertas | Em aberto |
| D-013 | Rascunho de prescrição assistido por IA (fase posterior): IA identifica problema relacionado à quimioterapia, sugere medicação conforme protocolo, médico confirma, IA gera prescrição-rascunho (somente medicamentos com registro Anvisa, ordem de infusão, dose calculada por regras determinísticas a partir de dados registrados), médico confirma de novo, imprime e assina. Ver `RF_PRESCRICAO_ASSISTIDA_IA.md` | Aprovada (registro); implementação bloqueada até pré-requisitos: enquadramento Anvisa, validação clínica, integração com prontuário oficial — *Emenda D-013, 11/10/2026* |

**Fora de escopo da primeira liberação:** prescrição automática, liberação de ciclos, mudança de doses sem profissional, atendimento emergencial 24h sem equipe real, diagnósticos autônomos e integração não autorizada com prontuários.

> **Emenda D-013, 11/10/2026:** o texto acima permanece válido para a primeira liberação. Em **fase posterior**, a D-013 prevê *rascunho* de prescrição assistido por IA — não prescrição automática: nenhuma prescrição é gerada sem confirmação médica; cada confirmação do médico fica registrada na auditoria; o documento final só vale após impressão e assinatura do médico. A IA produz documento, não decide. Implementação bloqueada até enquadramento Anvisa (SaMD), validação clínica e integração autorizada com o prontuário/sistema oficial.

## 2. IDENTIDADE VISUAL E SISTEMA DE DESIGN
### 2.1 Marca e conceito
- **ONCOPHARMA:** marca-mãe de tecnologia, oncologia, inteligência clínica e cuidado humano.
- **Care:** símbolo de **casa + acolhimento + pessoas/coração**; comunicar segurança e simplicidade, sem infantilização do idoso.
- **Clinical:** símbolo de **bolsa de infusão oncológica + referência clínica**, com desenho estilizado; não confundir bolsa de quimioterapia com bolsa de sangue, nem sugerir que todo tratamento é infusional.
- **Intelligence:** nome de módulo interno; não precisa de terceira marca de consumo nesta etapa.
- **Assinatura institucional proposta:** “Inteligência para um cuidado mais seguro”. Care pode usar “Um passo de cada vez. Juntos no cuidado.”
- A arte aprovada na conversa é uma **referência conceitual raster**, não um arquivo vetorial final. Criar logotipos vetoriais SVG, versões horizontal/vertical, ícone monocromático, favicon, splash e manual de marca antes do lançamento.
- **Não aplicar o símbolo ®** sem confirmação de registro da marca; verificar disponibilidade de marca e domínio antes de uso comercial.

### 2.2 Tokens visuais iniciais (sujeitos à extração da arte final)
| Token | HEX proposto | Uso |
|---|---|---|
| brand.deepTeal | #063F3B | Marca, navegação Care, fundos escuros |
| brand.emerald | #15735D | Ações principais Care e sucesso não clínico |
| brand.navy | #0A344A | Clinical, navegação e painéis técnicos |
| brand.gold | #D7A858 | Acentos e detalhes; nunca único indicador de prioridade |
| brand.mint | #B9E1D0 | Apoio e superfícies suaves |
| neutral.canvas | #F5F8F7 | Fundo claro acessível |
| neutral.ink | #152C32 | Texto em fundo claro |
| danger | #B42318 | Alertas críticos, sempre com texto/ícone |

**Regras de interface:** contraste WCAG 2.2 AA como meta, alvos de toque amplos, sem texto sobre gradientes de baixo contraste, componentes reutilizáveis, estados de foco/erro/carregamento/vazio e modo escuro/claro testados. As cores clínicas de gravidade não se confundem com a paleta de marca.

### 2.3 Diretrizes por público
| Care | Clinical |
|---|---|
| Linguagem cotidiana; um objetivo por tela | Densidade de dados controlada e filtros |
| Botões grandes, alto contraste e leitura fácil | Visão longitudinal, origem dos dados e trilha de decisão |
| Perguntas curtas, resposta por toque, leitura por voz opcional | Tabelas, indicadores, tarefas e alertas priorizados |
| Sempre explicar o próximo passo | Mostrar incerteza, dados faltantes e referência clínica |
| Sem dose ou automedicação sugerida ao paciente | Sugestões condicionais apenas para revisão habilitada |

> **Emenda UI, 11/10/2026 (requisitos de interface definidos por Henrikael):** complementa a tabela acima, sem revogá-la. Detalhes em `docs/diretrizes-design.md`.
> 1. **Care (paciente/cuidador em casa):** bem facilitado e simples — letra grande, alto contraste, **um passo por tela**, botões grandes.
> 2. **Clinical/hospitalar:** mais opções, mas **sem poluir a tela** — somente informações essenciais visíveis; detalhes sob demanda (expandir, abrir, aba).
> 3. **Privacidade na tela:** dados do paciente **só aparecem ao clicar no paciente**. Lista/painel mostra apenas o mínimo para identificar e priorizar (nome/identificação segura, alerta/gravidade, pendência) — **nunca o detalhe de todos os pacientes ao mesmo tempo**.
> 4. **Busca de pacientes (Clinical):** barra de busca para localizar pacientes por identificação segura, retornando apenas pacientes permitidos pelo vínculo assistencial/ABAC.
> 5. **Organização por alocação hospitalar (Clinical):** pacientes agrupados por unidade/andar/quarto/leito, alocação puxada do sistema hospitalar por botão **Sincronizar** (via `integration-gateway`; FHIR `Location`/`Encounter.location` ou HL7 ADT A01/A02/A03), exibindo origem e horário da última sincronização.
> 6. **Alocação manual (fallback):** se o hospital não fornecer alocação, preenchimento manual permitido, marcado como **manual**, com autor e hora na auditoria; dado sincronizado prevalece e o sistema avisa conflito. Integração real segue D-007 (somente com autorização); antes disso, usa o simulador.

## 3. PERSONAS, PAPÉIS E PERMISSÕES
**Paciente:** relata sintomas, consulta orientações aprovadas, vê sua própria jornada e pode conceder acesso ao cuidador. **Cuidador:** vê somente o escopo autorizado e revogável. **Farmacêutico:** reconciliação, validação farmacoterapêutica, intervenções e monitoramento. **Enfermagem:** registro de sinais, administração, evolução e triagem conforme competências. **Médico:** decisões diagnósticas e terapêuticas e prescrição. **Gestor clínico:** filas, indicadores, protocolos e auditoria. **Administrador técnico:** usuários, infraestrutura e integração; não ganha acesso irrestrito a dados clínicos por padrão.

| Recurso | Paciente | Cuidador | Farmacêutico | Enfermagem | Médico | Admin |
|---|---|---|---|---|---|---|
| Registrar sintomas | Próprio | Conforme autorização | Consulta | Consulta | Consulta | Não |
| Ver histórico clínico | Recorte permitido | Recorte autorizado | Vínculo assistencial | Vínculo assistencial | Vínculo assistencial | Não por padrão |
| Revisar alerta | Não | Não | Sim | Conforme atribuição | Sim | Não |
| Propor intervenção farmacêutica | Não | Não | Sim | Não | Conforme atribuição | Não |
| Prescrever/alterar terapia | Não | Não | Não via sugestão de IA | Não | Conforme habilitação e sistema oficial | Não |
| Aprovar protocolo institucional | Não | Não | Papel designado | Papel designado | Papel designado | Gestão de fluxo, não aprovação clínica |

> **Emenda D-013, 11/10/2026 (fase posterior):** a linha "Prescrever/alterar terapia" permanece vigente. Quando a D-013 for liberada, o **Médico** poderá partir de um rascunho de prescrição gerado pela IA, sempre com dupla confirmação (sugestão e rascunho), registro de cada confirmação na auditoria, dupla checagem farmacêutica, impressão e assinatura do médico (ICP-Brasil se eletrônica). Paciente, cuidador, enfermagem, farmacêutico e admin continuam sem prescrever via sugestão de IA.

**Controle de acesso:** RBAC + regras contextuais ABAC (organização, unidade, equipe assistencial, consentimentos, finalidade e emergência auditada). MFA para profissionais, sessões expiráveis e segregação por instituição.

## 4. MAPA DE PRODUTO E NAVEGAÇÃO
### 4.1 ONCOPHARMA Care
1. **Boas-vindas e acesso:** identificação segura, consentimentos, preferência de acessibilidade, cuidador.
2. **Início:** “Como você está hoje?”, próximo ciclo/consulta, lembretes, acesso visível a ajuda.
3. **Registrar sintoma:** questionário adaptativo; duração, intensidade, início, sinais de alerta; confirmação do registro.
4. **Minha jornada:** tratamento/ciclos e histórico de sintomas em linguagem simples; dados sincronizados autorizados.
5. **Meus medicamentos:** exibir prescrição validada, horários e orientações aprovadas; registrar adesão relatada, sem alterar dose.
6. **Mensagens e orientações:** apenas canal institucional real, com horários e expectativa de resposta explícitos.
7. **Preciso de ajuda:** orientação de urgência imediata para sinais críticos; contatos reais configurados, sem falsa promessa de monitoramento.
8. **Cuidador e privacidade:** autorização granular, prazo, revogação, histórico de acessos.

### 4.2 ONCOPHARMA Clinical
1. **Painel:** pacientes vinculados, fila de alertas, tarefas, pré-ciclos, pendências de revisão.
2. **Pacientes:** busca com identificação segura e filtros por serviço, protocolo, ciclo, gravidade e pendência.
3. **Prontuário longitudinal:** diagnóstico, estadiamento, biomarcadores, alergias, comorbidades, medicamentos, exames, prescrições, administrações, evoluções, sintomas e fontes.
4. **Avaliação pré-ciclo:** checklist com dados disponíveis/ausentes, evolução de toxicidades, parâmetros de protocolo e parecer do profissional.
5. **Inteligência Clínica:** hipóteses de associação, justificativas, alternativas condicionais, diretrizes e evidências, contraindicações e lacunas.
6. **Intervenções:** registrar avaliação, aceitação/ajuste/rejeição de sugestão, encaminhamento, responsável, prazo e desfecho.
7. **Protocolos:** versões vigentes, critérios de aplicação, suporte antiemético, segurança da administração e referências.
8. **Indicadores:** adesão ao acompanhamento, tempo até revisão, eventos, intervenções, resolutividade, falsos positivos e qualidade dos dados.
9. **Admin:** profissionais, equipes, permissões, políticas, conectores, trilhas, biblioteca clínica e configurações de serviço.

## 5. COMPORTAMENTO PADRÃO DE CADA FUNCIONALIDADE
| Evento | Entrada | Ação do sistema | Resultado visível | Responsável/registro |
|---|---|---|---|---|
| Paciente registra sintoma | Questionário | Valida, salva, identifica sinais críticos por regras | Confirmação, orientação segura, status de envio | Paciente; data/hora/origem |
| Dado hospitalar chega | FHIR/HL7/API autorizada | Autentica, reconcilia paciente, deduplica, normaliza, preserva origem | Linha do tempo atualizada ou erro de integração | Integração; provenance e audit |
| Possível toxicidade | Sintomas + protocolo + administração + exames | Regras determinísticas, depois correlação explicativa da IA | Alerta, justificativa, evidências e lacunas | Equipe clínica; status aberto |
| Sugestão de suporte | Sintoma + risco + antieméticos + alergias + exames | Consulta protocolos versionados e restrições | Opções de avaliação, nunca ordem médica automática | Profissional aceita/ajusta/rejeita |
| Rascunho de prescrição (D-013, fase posterior — *Emenda D-013, 11/10/2026*) | Sugestão aceita pelo médico + peso/altura/função renal/hepática registrados + protocolo institucional versionado | Regras determinísticas de dose (limites, ajuste renal/hepático, superfície corporal); somente medicamentos com registro Anvisa | Rascunho de prescrição com ordem de infusão — nunca ordem médica automática | Médico confirma (2ª vez), imprime e assina; farmacêutico faz dupla checagem; cada confirmação auditada |
| Revisão profissional | Alerta ou pré-ciclo | Exige ação explícita e registra justificativa | Plano, encaminhamento, prazo e status | Identidade profissional + trilha |
| Encaminhamento | Intervenção validada | Cria tarefa, atribui equipe e confirma entrega | Pendente, recebido, em avaliação, resolvido | Destinatário e timestamps |
| Dados insuficientes | Ausência de exame/medicação/registro | Bloqueia conclusão indevida; solicita verificação | “Não é possível concluir” + dado faltante | Auditoria de incerteza |
| Alerta crítico | Febre em quimioterapia ou outro sinal de urgência conforme regra aprovada | Orientação imediata ao paciente; escalonamento institucional configurado | Mensagem inequívoca e canal de urgência | Registro e eventual equipe 24h real |

### 5.1 Estados de alerta
**Detectado → Aguardando revisão → Em avaliação → Encaminhado → Em acompanhamento → Resolvido**; alternativas **Descartado com justificativa** e **Duplicado vinculado**. Escalonamento por SLA institucional, sem encerrar automaticamente por tempo. Registrar tentativas de contato e confirmação de recebimento.

### 5.2 Exemplo: náusea leve (hipotético)
O sistema coleta início/intensidade, número de episódios de vômito, hidratação, ingestão, risco de desidratação, tempo em relação ao ciclo, esquema emetogênico, profilaxia e resgate prescritos/administrados, alergias, interações, QT prolongado e outros fatores pertinentes. Consulta diretrizes e protocolo local vigentes; pode apresentar **ondansetrona como uma das opções a avaliar quando apropriado**, sem assumir que será suficiente ou segura para qualquer paciente. O profissional verifica necessidade, dose, via, contraindicações e prescrição no sistema oficial. Para o paciente, exibir apenas orientação validada, não recomendação autônoma de medicamento.

### 5.3 Exemplo: FOLFOX e neuropatia (hipotético)
Cruzar relato de parestesia/sensibilidade ao frio, evolução da enfermagem, datas de administração de oxaliplatina, progressão entre ciclos e critérios de toxicidade; apontar **possível associação**, não causalidade confirmada. Apresentar evidências e solicitar avaliação da equipe; decisões sobre dose/ciclo ficam com responsáveis habilitados.

## 6. INTELIGÊNCIA CLÍNICA: PRINCÍPIOS TÉCNICOS
**Pipeline:** coleta autorizada → normalização → validação de completude → regras de segurança → correlação contextual por IA → busca em referências aprovadas (RAG) → verificação estruturada → apresentação ao profissional → decisão e acompanhamento.

- **Regras clínicas determinísticas** são a primeira linha para gatilhos críticos, limites laboratoriais e contraindicações configuradas; LLM não pode suprimir alerta crítico.
- **IA generativa** resume registros e explica possíveis relações, mas nunca deve inventar exame, dose, referência ou resultado; campos ausentes permanecem ausentes.
- Cada sugestão traz: hipótese, confiança/limitações qualitativas, evidências de paciente com origem e horário, referência clínica com versão/data, alternativas e verificações necessárias.
- Não usar uma porcentagem de “confiança” não calibrada como probabilidade clínica.
- Prompts, modelos, regras, protocolos e resultados são versionados; testes de regressão obrigatórios após mudança.
- Avaliar desempenho por cenário, gravidade, sensibilidade, especificidade, PPV, falsos negativos, equidade e fadiga de alertas; manter revisão humana.
- Conteúdo clínico: biblioteca aprovada pela instituição, com revisão periódica e rastreio de mudanças; não tratar pesquisa na internet como protocolo automaticamente vigente.

## 7. DADOS, INTEGRAÇÃO E FONTE OFICIAL
**Prontuário hospitalar é fonte oficial** para ordens, evoluções e administrações nele registradas; ONCOPHARMA armazena dados derivados, relatos do paciente, pareceres e trilhas, sem duplicar documentação desnecessariamente. Integrações são preferencialmente bidirecionais apenas quando houver contrato, mapeamento e autorização para escrita; na primeira fase, leitura autorizada e escrita restrita ao próprio ONCOPHARMA.

**Entidades nucleares:** Organization, Facility, User, Role, CareTeam, Patient, PatientIdentifier, Consent, RelatedPerson/CaregiverAccess, Encounter, Diagnosis, CancerStage, Biomarker, Regimen/Version, TreatmentCycle, MedicationOrder, MedicationAdministration, MedicationStatement, AllergyIntolerance, LabResult, Observation, SymptomReport, QuestionnaireResponse, ClinicalNote, Source/Provenance, Alert, Suggestion, GuidelineReference, Intervention, ReviewDecision, Task, Notification, AuditEvent, IntegrationJob.

**Integrações-alvo:** FHIR R4 (Patient, Encounter, Observation, Condition, MedicationRequest, MedicationAdministration, AllergyIntolerance, CarePlan, Provenance, AuditEvent etc. conforme perfis acordados), HL7 v2, APIs proprietárias Tasy/MV quando disponíveis. Identificadores, unidades, terminologias, fuso horário, duplicatas, conflitos, erros e reconciliação são requisitos de projeto.

## 8. SEGURANÇA, PRIVACIDADE E CONFORMIDADE
- LGPD: controlador e operadores definidos, base legal adequada para dados sensíveis, minimização, retenção, direitos, RIPD conforme avaliação, contratos e incidentes.
- Criptografia em trânsito e repouso; chaves/segredos gerenciados; backups restauráveis testados; política de recuperação de desastre.
- Autenticação forte, MFA para equipe, menor privilégio, trilhas auditáveis e revisão de acessos.
- Segregação de ambientes e instituições; logs sem dados clínicos desnecessários; monitoração de disponibilidade e segurança.
- Avaliação formal do enquadramento regulatório aplicável ao software como dispositivo médico (SaMD), inclusive regras Anvisa pertinentes, antes do piloto assistencial.
- Política de segurança do paciente, protocolos revisados por responsáveis clínicos, testes de casos de risco, revisão de incidentes e plano de contingência quando a IA/integração falhar.
- Alertas de urgência requerem fluxo operacional real, responsáveis, horário de cobertura e escalonamento; se não houver cobertura, orientar contato com urgência sem insinuar monitoramento contínuo.

## 9. ARQUITETURA DE ENGENHARIA
**Frontend:** Next.js + TypeScript + PWA; design system compartilhado e rotas Care/Clinical com layouts próprios. **Backend:** NestJS + TypeScript, API versionada/OpenAPI, validação e jobs assíncronos. **Banco:** PostgreSQL, migrações e segregação por organização. **Filas/cache:** Redis quando necessário; não como fonte oficial de dados. **Arquivos:** storage privado criptografado. **Identidade:** OIDC/OAuth2 com MFA. **Integrações:** adaptadores FHIR/HL7/API. **IA:** serviço isolado com RAG, auditoria e políticas de dados. **Observabilidade:** métricas, logs, tracing, alertas e relatórios de auditoria. **Entrega:** monorepo, CI/CD, testes automatizados, infraestrutura declarativa, dev/homologação/produção independentes.

**Estrutura sugerida do repositório:**
```
oncopharma/
  apps/care-web/
  apps/clinical-web/
  apps/admin-web/
  services/api/
  services/clinical-rules/
  services/ai-orchestrator/
  services/integration-gateway/
  packages/design-system/
  packages/domain/
  packages/contracts/
  packages/clinical-content/
  infra/
  docs/architecture/
  docs/product/
  docs/decisions/
  tests/e2e/
```

## 10. ROADMAP POR ENTREGÁVEIS (SEM PRAZOS INVENTADOS)
| Marco | Entrega verificável | Dependência / critério de saída |
|---|---|---|
| M0 — Governança | Plano diretor, backlog, design tokens, ADRs, risco inicial | Decisões críticas registradas |
| M1 — Fundação | Monorepo, CI/CD, ambientes, login, MFA, perfis, banco e migrações | Testes de segurança/acesso e deploy reproduzível |
| M2 — Núcleo clínico | Paciente, protocolo, ciclo, exames, medicamentos, evoluções e proveniência | Dois pacientes sintéticos persistidos e auditáveis |
| M3 — Care | Check-in, histórico, ajuda, cuidador, acessibilidade | Testes com usuários e cenários críticos aprovados |
| M4 — Clinical | Dashboard, prontuário, pré-ciclo, fila, intervenção, tarefas | Fluxo completo de revisão e encaminhamento |
| M5 — Regras clínicas | Gatilhos, classificação, versionamento e testes | Casos de segurança validados por especialistas |
| M6 — Intelligence | Resumos e sugestões rastreáveis com RAG | Avaliação clínica offline, controles de alucinação |
| M7 — Integração | Gateway e simulador FHIR, reconciliação e falhas | Testes de sincronização e origem; integração real só autorizada |
| M8 — Preparação piloto | Privacidade, segurança, regulação, operação e validação | Aprovação formal antes de dados reais |

**Primeiro fluxo vertical completo:** um paciente sintético registra sintoma no Care → backend salva → regras classificam → Clinical exibe evento e origem → farmacêutico revisa → intervenção/tarefa registrada → paciente vê apenas orientação autorizada → auditoria permite reconstruir toda a sequência.

## 11. CENÁRIOS DE TESTE E LIMPEZA
- **Paciente sintético A:** FOLFOX, parestesia/sensibilidade ao frio, histórico de ciclos e registro de enfermagem.
- **Paciente sintético B:** AC-T, náusea e cenários separados de febre/sinal crítico; profilaxia antiemética e registro de administração sintéticos.
- DEV e HOMOLOGAÇÃO recebem seeds versionados, dados e credenciais fictícios; **produção nasce com banco vazio**, não por limpeza de dados de teste em ambiente real.
- Reset de testes é idempotente e limitado por ambiente, com confirmação e registro. Preservar esquema, código, conteúdo clínico aprovado e logs exigidos.
- Testar acessos indevidos, duplicatas, perda de rede, latência, alarmes críticos, alteração de protocolos, contraste, leitores de tela, teclado, zoom 200% e aparelhos pequenos.

## 12. DEFINIÇÃO DE PRONTO (DoD) PARA QUALQUER TELA OU MÓDULO
Uma funcionalidade só será marcada **CONCLUÍDA** se possuir: (1) objetivo e usuário definidos; (2) fluxo feliz e erros documentados; (3) contratos de API e validações; (4) permissões testadas; (5) estados loading/vazio/erro; (6) responsividade e acessibilidade; (7) persistência e auditoria quando aplicável; (8) testes unitários/integrados/E2E; (9) segurança/privacidade revisadas; (10) conteúdo clínico aprovado quando houver; (11) documentação atualizada; (12) aprovação do responsável do produto. Telas bonitas sem backend real não contam como entrega concluída.

## 13. CONTROLE DE MUDANÇAS — COMO NÃO NOS PERDEREMOS
- **Documento mestre:** este arquivo é a referência de escopo e comportamento.
- **Backlog rastreável:** cada funcionalidade tem ID, prioridade, dependências, critério de aceite e estado.
- **ADRs (Architecture Decision Records):** decisões técnicas com contexto, alternativas e consequências.
- **Matriz de rastreabilidade:** necessidade → tela → regra → API → teste → aprovação.
- **Changelog:** toda mudança importante registra data, autor, motivo, impacto e versão.
- **Versionamento:** 3.0 planejamento; próximas revisões 3.1, 3.2; releases do software terão versões próprias.
- **Não alterar decisões aprovadas silenciosamente:** mudanças de identidade, dados clínicos, fluxo de alertas e autonomia da IA exigem revisão explícita.

### 13.1 Modelo de ficha de funcionalidade
**ID / Nome / Público / Objetivo / Entradas / Fontes / Regras / Estados / Saídas / Quem valida / Segurança / Dependências / Casos de teste / Critérios de aceite / Status.**

### 13.2 Modelo de registro de decisão
**ADR-ID | Data | Contexto | Alternativas | Decisão | Justificativa | Impacto | Responsável | Estado.**

## 14. RISCOS, RESPONSÁVEIS E DECISÕES PENDENTES
| Tema | Risco se ignorado | Próxima decisão |
|---|---|---|
| Operação de alertas | Falsa expectativa de atendimento imediato | Quem monitora, quando e com qual SLA? |
| Responsabilidade clínica | Sugestões sem validação institucional | Comitê clínico e aprovadores de protocolos |
| Regulação | Implantação inadequada de SaMD | Avaliação regulatória formal |
| Prescrição assistida (D-013) — *Emenda D-013, 11/10/2026* | Rascunho de prescrição sem enquadramento SaMD, validação clínica ou regras CFM | Enquadramento Anvisa (RDC 657/2022, RDC 751/2022), validação clínica, integração com prontuário oficial |
| Integração hospitalar | Acesso indevido/inconsistência de dados | Instituição e fornecedores parceiros |
| Hospedagem | Segurança, custos e residência de dados | Provedor, região, contratos e orçamento |
| Marca | Uso indevido de ® e conflito de registro | Pesquisa de marca/domínio e arte final SVG |
| Modelo de negócio | Escopo e custos sem sustentabilidade | Piloto B2B hospitalar? licenciamento? |
| Equipe | Desenvolvimento sem revisão especializada | Papéis técnicos, clínicos, segurança e jurídico |

## 15. PRÓXIMAS AÇÕES CONCRETAS
1. Congelar esta **baseline v3.0** como ponto de partida, sujeita a revisão controlada.
2. Criar **design system v0.1** e logotipos finais vetoriais, com variações Care/Clinical, favicon e tokens.
3. Definir **M0/M1** em histórias de usuário e critérios de aceite detalhados.
4. Montar monorepo, backend, banco, login, ambientes e CI/CD.
5. Criar os dois pacientes sintéticos e o primeiro fluxo vertical completo, antes de expandir telas.
6. Escolher instituição-piloto e responsáveis por segurança/regulação/validação clínica antes de qualquer dado real.

---
**Nota de segurança:** ONCOPHARMA é um projeto de software clínico em planejamento. Exemplos de medicamentos, protocolos e toxicidades neste documento ilustram requisitos de produto, não constituem orientação terapêutica para pacientes. A arte de marca escolhida é referência visual, ainda sem arquivo vetorial final e sem comprovação de registro.
