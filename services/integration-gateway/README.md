# Integrações hospitalares — M7

Contratos e arquitetura preparados. **Nenhuma conexão ativa** com Tasy/MV/FHIR. Exigir autorização institucional, mapeamento de identidade, consentimento/base legal, acordos, testes de idempotência, proveniência, reconciliação e governança de códigos.

Fluxo planejado: conector autorizado → validação → fila/quarentena → mapeamento FHIR R4 → armazenamento de origem → evento interno → auditoria. Não importar dados de terceiros em DEV.

## Conector Philips Tasy (HTML5) — demonstração não clínica

`src/connectors/tasy.mjs` (registro em `src/connectors/index.mjs`): conector por fornecedor, **somente mock com dados fictícios** (`fixtures/tasy/`).
Mapeia payloads no estilo Tasy (paciente, atendimento, prescrição, resultados) para FHIR R4 (Patient, Encounter, MedicationRequest, Observation) e interpreta HL7 v2 ADT^A01/A02/A03 e ORM^O01.
Variáveis: `TASY_MODE` (só `mock`), `TASY_BASE_URL` (https), `TASY_AUTH_TYPE` (none|basic|bearer|oauth2), `TASY_CLIENT_ID`, `TASY_CLIENT_SECRET`, `TASY_TOKEN_URL`, `TASY_FACILITY`.
Os nomes de campos Tasy são ilustrativos; o contrato real depende da interface liberada pela TI do hospital (API/FHIR do Tasy ou motor de integração HL7).
