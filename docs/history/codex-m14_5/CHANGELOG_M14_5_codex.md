# Changelog M14.5 - 11/10/2026

Baseline M14.4 preservada. Plano Diretor v3 e D-001 a D-008 mantidos.

## Correções
- `ClinicalAccess`: diretiva client na primeira posição.
- `WorkflowReview`: tipo `Alert` inclui `rule_version`.
- Clinical: contraste do rótulo corrigido com token navy aprovado, inclusive referência canônica.
- Vínculo profissional consultado em transação com tenant.
- API/provisionamento/test runner recusam superusuário e BYPASSRLS.
- Callback OIDC verifica ID token e access token; valida nonce, issuer, audience, assinatura e expiração.

## Reprodução e evidência
- Node 22, package-lock e npm ci no CI; secrets em ambiente.
- Build das aplicações/API e checks dos pacotes JS; portal de compatibilidade preservado.
- Healthchecks; Playwright + axe; Keycloak efêmero e seis contas TOTP sintéticas.
- Novos testes DB/API/E2E/identidade e relatório PASS/FAIL/BLOCKED com digest de fonte.

## Bloqueios mantidos
PostgreSQL não iniciou; RLS e fluxo vertical integrado não executados. RBAC institucional, patientId no fluxo real, operação clínica, provedor institucional e aprovações externas continuam pendentes. Logout global IdP não validado. Produção/assistência permanecem bloqueadas.

Falhas e tentativas anteriores da própria M14.5 estão preservadas nos logs. A rodada após npm ci executado durante testes foi invalidada por falhas de módulos e repetida sequencialmente. O arquivo validation-report.json representa a rodada final, sem apagar essas tentativas.
