# ADR-003 — M1 Identidade, persistência e segurança (10/10/2026)

**Status:** Implementação parcial; não homologada. A API valida access tokens JWT OIDC (issuer/audience/JWKS), exige claim MFA para rota profissional, verifica associação ativa ao tenant, exige vínculo paciente-profissional, usa transação com contexto local para RLS e audita a leitura de lista. Os endpoints retornam apenas pacientes sintéticos quando explicitamente habilitados em DEV; em produção permanecem bloqueados.

**Limitações conhecidas e gates antes de produção:** (1) configurar provedor OIDC real, fluxo Authorization Code + PKCE no portal e sessões seguras; (2) migrações transacionais gerenciadas, papéis DB com privilégio mínimo e validação RLS em PostgreSQL real; (3) implementar autorização por finalidade e unidade e permissões de paciente/cuidador; (4) política de auditoria imutável fora do DB, retenção e SIEM; (5) TLS e gestão de segredos, backups, restauração, HA, monitoramento e testes de carga; (6) teste de invasão e revisão LGPD/ANVISA; (7) CI/CD, ambientes DEV/HML/PROD separados; (8) homologação clínica e operacional.

**Sem login visual funcional ainda.** A API recebe access token obtido externamente do provedor OIDC; nenhuma credencial ou token de produção deve ser enviado a interfaces não homologadas.

**Risco técnico:** `FORCE ROW LEVEL SECURITY` com `INSERT`/`UPDATE` requer políticas adicionais e papel administrativo para futuras escritas. Não há escrita clínica exposta. O seed é exclusivamente de desenvolvimento e depende de papel de migração autorizado. O `health` não verifica prontidão clínica.
