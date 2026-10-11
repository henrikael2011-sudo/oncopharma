# ONCOPHARMA — M9: Primeiro fluxo integrado executável

Esta entrega **acrescenta** um laboratório local integrado ao projeto M2.2–M8. Ele conecta uma página Care/Clinical a uma API Node real com persistência local. Não substitui o backend NestJS nem as futuras integrações institucionais.

**Comece por:** `npm run lab:dev` e abra `http://127.0.0.1:4177`. Para testes, `npm run test:lab`. Consulte `tools/synthetic-lab/README.md` para limitações e segurança.

**Fluxo:** relato fictício → alerta determinístico → revisão simulada → intervenção → orientação em rascunho → auditoria. Não há autorização automática, IA clínica ou envio de mensagens.

**Status de validação:** teste HTTP automatizado incluído; testes de PostgreSQL, OIDC, Next/Nest e validação clínica permanecem pendentes. Uso exclusivamente educacional/DEV.
