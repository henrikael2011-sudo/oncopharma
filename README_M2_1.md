# ONCOPHARMA M2.1 — Prontuário clínico estruturado

Evolução incremental da M2; **não usar com pacientes reais**. Mantém autenticação OIDC/MFA, verificação de vínculo, RLS e auditoria existentes.

## Novidades
- Migração `infra/migrations/0005_structured_record.sql`: alergias, medidas, laboratórios, ordens, administrações e avaliações farmacêuticas, com RLS por organização e grants apenas de leitura para a API.
- `infra/seeds/seed_m2_1_synthetic.sql`: registros fictícios para os dois pacientes de desenvolvimento.
- `GET /v1/patients/:patientId/record`: acrescenta `structured`, somente após autorização de profissional vinculado.
- Interface do prontuário: seis seções estruturadas e proveniência; sem recomendações ou automações.

## Executar (após instalar/configurar a M2)
1. Configurar PostgreSQL, OIDC, variáveis `.env` e executar migrações/seeds anteriores seguindo `README.md`.
2. `bash infra/scripts/migrate-m2-1-dev.sh` com `DATABASE_URL_ADMIN` apontando **somente** para `oncopharma_dev`.
3. Iniciar API e portal conforme README da M2; habilitar apenas em DEV `ALLOW_SYNTHETIC_API=true` e `NEXT_PUBLIC_ALLOW_SYNTHETIC_UI=true`.
4. Entrar com identidade de teste previamente vinculada e MFA; abrir Clinical e selecionar paciente sintético.

## Segurança e limites
- Não se permite acesso em `NODE_ENV=production`; sem prescrições ou administração via API; sem IA ativa.
- Prescrição e administração são tabelas distintas. Ausência de administração não significa não administração: pode haver registro externo ainda não integrado.
- Faixas laboratoriais ilustrativas **não são referência clínica validada**; unidades e códigos exigem terminologias e governança antes da homologação.
- Modelo preparado para mapeamento futuro a HL7 FHIR R4 (Observation, AllergyIntolerance, MedicationRequest, MedicationAdministration), **não é um servidor FHIR nem possui conformidade certificada**.
- Pendências: teste real de migração, build TypeScript/Next, teste E2E com PostgreSQL/OIDC, validação de conteúdo clínico, revisão LGPD e avaliação regulatória.
