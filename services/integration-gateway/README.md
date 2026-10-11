# Integrações hospitalares — M7

Contratos e arquitetura preparados. **Nenhuma conexão ativa** com Tasy/MV/FHIR. Exigir autorização institucional, mapeamento de identidade, consentimento/base legal, acordos, testes de idempotência, proveniência, reconciliação e governança de códigos.

Fluxo planejado: conector autorizado → validação → fila/quarentena → mapeamento FHIR R4 → armazenamento de origem → evento interno → auditoria. Não importar dados de terceiros em DEV.
