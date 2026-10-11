# ONCOPHARMA — Consolidação técnica M10.3 a M14
**Base:** código real M10.2 + Plano Diretor v3.0. **Sem uso assistencial.**

## Conteúdo
- M10.3: três aplicações Next.js separadas; portal legado preservado; design system canônico e verificador de deriva.
- M10.4: plano de execução integrada e workflow CI (PostgreSQL no runner). Não houve validação OIDC/PostgreSQL neste ambiente.
- M11: verificador de proveniência e evidência com bloqueio de automação clínica. Não há modelo generativo clínico ativo.
- M12: adaptador FHIR R4 sintético com validação de recursos, idempotência e origem. Nenhuma conexão Tasy/MV real.
- M13: testes de segurança estrutural e gates de qualidade, planos de validação e avaliação clínica pendente.
- M14: dossiê de preparação para piloto, sem aprovação formal ou autorização de uso real.

## Executar testes locais sem instalar dependências
`npm test`
`npm run test:extended`
`npm run check:design`
`npm run check:governance`

## Executar aplicações após instalar dependências
`npm install` (ou `npm ci` após gerar e versionar package-lock.json)
`npm run dev:care` (3001)
`npm run dev:clinical` (3002)
`npm run dev:admin` (3003)
`npm run dev:api` (porta definida na API)

**Atenção:** os aplicativos Care e Clinical dependem de variáveis de ambiente e OIDC para os fluxos de API. Nenhum login real foi configurado nesta entrega. `apps/portal` permanece como legado, não é para implantar em paralelo em produção.

## Limitações e próximas validações
Consultar `docs/quality/PILOTO_GATES.md`, `docs/quality/PLANO_VALIDACAO_INTEGRADA.md` e `docs/product/MATRIZ_RASTREABILIDADE.md`.
Não declarar os seis marcos 'homologados': são entregas de código, contratos, testes e governança com pendências explícitas.
