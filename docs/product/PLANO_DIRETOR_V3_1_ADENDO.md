# ONCOPHARMA — Adendo controlado v3.1 (proposta técnica)
**Baseline imutável:** Plano Diretor v3.0 de 10/10/2026, presente em `PLANO_DIRETOR_V3_BASELINE.md`.
**Status:** Adendo de execução técnica; NÃO altera decisões D-001 a D-008. Qualquer mudança futura requer aprovação explícita do responsável pelo produto.
## Evoluções rastreáveis
- M10.3: aplicações Care, Clinical, Admin separadas; portal anterior mantido temporariamente para regressão.
- M10.4: roteiro e workflow CI com PostgreSQL; integração OIDC e banco real pendentes de execução/homologação.
- M11: gate de evidências e bloqueio de ações clínicas automáticas, sem IA clínica ativada.
- M12: adaptador FHIR R4 somente sintético com validação, deduplicação e origem; sem Tasy/MV real.
- M13: qualidade automatizada estrutural e documentação de gates; segurança, acessibilidade, LGPD e regulação pendentes.
- M14: dossiê de critérios para piloto, não aprovação de piloto.
## Regra de honestidade de status
**Implementado** = código presente; **Testado** = teste executado com evidência; **Homologado** = aceite de todos os gates e responsáveis. Estes estados não são intercambiáveis.
## Identidade
Referência visual é a arte original do Plano Diretor v3.0, página 1. SVG atuais permanecem provisórios; arte final e validação WCAG ainda pendentes. Nunca substituir por referências genéricas de imagem.

## Emendas de 11/10/2026
- *Emenda D-013, 11/10/2026* — rascunho de prescrição assistido por IA (fase posterior; implementação bloqueada). Ver `PLANO_DIRETOR_V3_BASELINE.md` §1/§3/§5/§14 e `RF_PRESCRICAO_ASSISTIDA_IA.md`.
- *Emenda UI, 11/10/2026* — diretrizes de interface Care/Clinical, privacidade na lista, busca e alocação hospitalar. Ver `PLANO_DIRETOR_V3_BASELINE.md` §2.3 e `docs/diretrizes-design.md`.
- As emendas foram inseridas na baseline como blocos marcados, preservando integralmente o texto original v3.0.
