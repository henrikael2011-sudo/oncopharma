# Critérios de passagem — M10.3 a M14
| Gate | Exigência | Estado nesta entrega |
|---|---|---|
| G01 | Apps separados + identidade verificada | PARCIAL — código separado, sem build integrado |
| G02 | Banco PostgreSQL, migrações, RLS e isolamento multi-instituição | PENDENTE — Docker não disponível no ambiente de construção |
| G03 | OIDC/MFA e E2E com identidades sintéticas | PENDENTE — IdP e navegador integrado não configurados |
| G04 | Regras críticas revisadas por especialistas e versionadas | PENDENTE — apenas motor demonstrativo |
| G05 | IA com fontes aprovadas, regressão e validação clínica offline | PENDENTE — contrato e gate implementados, sem modelo clínico ativo |
| G06 | Simulador FHIR, duplicatas, proveniência e falhas | PARCIAL — validador sintético testado; integração real não autorizada |
| G07 | Segurança, LGPD, acessibilidade WCAG 2.2 AA, backup e restauração | PENDENTE — evidências externas necessárias |
| G08 | Análise SaMD/Anvisa, instituição-piloto, equipe e SLA de alertas | PENDENTE — aprovações externas obrigatórias |
| G09 | Aprovação formal de farmacêutico, médico, enfermagem, segurança e produto | PENDENTE |
**REGRA DE RELEASE:** nenhum gate pendente pode ser marcado aprovado por mera presença de código, README ou testes estruturais. Produção permanece vazia; sem uso assistencial.
