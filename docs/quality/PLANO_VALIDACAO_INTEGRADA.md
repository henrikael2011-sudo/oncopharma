# Plano de execução integrado M10.4
1. Preparar infraestrutura isolada DEV com PostgreSQL e provedor OIDC real de testes; configurar TLS e segredos por ambiente.
2. Executar migrações e seed apenas em DEV/HML. Validar ausência de seeds em PROD.
3. Criar identidades sintéticas: paciente A, paciente B, farmacêutico autorizado, profissional de outra instituição, admin técnico sem acesso clínico.
4. Exercitar autorização e RLS: cross-tenant, sem MFA, sem vínculo assistencial, revogação, expiração e CSRF.
5. Exercitar fluxo: Care sintoma → persistência → regra → Clinical revisão → auditoria → orientação aprovada (somente quando implementada).
6. Exercitar falhas: queda de banco, timeout IdP, duplicata, erro FHIR, retomada, auditoria e ausência de orientação indevida.
7. Registrar logs de execução, resultados E2E, achados e responsável pelo aceite. Sem evidência = pendente.
**Limitação desta entrega:** Docker e IdP não estavam disponíveis neste ambiente; testes de infraestrutura não foram realizados.
