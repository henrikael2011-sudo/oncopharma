# Auditoria de aderência — M10.2

Base: Plano Diretor v3.0, decisões D-001 a D-008, seções 2, 4, 9, 10, 12 e 13.

| Requisito | Evidência no código | Estado | Correção ou pendência |
|---|---|---|---|
| D-001 PWA responsiva | Next.js apps/portal; CSS responsivo | Parcial | Manifest, offline seguro, build e testes em dispositivos pendentes |
| D-002 Care/Clinical distintos | /care, /clinical | Parcial | Navegação, funcionalidades completas e E2E pendentes |
| D-003 marca única | Brand.tsx, /brand/*.svg | Parcial | Marca final pendente |
| D-004 identidade visual | globals.css e SVGs | Corrigido parcialmente | SVGs alinhados aos motivos conceituais, validação final pendente |
| D-005 IA com revisão humana | estrutura ai-orchestrator e regras | Não concluído | Sem IA clínica validada, não ativar |
| D-006 dados sintéticos | seeds de DEV | Parcial | Testar isolamento DEV/HML/PROD em infraestrutura real |
| D-007 integração autorizada | README integration-gateway | Planejado | Sem Tasy/MV/FHIR hospitalar ativo |
| D-008 hospedagem/piloto/SLA | documentação | Em aberto | Decisão institucional |
| Arquitetura monorepo seção 9 | apps/portal único, services/api | Divergente | Separar care-web/clinical-web/admin-web e packages compartilhados, sem migração arriscada imediata |
| Segurança e testes seção 12 | testes estruturais, auth, rotas | Parcial | Banco, OIDC, integração e E2E reais não validados |
| Textos de estado | páginas Home/Care/Clinical | Corrigido | Removidas mensagens antigas M1 e contradições de conexão |
| Auditoria de marca | arte raster do Plano v3 | Parcial | Revisão humana da fidelidade vetorial |

**Política de status:** "corrigido parcialmente" não significa "homologado". Nenhum fluxo é apto a uso assistencial.
