# ONCOPHARMA M10.2 — reconciliação com Plano Diretor v3.0

Esta versão preserva o código M10.1 e corrige divergências de identidade e mensagens de estado.

## Alterações
- Ícones Care e Clinical redesenhados como **SVG provisórios** aproximando os motivos da arte aprovada (casa/família/coração; bolsa de infusão/profissional).
- Textos obsoletos da homepage, Care e Clinical corrigidos, sem prometer monitoramento ou operação real.
- Plano Diretor v3.0 copiado para `docs/product/PLANO_DIRETOR_V3_BASELINE.md`.
- Matriz de aderência em `docs/product/ALINHAMENTO_M10_2.md`.
- Testes de regressão em `tests/m102-alignment.test.mjs`.

## Limitações
Não foram homologados build, PostgreSQL, OIDC, E2E, segurança de produção ou fidelidade final dos vetores. Não utilizar com pacientes reais.

## Testes
`npm test` ou `node --test tests/m102-alignment.test.mjs`.
