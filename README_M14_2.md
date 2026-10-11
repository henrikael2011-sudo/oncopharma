# ONCOPHARMA M14.2 — Verificação integrada, com resultados honestos

**Referência vinculante:** Plano Diretor v3.0, decisões D-001–D-008. Nenhuma alteração da identidade visual aprovada. Pacientes exclusivamente sintéticos.

## Implementado
- Teste HTTP ponta a ponta executável sem dependências externas para o **laboratório local sintético** (Care simulado → alerta → revisão → orientação rascunho → auditoria → reset).
- Testes de bloqueio para ID não sintético, origem cruzada e dupla revisão.
- Scripts de migração/seed reforçados: recusam `NODE_ENV=production` e qualquer banco que não seja `oncopharma_dev`.
- `test:db:required` **falha explicitamente** se não houver DATABASE_URL, cliente psql ou banco acessível; evita contar testes pulados como aprovação.
- CI atualizada para exigir o pré-requisito antes de testar PostgreSQL.

## O que permanece PENDENTE (não declarar concluído)
1. Instalar dependências e compilar Next.js/NestJS. Tentativa de `npm install` neste ambiente não concluiu.
2. Executar migrações reais, RLS, auditoria e testes em PostgreSQL com roles apropriadas.
3. Configurar provedor OIDC/MFA de homologação e testar autorização entre instituições e perfis.
4. Testar Care e Clinical reais em navegador contra API e PostgreSQL, incluindo acessibilidade.
5. Validar regras e conteúdo clínico com especialistas, avaliação de SaMD/LGPD e instituição-piloto.
6. Validar visualmente logotipos finais contra arte aprovada; verificação de hashes não comprova equivalência artística.

**Atenção:** laboratório M9 usa JSON e não é a API clínica de produção. Teste HTTP do laboratório não substitui integração dos aplicativos Next/Nest.

## Executar
- `npm run test:lab:e2e` — teste HTTP sintético, somente Node.js.
- `npm run test:db:required` — exige PostgreSQL configurado; falha fechado.
- `npm run verify:local` — testes e verificadores locais (sem compilar Next/Nest).
- `npm run quality:gate` — permanece bloqueado sem evidências e aprovações externas.

## Controle de mudanças
M14.2 acrescenta somente robustez dos testes e scripts, sem alterar identidade, fluxos clínicos aprovados, papéis ou decisões D-001–D-008. Próximo objetivo: integração real comprovada em infraestrutura apropriada.
