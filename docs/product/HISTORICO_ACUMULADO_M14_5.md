# Histórico acumulado — M14.4 → M14.5 consolidado
(Não reescreve o histórico anterior; o planejamento acumulado M1–M14.4 permanece nos README_M* e no PDF acumulado.)

| Etapa | Autor | Branch/artefato | Resultado |
|---|---|---|---|
| M14.4 | ChatGPT/Codex | ZIP SHA-256 `e8c492bb…396d`, commit `ef70dc7` | build quebrado em 3 apps; PostgreSQL/OIDC não executados |
| M14.5 (A) | Grok Bot | `fix/m14-5`, `ONCOPHARMA_M14_5.zip` | 7 correções de causa-raiz; PostgreSQL 17 + RLS negativos; E2E 9/9 com Keycloak de teste; 2 BLOCKED |
| M14.5 (B) | Codex (independente) | `codex-m14_5/ONCOPHARMA_M14_5.zip` | 13 PASS / 0 FAIL / 5 BLOCKED (sem PostgreSQL no container); validação de id_token, endurecimento de role, CI npm ci |
| M14.5 consolidado | Grok Bot | `fix/m14-5-merge`, `ONCOPHARMA_M14_5_CONSOLIDADO.zip` | A + itens selecionados de B + migração 0008; 18 PASS / 0 FAIL / 2 BLOCKED |

Decisão vigente: GO condicionado apenas para homologação técnica com dados sintéticos após D-008; **piloto NO-GO; uso clínico NÃO**.
