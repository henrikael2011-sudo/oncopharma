# ONCOPHARMA — M14.6 / M15.5

## Diagnóstico
O PR #11 permanece no branch `m14.6-m15.5-solicitacoes`, sem merge ou deploy. O E2E 08 reutilizava o token do teste 06 e podia receber 401 antes da assertiva inicial, pois a validade é de 120 segundos. O sucesso isolado do run 39187685667 não cobria a falha do push 39187680176 no mesmo commit. O histórico completo anterior está em [README-history-before-final-review.md](artifacts/validation/m14_6/README-history-before-final-review.md).

## Solução e implementação
- E2E 08 faz login OIDC/PKCE/TOTP próprio e testa o mesmo token antes e depois da expiração real. TTL, autenticação e tolerância permanecem iguais; nenhum bypass ou retry foi adicionado.
- Solicitação humana com evidências mínimas, rascunho, envio, revisão/resposta médica e conclusão pelo autor com referência ao sistema oficial. Não altera prescrições. PDF de prescrição/protocolo permanece fora do escopo.
- `memberships.display_name` é pré-requisito para criar, editar ou decidir solicitações. `professional_registration` é opcional; preencher quando houver registro verificado. A equipe administrativa deve cadastrar o nome de todos os profissionais sintéticos antes de usar essas ações. Não inferir nomes a partir de e-mail, papel ou identificador.
- Ausência de nome não impede consultar o pedido: a API retorna `actorProfileComplete:false`, a tela explica como regularizar o cadastro e não oferece alterações. A leitura continua auditada com issuer/sub autenticados, nome nulo e snapshot vazio. O histórico mostra “Nome pendente” e o identificador; nunca inventa identificação nominal. Outros eventos continuam exigindo nome, com rejeição atômica no banco.
- Médico destinatário perde acesso quando termina o plantão designado ou é revogado seu vínculo assistencial. O autor recebe `recipientActive:false` e aviso no pedido pendente. Não há redirecionamento automático; o estado “Enviada” permanece histórico do envio, acompanhado da advertência.
- App sem INSERT em eventos: transições por gatilho, leitura exclusivamente pela função autorizada. RLS/MFA/tenant e allowlists de evidências preservados.
- O médico só vê ao abrir “Solicitações recebidas”. Não há aviso, acompanhamento de prazo ou escalonamento. Em urgência, falar diretamente com o médico. Prazo é apenas referência. A confirmação antes do envio é do próprio autor, não dupla checagem independente.
- Identidade visual, CSS, tokens, login e dados públicos preservados. Testes somente com pacientes e profissionais sintéticos.

## Validação
Implementação validada: `0fc0a0e79ed6dcc41d958e7be7d4b61512981540`. Ambos os eventos concluíram com **success**, em Node 22, PostgreSQL 17 e IdP de teste efêmero.

| Evento | Run | integration | unit-and-structure |
|---|---|---|---|
| pull_request | [39255489726](https://github.com/henrikael2011-sudo/oncopharma/actions/runs/39255489726) | 118069603502 — success | 118069603933 — success |
| push | [39255481888](https://github.com/henrikael2011-sudo/oncopharma/actions/runs/39255481888) | 118069577635 — success | 118069576954 — success |

| Comando | Resultado em ambos os runs |
|---|---|
| `npm run build` | exit 0, todos os workspaces |
| `npm run test:db:required` | 40/40, exit 0 |
| `npm run test:api:security` | 42/42, exit 0 |
| `bash tests/e2e/run-e2e.sh` | 19/19, zero ignorados, exit 0 |
| design, brand, governance e `validate:evidence` | exit 0 |
| `npm run quality:gate` (pelo validador) | exit 1 esperado; liberação clínica BLOCKED |

Inclui 08 (expiração real), 08b (consulta sem nome e perda do vínculo médico), 08c (plantão) e 09 axe. Logs sanitizados, JSON e manifestos de artefatos estão em `artifacts/validation/m14_6`. Capturas completas nos artefatos `oncopharma-e2e-evidence` dos runs. O runner unitário registra pré-requisitos de integração como BLOCKED; a execução real é comprovada pelo job integration, sem converter bloqueios locais em sucesso.

Os relatórios em `artifacts/validation/m14_6/validation-report.json` e `review-status.json` identificam o commit de implementação, eventos, jobs e resultados. Commits posteriores exclusivos de documentação não mudam o digest das fontes; os runs do HEAD documental são conferidos e relacionados na descrição do PR. Isso evita confundir resultados de código anterior com a versão atual ou tentar gravar o próprio hash dentro do commit.

## Migração, cadastro e contingência
A 0014 é aditiva e destinada ao banco sintético `oncopharma_dev`, após 0013. O bootstrap CI aplica a migração e provisiona o papel restrito. Cadastrar nomes, critérios demonstrativos por unidade/prioridade, escala e vínculos. Sem unidade, critério ou destinatário elegível, as ações correspondentes bloqueiam. Nenhuma migração foi aplicada ao ambiente público nesta revisão. Não reaplicar 0014 em banco já migrado.

Desativação não destrutiva em DEV de teste: `NODE_ENV=test bash infra/scripts/disable-medical-requests.sh`, com `DATABASE_URL_ADMIN` fornecida somente pelo ambiente. Revoga permissões do app sobre recursos M15.5, sem apagar solicitações, eventos ou permissões dos módulos anteriores. O teste de banco aplica o mesmo SQL, verifica negação de acesso e preservação dos dados/permissões anteriores e desfaz somente a transação do ensaio.

**Fora de DEV:** o script recusa ambiente diferente de `NODE_ENV=test` e banco diferente de `oncopharma_dev`. Não trocar variáveis nem remover guardas para forçar execução em HML/produção. Antes de futura liberação nesses ambientes, a operação deverá preparar procedimento específico, revisar banco/papéis/permissões, preservar histórico e ensaiar a revogação em cópia isolada com aprovação institucional. Não há autorização ou ensaio de desativação em HML/produção nesta entrega.

## Riscos e próximos passos
Revisão humana e autorização de merge continuam pendentes. IdP institucional, aprovações clínicas/LGPD, operação de alertas e gates G01–G09 permanecem bloqueantes para piloto/produção. Perda de vínculo exige contato humano; não há substituição automática de destinatário. Leitura sem nome é uma pendência cadastral explícita, não identificação profissional completa.

`readyForClinicalUse=false`. Sem homologação clínica, merge ou deploy.
