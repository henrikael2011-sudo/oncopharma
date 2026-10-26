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
- *Emenda UI, 11/10/2026* — diretrizes de interface Care/Clinical, privacidade na lista, busca, alocação hospitalar e importação de PDF (`RF_IMPORTACAO_PDF_PACIENTES.md`). Ver `PLANO_DIRETOR_V3_BASELINE.md` §2.3 e `docs/diretrizes-design.md`.
- **Regra de emenda (pedido do Henrikael, 11/10/2026):** o texto original do Plano Diretor v3.0 permanece **inalterado** — nenhuma linha original foi removida ou reescrita. As emendas são **acrescentadas** em `PLANO_DIRETOR_V3_BASELINE.md` como blocos/linhas marcados com "*Emenda D-013, 11/10/2026*" ou "*Emenda UI, 11/10/2026*". A expressão "baseline imutável" acima vale para o texto original v3.0; emendas futuras seguem a mesma regra.

## Emendas de 21/10/2026
- *Emenda Clinical, 21/10/2026* — decisão do Henrikael sobre como os dados de diluição/estabilidade aparecem na tela de conferência da prescrição (Clinical):
  - **Opção B (PADRÃO):** botão "Ver diluição" em cada card de item da prescrição, abrindo ali mesmo reconstituição, diluente, concentração, estabilidade e overfill, sempre com o fabricante da bula e o aviso fixo "verificar sempre o fabricante".
  - **Opção A (ACESSÓRIA/secundária):** aba separada com a tabela completa, busca e filtros, para pesquisar sem abrir card por card.
  - Ambas seguem a identidade visual e a paleta aprovadas no M14.4. A IA não decide; dados fictícios. Mockups: `opcao-B-ver-diluicao.png` e `opcao-A-aba-diluicao.png`. Ver `RF_PRESCRICAO_FOTO_E_ONLINE.md` §5k.
- *Emenda Clinical, 21/10/2026* — decisão do Henrikael para a tela de conferência da prescrição por IA (`/clinical/conferencia-ia`): **área de busca por paciente** (dados fictícios na demonstração) e **opção de impressão direta**, no mesmo estilo eficiente aprovado para a diluição (inline, acesso rápido, identidade visual e paleta do M14.4). A IA não decide. **Item novo, somente documentação — não implementado (sem código ainda).** Ver `RF_PRESCRICAO_FOTO_E_ONLINE.md` §5l.
