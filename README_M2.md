# ONCOPHARMA M2 — Prontuário oncológico longitudinal (somente desenvolvimento)

Evolução cumulativa de M1.2. **Não apto a dados reais nem assistência clínica.**

## Entregue
- Migração `0004_oncology_record.sql`: protocolos versionados, ciclos e observações multiprofissionais, RLS por instituição.
- `seed_m2_synthetic.sql`: dois pacientes fictícios, ciclos FOLFOX e AC-T e relatos rastreáveis.
- `GET /v1/patients/:patientId/record`: OIDC, MFA, vínculo institucional, atribuição individual, RLS, auditoria e bloqueio em produção.
- Proxy autenticado do Next.js e interface Clinical para leitura da linha do tempo sintética.
- Limpeza de dados sintéticos ampliada para as tabelas M2.

## Execução em ambiente de desenvolvimento
1. Configurar `.env` segundo `.env.example` e o README da M1.2. Instalar dependências: `npm install`.
2. Subir PostgreSQL: `npm run db:up`; configurar credenciais separadas e `npm run db:provision-app`.
3. Aplicar `npm run db:migrate` (0001 e 0002), provisionar role com `npm run db:provision-app` (0003), depois `npm run db:migrate:m2` (0004) e `npm run db:seed` com OIDC_ISSUER e OIDC_SUB de um usuário de teste.
4. Habilitar `ALLOW_SYNTHETIC_API=true` e `NEXT_PUBLIC_ALLOW_SYNTHETIC_UI=true` **apenas em DEV**.
5. Iniciar API e portal; autenticar com provedor OIDC real configurado e MFA; abrir Clinical.
6. Executar `npm test`. Testes PostgreSQL requerem ambiente próprio e devem ser rodados separadamente.

## Limites
Sem dados reais; sem persistência de novas evoluções via interface; sem cálculo de dose, sugestões terapêuticas, integração hospitalar ou IA. Exames laboratoriais e prescrições estruturadas serão modelados na próxima etapa. A auditoria deve ser complementada com política de retenção, segurança operacional e testes de intrusão antes de produção.
