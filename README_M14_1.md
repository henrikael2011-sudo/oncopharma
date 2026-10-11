# ONCOPHARMA M14.1 — Fechamento de pendências verificáveis

**Baseline:** Plano Diretor v3.0; planejamento acumulado até M14; código M10.3–M14.

## Alterações implementadas
- `npm run build` agora compila **Care, Clinical, Admin e API**, em vez de somente o portal legado e a API.
- CI instala dependências antes dos testes, executa build dos quatro aplicativos e os novos testes de bloqueio de liberação.
- `npm run quality:gate` falha por padrão enquanto os gates G01–G09 não tiverem declarações completas de evidências e aprovação.
- `npm run quality:report` gera JSON para auditoria; `clinical_use_allowed` permanece **false**, inclusive quando declarações forem preenchidas. A checagem não autentica documentos nem concede homologação.
- Ajustado rótulo da tela Clinical para M14.1 DEV SINTÉTICO.

## Testes que NÃO puderam ser executados neste ambiente
- `npm install --offline`: falhou por ausência de dependências no cache (`ENOTCACHED`). Logo, **nenhum build Next/Nest** foi validado nesta entrega.
- PostgreSQL: não há `psql`, `postgres` ou Docker; não foi possível executar migrações, RLS ou E2E.
- OIDC: sem provedor de identidade configurado; login/MFA não foram validados.

## Critério de aceite
A execução de testes estruturais não significa aprovação clínica. Gates G01–G09 continuam pendentes/parciais; piloto não autorizado. O gate de evidências foi construído como ferramenta de prevenção de declaração indevida de conclusão.

## Comandos
`npm test` · `npm run test:extended` · `npm run test:readiness` · `npm run quality:report` · `npm run build` (requer npm install)

## Próxima ação fora deste ambiente
Executar o projeto com Node, PostgreSQL e OIDC de testes, registrar evidências de build, migração, isolamento e E2E; solicitar aprovação clínica e avaliação regulatória institucional.
