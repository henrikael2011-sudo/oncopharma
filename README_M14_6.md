# ONCOPHARMA — M14.6 / M15.5

## Diagnóstico
Base: `main` em `f64870b00a68cb28f877d4e88ab5c6669769b54d` (PR #10, M15.4c). A importação existente é de censo/alocação; prescrição/protocolo PDF permanece fora desta entrega. D-012 e P-SAM-1..4 aprovadas pelo responsável em 18/10/2026.

**Correções completas no PR #11, sem merge/deploy.** Branch `m14.6-m15.5-solicitacoes`. Execução [39187685667](https://github.com/henrikael2011-sudo/oncopharma/actions/runs/39187685667), commit `164135c0175bc0c96f33f03a2b86ae20523e78f8`: integration e unit-and-structure verdes; banco 40/40, E2E 19/19 e segurança 42/42. Inclui exigência de nome cadastrado, registro opcional, prazo com ressalva e pedido órfão. Revisão e autorização de merge continuam pendentes. Os bloqueios e resultados anteriores abaixo são históricos.

## Solução e implementação
- Solicitação humana com evidências selecionadas (alerta, exame, ordem, administração ou relato), justificativa obrigatória e prioridade.
- Autor: farmácia/enfermagem/medicina, com MFA e vínculo assistencial. Medicina encaminha a outro médico; autoencaminhamento é bloqueado no envio.
- Destinatário: médico vinculado ou plantonista da unidade resolvido no instante do envio. Escala ausente, expirada ou ambígua bloqueia; não há fallback silencioso.
- Rascunho → Enviada → Em revisão → Aceita/Ajustada/Recusada → Concluída. Descarte somente do rascunho; conclusão somente pelo autor com desfecho e referência ao sistema oficial.
- Confirmação explícita da revisão humana antes de enviar. Editar justificativa/prioridade no rascunho preserva versões anteriores. Para trocar destinatário/evidências na interface: descartar e criar outro; a API aceita editar evidências válidas do rascunho.
- Plantonista sem vínculo vê somente a solicitação, identificação mínima e snapshots das evidências selecionadas. Não recebe `care_assignment`; não abre prontuário/lista do paciente. Após o fim do plantão, perde esse acesso excepcional. Não há repasse automático de plantão nesta entrega.
- RLS das tabelas novas combina tenant, identidade transacional, MFA, autoria/destinatário e vínculo/escala. A identidade vem do JWT validado; nenhum campo do corpo define ator/organização.
- Banco verifica transições, atores, integridade paciente/evidências e gera snapshot/Provenance da fonte (não do cliente). Evidências e justificativa congeladas após envio; eventos append-only com versões. Escrita e auditoria são atômicas. Leitura também auditada. O app não tem INSERT em medical_request_events; a função dedicada sam_record_read valida acesso e deriva ator/revisão, gravando apenas read com snapshot vazio. O gatilho de transição gera os demais eventos. As duas funções de escrita são SECURITY DEFINER com search_path fixo; a função do gatilho não é executável diretamente pelo app.
- Concorrência: bloqueio da linha e revisão otimista; requisição repetida com revisão antiga é recusada com 409 (não repete a ação).
- Interface adicional no detalhe do paciente e caixa de recebidas do médico, sem alterar CSS, tokens, marcas, login ou dados do ambiente público.
- Somente consulta da caixa de recebidas no aplicativo; sem push, SMS, e-mail, polling automático, encerramento ou escalonamento por tempo.
- **Nenhuma alteração de prescrição.** Sem IA/LLM, OCR, cálculo de dose ou D-013.

## Arquivos principais
- `services/api/src/medical-requests.controller.ts`, `medical-request-rules.ts`, `module.ts`, `openapi.json`.
- `infra/migrations/0014_medical_requests.sql`, `infra/scripts/bootstrap-ci-db.sh`.
- `apps/clinical-web/components/clinical/MedicalRequests.tsx`, `PatientView.tsx`, `ClinicalShell.tsx`; páginas `/clinical/solicitacoes` e `/clinical/solicitacoes/[id]`; `lib/work-client.ts`, `lib/work-proxy.ts`.
- `tests/m155-medical-requests.mjs`, `tests/m155-db-medical-requests.integration.mjs`, extensão de `tests/e2e/m145-flow.spec.mjs`.
- `tools/validate-m146.mjs`, `package.json`, changelog, decisões, requisito e matriz.

## Migração e configuração (não aplicadas ao ambiente público)
Aplicação administrativa **somente** em banco sintético `oncopharma_dev`, após 0013. O bootstrap do CI inclui 0014. O fluxo não amplia os privilégios nas tabelas clínicas existentes.

0014 cria `medical_requests`, `medical_request_events`, `on_call_shifts` e `request_priority_criteria`; adiciona `memberships.display_name` opcional para identificar o destinatário por nome, sem mudar a autorização existente. Configuração por SQL administrativo, sem nova tela Admin. Não há senha nova, dependência npm nova ou alteração de secret/infra.

Antes de testar o fluxo em DEV/HML: aplicar 0014 com role administrativa, cadastrar nomes dos médicos sintéticos em `memberships.display_name`, critérios demonstrativos por unidade/prioridade, escala sintética e vínculos existentes. Sem alocação, criar bloqueia; sem critério ou plantonista, o envio bloqueia. A migração não semeia nem altera pacientes existentes. Os novos E2E criam suas configurações/fixtures dentro do banco efêmero.

Critérios usam `routine`, `priority`, `urgent`; SLA opcional em minutos fica registrado como referência do serviço. Aprovação clínica permanece false por constraint nesta fase. Todas as configurações e registros são sintéticos.

Não há migração destrutiva de rollback. Antes de merge/deploy: ensaiar a migração no PG17 e contingência de aplicação; caso necessário, reverter apenas a aplicação e manter histórico/tabelas sem uso. Não apagar solicitações para desfazer release.

## Validação
Executar em Node 22:

```bash
npm ci --no-audit --no-fund
node tools/validate-m146.mjs
```

O relatório desta entrega está em `artifacts/validation/m14_6/validation-report.json`; logs separados por comando. O validador M14.5 foi preservado. `PASS` de verificações locais não significa que PostgreSQL/E2E passaram.

- Build de todos os workspaces, `verify:local`, segurança da API (42 testes), regras e laboratório: resultados locais nos logs.
- 17 testes E2E existentes preservados; 2 cenários novos (19 declarações): vinculado → ajustada → conclusão/auditoria; plantonista sem vínculo → aceita/recusada, descarte, falta de escala, perda de acesso. Incluem teclado, zoom 200%, 390/768/1440, axe e capturas. Seletor, pedido órfão e axe aprovados no run 39186760947.
- 5 testes novos de PostgreSQL incluem RLS, MFA/contexto, admin/sem vínculo, evidência cruzada, escala ausente/ambígua/expirada/futura, transições, resposta/conclusão obrigatórias, imutabilidade e snapshots. Executados e aprovados no PostgreSQL 17 do run 39186760947.
- O container expõe apenas UID 0 (`/proc/self/uid_map: 0 0 1`), sem Docker ou psql; `initdb` PG17 recusa root. URLs e IdP de teste não estão configurados. Os comandos exigidos encerram em 2, sem pular testes nem simular aprovação.
- Diagnóstico auxiliar de sintaxe SQL foi feito com PGlite/WASM em scratch, inclusive caminho até conclusão; **não é PostgreSQL 17**, não é E2E e não é evidência de aceite integrado. Encontrou e permitiu corrigir parênteses na expressão CASE da guarda SQL antes da entrega. Não foi adicionado como dependência do projeto.
- Primeira coleta local detectou alteração de fonte durante a execução (correção SQL); relatório preservado em `attempt-01`. A coleta final tem digest estável: **8 PASS / 0 FAIL / 3 BLOCKED**. A coleta intermediária está em `attempt-02`.

## Riscos e próximos passos
1. **Resolvido:** conexão de escrita restabelecida; branch publicada e PR #11 aberto em rascunho.
2. **Comprovado no CI:** migração 0014, banco 40/40 e E2E 19/19. Aguardar revisão e confirmação do responsável antes de qualquer merge.
3. Revisão humana do diff, autorização/escala, aparência e auditoria. Sem repasse de plantão nesta fase: pedido continua pendente; recipientActive=false e aviso ao autor expõem a perda de acesso. Nunca roteia ou conclui sozinho. Casos operacionais de perda do autor/vínculo exigem decisão futura.
4. Confirmar nomes no cadastro sintético de médicos; sem nome, a UI informa ausência. Não inferir identidade a partir de e-mail/domínio.
5. Acessibilidade e capturas autenticadas geradas no run 39186760947. Axe: zero violações nas telas novas verificadas. Manifesto com hashes em artifacts/validation/m14_6/ci-39186760947/.
6. D-007, IdP institucional, aprovação clínica, LGPD/retenção e gates G01–G09 continuam dependências externas. Sem dados reais, sem nova hospedagem/custo e sem alegação de homologação.

**GO técnico para revisão do PR; merge pendente de confirmação. NO-GO para piloto e uso clínico. `readyForClinicalUse=false`.**


## Revisão técnica do PR #11 — 18/10/2026
Diagnóstico confirmado no run 39168363344: 40/40 banco; 17 E2E passaram, 08c falhou por dois elementos role=alert e 09 axe não executou. Esse resultado não aprova a entrega.

Correções: seletor filtrado (demais alertas revisados); eventos protegidos contra inserção arbitrária; disponibilidade do destinatário independente do usuário consultante; aviso ao autor quando pedido enviado/em revisão perde destinatário; campos explícitos na API; nome e registro profissional opcional copiados para cada evento, preservando identidade histórica mesmo após mudança cadastral. O cadastro usa memberships.display_name e professional_registration. Nome profissional é obrigatório para gravar qualquer evento novo (inclusive leitura); cadastro sem nome recebe erro explícito e a transação é revertida. Registro de conselho é opcional. Testes negativos comprovam que não há gravação parcial nem identidade inventada.

Autor e médico veem: o pedido só é visto ao abrir Solicitações recebidas; não há aviso nem acompanhamento de prazo; urgência requer contato direto. O prazo repete “sem escalonamento”. A confirmação antes do envio é revisão pelo próprio autor, não dupla checagem independente.

### Campos permitidos nas evidências
| Tipo | Campos do snapshot |
|---|---|
| Alerta | code, level, status, rule_version, explanation, created_at |
| Exame | analyte_code, analyte_label, result_value, unit, reference_low, reference_high, collected_at, source_reference |
| Prescrição registrada | medication, dose_value, dose_unit, route, frequency_text, status, ordered_at, source_reference |
| Administração | medication, dose_value, dose_unit, status, administered_at, source_reference |
| Sintoma | symptom_code, description, triage_status, reported_at, source_reference |

Envelope: type, id, source_reference, source_at. Nenhuma coluna futura é copiada automaticamente; não inclui ator da origem, atribuição, organização, paciente, detalhes adicionais ou order_id. Somente evidências escolhidas e pertencentes ao paciente/instituição são aceitas.

### Desativação sem apagar dados
Em banco sintético de teste, com DATABASE_URL_ADMIN no ambiente:
```bash
NODE_ENV=test bash infra/scripts/disable-medical-requests.sh
```
O script aplica infra/rollback/0014_disable_medical_requests.sql em transação única. Revoga permissões de tabelas, colunas, sequência e funções novas do app; não apaga registros nem altera módulos anteriores. A API permanece com falha fechada para M15.5; retirar a versão de aplicação é decisão operacional separada. Não reaplicar 0014 inteira sobre banco já migrado. Reativação requer nova revisão e concessões explícitas.

Ensaio automatizado incluído no teste de banco: aplica o mesmo SQL, verifica negação de acesso/execução, compara quantidade de eventos, comprova SELECT de patients preservado e faz ROLLBACK somente da transação do ensaio. Ensaio aprovado no PostgreSQL 17 no run 39186760947.


## Evidência integrada da revisão
Run **39186760947**, jobs **117850707239 (integration)** e **117850707026 (unit-and-structure)** concluídos com success. Banco 40/40, segurança API 42/42, E2E 19/19 (zero ignorados), incluindo 08c e 09 axe. Todos os workspaces compilaram. Logs separados, relatório e JSON E2E estão em artifacts/validation/m14_6; capturas completas no artefato oncopharma-e2e-evidence desse run (manifesto e SHA-256 verificados).

A falha anterior do run 39168363344 permanece registrada, sem ser apresentada como aprovação. PASS, FAIL e BLOCKED estão separados no relatório; bloqueio clínico continua ativo. As funções SECURITY DEFINER têm finalidade restrita e search_path fixo; não concedem acesso direto do app a eventos nem aceitam ação/snapshot do cliente.

Reforço final do E2E: cadastro sintético do autor com nome/CRF e prazo de referência de 60 minutos, com assertivas de identificação e “sem escalonamento”. O fechamento da revisão também exige nome cadastrado para qualquer evento novo e testa a recusa atômica de cadastro sem nome. O CI do commit final deve ficar verde antes do parecer final.


## Fechamento técnico — versão completa
**Run 39187685667**: integration **117853464279** e unit-and-structure **117853464102**, ambos success. Comandos e resultados: npm run build (0); npm run test:api:security (42/42, 0); npm run test:db:required (40/40, 0); bash tests/e2e/run-e2e.sh (19/19, 0), com 08c e 09 axe, zero ignorados. O cadastro sem nome é recusado atomicamente; nomes e registros sintéticos aparecem nas capturas e são verificados no E2E. O prazo preenchido é testado com a ressalva sem escalonamento.

Logs, relatório e JSON E2E atualizados em artifacts/validation/m14_6. Manifesto das nove capturas M15.5 em ci-39187685667/artifact-manifest.json; ZIP oficial do artefato 12158598810 tem SHA-256 adae5cef6dab9dbf90f0361483d016cd4ad326ab880638075a90a8fbd72b5f43. Zero violações axe nas telas novas analisadas. Histórico preservado. Este fechamento altera apenas documentação/evidências; o CI do commit documental também será conferido no PR.

**GO técnico para revisão; merge não autorizado. NO-GO clínico, readyForClinicalUse=false.**
