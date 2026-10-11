# ONCOPHARMA — M10.1 | Interface conectada ao fluxo M10

## Implementação
- Care: formulário para relatar sintomas sintéticos ao endpoint protegido, com `requestId` único por envio.
- Clinical: listagem de alertas de pacientes fictícios atribuídos ao profissional, com registro de revisão pendente.
- BFF Next.js: encaminha requisições autenticadas à API NestJS sem expor bearer token ao browser. POST exige mesma origem, JSON e limite de corpo.
- O banco, auditoria e validação de autorização continuam sob responsabilidade do backend M10.

## Como executar
1. Node.js >=20, PostgreSQL e provedor OIDC de teste configurados.
2. `npm install`, configurar `.env` conforme `.env.example` e executar migrações/seed de desenvolvimento conforme READMEs anteriores.
3. Em DEV, configurar `ALLOW_SYNTHETIC_API=true`, `NEXT_PUBLIC_ALLOW_SYNTHETIC_UI=true`, `DEV_ORGANIZATION_ID=<uuid>`, `PORTAL_ORIGIN=http://localhost:3000` (ajustar à origem real), `API_INTERNAL_URL=http://127.0.0.1:4000`.
4. Iniciar API `npm run dev:api` e portal `npm run dev:portal`. Login deve ser efetuado com identidades OIDC de teste vinculadas no banco.
5. Executar `npm run test:all` e `npm run test:m101`.

## Limites e riscos
- Não é sistema clínico validado. Nenhuma orientação ou alerta é transmitido automaticamente à equipe real.
- Os formulários estão bloqueados em produção; jamais usar dados reais ou credenciais reais para testes.
- A interface Care exige que o operador informe o UUID sintético; descoberta segura de paciente é trabalho futuro.
- As regras de febre/náusea são demonstrativas, não critérios clínicos aprovados.
- O fluxo não foi verificado contra PostgreSQL/OIDC reais neste ambiente; executar testes E2E e de segurança antes de qualquer piloto.
- Não há integração hospitalar, IA clínica ou envio de notificações.
