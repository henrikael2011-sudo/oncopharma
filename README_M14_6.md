# ONCOPHARMA — M14.6 / M15.5

## Diagnóstico
Base: `main` em `f64870b00a68cb28f877d4e88ab5c6669769b54d` (PR #10, M15.4c). A importação existente é de censo/alocação; prescrição/protocolo PDF permanece fora desta entrega. D-012 e P-SAM-1..4 aprovadas pelo responsável em 18/10/2026.

**Implementação local; NÃO pronta para merge.** Branch `m14.6-m15.5-solicitacoes`. Publicação no GitHub recusada com HTTP 403 (`Resource not accessible by integration`); `git push --dry-run` também sem credencial. Nenhum PR criado, nenhum merge ou deploy efetuado. A conexão instalada não retornou instalações GitHub acessíveis.

## Solução e implementação
- Solicitação humana com evidências selecionadas (alerta, exame, ordem, administração ou relato), justificativa obrigatória e prioridade.
- Autor: farmácia/enfermagem/medicina, com MFA e vínculo assistencial. Medicina encaminha a outro médico; autoencaminhamento é bloqueado no envio.
- Destinatário: médico vinculado ou plantonista da unidade resolvido no instante do envio. Escala ausente, expirada ou ambígua bloqueia; não há fallback silencioso.
- Rascunho → Enviada → Em revisão → Aceita/Ajustada/Recusada → Concluída. Descarte somente do rascunho; conclusão somente pelo autor com desfecho e referência ao sistema oficial.
- Confirmação explícita da revisão humana antes de enviar. Editar justificativa/prioridade no rascunho preserva versões anteriores. Para trocar destinatário/evidências na interface: descartar e criar outro; a API aceita editar evidências válidas do rascunho.
- Plantonista sem vínculo vê somente a solicitação, identificação mínima e snapshots das evidências selecionadas. Não recebe `care_assignment`; não abre prontuário/lista do paciente. Após o fim do plantão, perde esse acesso excepcional. Não há repasse automático de plantão nesta entrega.
- RLS das tabelas novas combina tenant, identidade transacional, MFA, autoria/destinatário e vínculo/escala. A identidade vem do JWT validado; nenhum campo do corpo define ator/organização.
- Banco verifica transições, atores, integridade paciente/evidências e gera snapshot/Provenance da fonte (não do cliente). Evidências e justificativa congeladas após envio; eventos append-only com versões. Escrita e auditoria são atômicas. Leitura também auditada.
- Concorrência: bloqueio da linha e revisão otimista; requisição repetida com revisão antiga é recusada com 409 (não repete a ação).
- Interface adicional no detalhe do paciente e caixa de recebidas do médico, sem alterar CSS, tokens, marcas, login ou dados do ambiente público.
- Somente notificações no aplicativo, ao consultar a caixa de recebidas; sem push, SMS, e-mail, polling automático, encerramento ou escalonamento por tempo.
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
- 17 testes E2E existentes preservados; 2 cenários novos (19 declarações): vinculado → ajustada → conclusão/auditoria; plantonista sem vínculo → aceita/recusada, descarte, falta de escala, perda de acesso. Incluem teclado, zoom 200%, 390/768/1440, axe e capturas **a gerar quando executados**.
- 6 testes novos de PostgreSQL incluem RLS, MFA/contexto, admin/sem vínculo, evidência cruzada, escala ausente/ambígua/expirada/futura, transições, resposta/conclusão obrigatórias, imutabilidade e snapshots. Ainda precisam executar em PG17 real.
- O container expõe apenas UID 0 (`/proc/self/uid_map: 0 0 1`), sem Docker ou psql; `initdb` PG17 recusa root. URLs e IdP de teste não estão configurados. Os comandos exigidos encerram em 2, sem pular testes nem simular aprovação.
- Diagnóstico auxiliar de sintaxe SQL foi feito com PGlite/WASM em scratch, inclusive caminho até conclusão; **não é PostgreSQL 17**, não é E2E e não é evidência de aceite integrado. Encontrou e permitiu corrigir parênteses na expressão CASE da guarda SQL antes da entrega. Não foi adicionado como dependência do projeto.
- Primeira coleta local detectou alteração de fonte durante a execução (correção SQL); relatório preservado em `attempt-01`. A coleta final tem digest estável: **8 PASS / 0 FAIL / 3 BLOCKED**. A coleta intermediária está em `attempt-02`.

## Riscos e próximos passos
1. **Bloqueante:** restabelecer conexão GitHub com escrita neste repositório para publicar a branch e abrir PR. Não colar token/senha no chat.
2. **Bloqueante:** CI deve comprovar migração 0014, 41 testes totais de banco e 19 E2E (17 anteriores + 2 novos); contagens esperadas, não resultados obtidos. Não fazer merge antes disso e da confirmação do responsável.
3. Revisão humana do diff, autorização/escala, aparência e auditoria. Sem repasse de plantão nesta fase: pedido continua pendente; nunca roteia ou conclui sozinho. Casos operacionais de perda do autor/vínculo exigem decisão futura.
4. Confirmar nomes no cadastro sintético de médicos; sem nome, a UI informa ausência. Não inferir identidade a partir de e-mail/domínio.
5. Os testes de acessibilidade novos e capturas autenticadas estão BLOQUEADOS com o E2E; nenhum screenshot de fluxo simulado foi apresentado como real.
6. D-007, IdP institucional, aprovação clínica, LGPD/retenção e gates G01–G09 continuam dependências externas. Sem dados reais, sem nova hospedagem/custo e sem alegação de homologação.

**NO-GO para merge, piloto e uso clínico nesta entrega parcial. `readyForClinicalUse=false`.**
