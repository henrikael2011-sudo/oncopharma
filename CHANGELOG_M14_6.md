# M14.6 / M15.5 — Solicitação de alteração ao médico

18/10/2026. Base `f64870b` (PR #10). Implementação em branch local; publicação/PR BLOQUEADOS por GitHub 403. Sem merge/deploy.

- D-012/P-SAM-1..4: solicitação manual com evidências, prioridade, médico vinculado/plantonista, revisão e resposta obrigatória, conclusão pelo autor e referência oficial.
- API/BFF de rotas fechadas, MFA, vínculo, RLS, revisão otimista e auditoria atômica.
- Migração aditiva 0014: solicitações, histórico append-only, critérios/escala sintéticos, nome profissional opcional. Não altera prescrição nem pacientes existentes.
- Clinical: aba de solicitações, rascunho/revisão humana, recebidas e detalhe limitado para plantonista. CSS/identidade/login preservados.
- 5 testes unitários/segurança novos (total 42); 6 de banco novos (execução PG17 pendente); 2 E2E novos, mantendo os 17 anteriores (execução integrada pendente).
- Evidência local isolada em m14_6, PASS/FAIL/BLOCKED separados; histórico anterior mantido.
- Prescrição/protocolo PDF e IA/D-013 fora de escopo. `readyForClinicalUse=false`.


Atualização 18/10/2026, 18:28 BRT: acesso de escrita restabelecido; branch publicada e PR #11 aberto em rascunho (https://github.com/henrikael2011-sudo/oncopharma/pull/11). CI 39167977428 em execução. Bloqueio de publicação acima é histórico. Sem merge/deploy. Contagem corrigida: 5 novos testes de banco, 40 totais esperados; resultado integrado ainda pendente.

Revisão técnica PR #11: restringidos eventos a gatilho/função de leitura; campos mínimos de evidências e resposta explícita; identidade histórica; recipientActive e aviso de pedido órfão; ressalvas de comunicação/urgência; desativação não destrutiva; seletor 08c corrigido. Reexecução CI pendente.

Validação real da revisão — run 39186760947, commit 918e783: integration e unit-and-structure verdes; banco 40/40 (inclui eventos falsos recusados e ensaio de desativação), API 42/42, E2E 19/19 incluindo 08c e 09 axe. Artefato de capturas 12158547454, SHA-256 no manifesto. Sem merge/deploy; readyForClinicalUse=false.
