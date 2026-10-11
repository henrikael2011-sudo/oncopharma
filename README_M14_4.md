# ONCOPHARMA M14.4 — Validação reproduzível e evidências

**Base imutável:** Plano Diretor v3.0, decisões D-001 a D-008.

## O que esta versão entrega
- `npm run validate:evidence`: executa testes locais, teste do laboratório, pré-requisito PostgreSQL obrigatório, tenta renderizar o laboratório no Chromium, registra os bloqueios do build e da autenticação OIDC/MFA sem falsos positivos.
- `artifacts/validation/validation-report.json`: resultado por verificação (PASS/FAIL/BLOCKED), evidências em `.log` e captura PNG quando Chromium estiver disponível.
- CI passa a executar também o teste HTTP do laboratório; sem substituir testes integrados reais.
- Preserva os aplicativos, os tokens e os símbolos da versão M14.3; nenhuma mudança de identidade foi introduzida.

## Execução
```bash
npm run validate:evidence
# Para executar integração PostgreSQL de verdade, configurar DATABASE_URL com role oncopharma_app e rodar:
npm run test:db:required
# Após npm install em ambiente com rede:
npm run build
```

## Critérios de saída que permanecem BLOQUEADOS
- Build Next.js/NestJS depende de instalação das dependências e compilação bem-sucedida.
- PostgreSQL depende de serviço real, migrações e role restrita; `test:db:required` falha fechado.
- OIDC/MFA depende de provedor de homologação e identidades sintéticas; não há bypass.
- Testes E2E dos aplicativos reais, segurança, LGPD, validação clínica e avaliação SaMD dependem de infraestrutura/equipe habilitada.
- Nenhum dado real ou orientação terapêutica autônoma.

**Status:** laboratório sintético executável; implantação clínica e integração de produção não homologadas.
