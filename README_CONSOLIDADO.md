# ONCOPHARMA — pacote consolidado M2.2 até M8

Continuação da base **M2.1**, preservando Next.js/NestJS/PostgreSQL, identidade visual e arquitetura existente. Entrega em uma única versão: motor de regras **somente sintético**, esquema de workflows, contratos, documentação de IA, integrações e prontidão de piloto, além de uma **prévia interativa offline** que pode ser aberta no navegador.

## Como testar agora
- Abra `PREVIA_INTERATIVA.html` no navegador. Tudo ali é fictício e permanece no navegador; não há API clínica conectada.
- Com Node.js >=20: `npm run test:all` (testes estruturais e unitários; banco e OIDC não testados).
- Para executar Next/Nest, siga `README.md` da base M2.1 e configure os serviços reais. Não habilite dados reais.

## Limitações essenciais
**Não estão completos operacionalmente:** IA/RAG real, integrações FHIR/Tasy/MV, login do paciente, alertas entregues à equipe, notificação push, banco validado, testes E2E, homologação clínica/regulatória. O código de persistência do workflow é **schema de leitura sem escrita pela API** até revisão de segurança. Não confundir demonstração com software assistencial.

## Arquivos principais
- `PREVIA_INTERATIVA.html` — fluxo navegável completo, sem dependências.
- `packages/clinical-rules/src/index.mjs` — regras determinísticas conservadoras, sem prescrição.
- `infra/migrations/0006_clinical_workflow.sql` — modelos clínicos, RLS e restrição DEV.
- `packages/contracts/clinical-events.schema.json` — eventos tipados.
- `docs/product/ROADMAP_CONSOLIDADO.md` — estado marco a marco.
- `docs/quality/CRITERIOS_PILOTO_M8.md` — checklist go/no-go.
