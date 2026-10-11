# ADR-002 — Falhar fechado para dados clínicos
Data: 2026-10-10 · Estado: aprovado como regra de engenharia

Nenhum endpoint de paciente é disponibilizado em M0. A API oferece apenas `GET /v1/health`, que indica liveness e **não** prontidão clínica. CORS fechado por padrão. Em M1: OIDC/MFA, autorização RBAC+ABAC, vínculo assistencial, auditoria, criptografia e segregação institucional. Dados reais proibidos antes da validação de privacidade, segurança, operação e enquadramento regulatório.
