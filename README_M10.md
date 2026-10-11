# ONCOPHARMA — M10: integração NestJS/PostgreSQL (incremental)

## Implementado em código
- `services/api/src/workflow.controller.ts`: relato Care autenticado, listagem de alertas Clinical, intervenção profissional.
- `infra/migrations/0007_m10_patient_links.sql`: vínculo OIDC do paciente, RLS e permissões limitadas do runtime.
- Cada gravação é transacional, com auditoria; relatórios são idempotentes por `requestId` UUID; todos os endpoints bloqueados em produção.
- Não há envio de orientação automática, nem diagnóstico ou triagem validada.

## Rotas
- `POST /v1/workflow/care/patients/:patientId/symptoms` com `{ "symptomCode":"nausea", "description":"...", "requestId":"UUID" }`
- `GET /v1/workflow/clinical/patients/:patientId/alerts`
- `POST /v1/workflow/clinical/patients/:patientId/interventions` com `{ "alertId":"UUID", "note":"...", "decision":"pending" }`
- Todas requerem `Authorization: Bearer <token>` e `x-organization-id: <UUID>`.

## Condições
`ALLOW_SYNTHETIC_API=true` em DEV, nunca em produção. Executar migrações com administrador e verificar permissões/RLS. Criar vínculos `patient_portal_links` **somente com identidades de teste**. Não usar dados reais.

## Ainda pendente
OIDC real configurado, banco real, testes integrados, UI Care/Clinical conectada ao backend, revisão da política de auditoria, pipeline CI e homologação. Este pacote **não é produção pronta**.
