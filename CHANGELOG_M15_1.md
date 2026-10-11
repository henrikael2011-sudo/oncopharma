# M15.1 — Fundação (Plano Diretor v3)

## Fundação
- Modo sintético explícito por `ONCO_ENVIRONMENT` (dev|hml|test); em `prod` nunca habilita (`services/api/src/synthetic-mode.ts`, `apps/*/lib/synthetic.ts`).
- OpenAPI 3.1 (`services/api/openapi.json`) + teste de contrato que exige cobertura exata das rotas e segurança OIDC.
- Remoção de componentes duplicados entre Care e Clinical (D-002).
- Dockerfiles multi-stage (`infra/docker/`), saída `standalone` opcional.

## Identidade (auditoria somente leitura incorporada; aparência aprovada preservada)
1. Foco: anel azul-petróleo (`--navy`) em fundos claros, dourado só em fundos escuros; foco visível em link, botão, campo, select, textarea.
2. `globals.css`: `:root` com os 8 tokens do Plano §2.2 + lista fechada e documentada de tons derivados (`packages/design-system/palette.json`); todas as regras usam `var(--…)`. `themeColor` = token aprovado.
3. Borda de campos `#a8c1c1` (1,90:1) → `--border-strong` `#5f7c84` (4,47:1 no branco).
4. `<title>`/descrição próprios: ONCOPHARMA Care / ONCOPHARMA Clinical / ONCOPHARMA Admin; `manifest.webmanifest` + ícone por app.
5. Assinatura do Care: “Um passo de cada vez. Juntos no cuidado.”
6. Care: ações verde-esmeralda, alvos de toque ≥48 px, corpo ≥18 px. Clinical: ação primária azul-petróleo.
7. Removidos selos de versão antigos (M14.1, M10.1) da interface.
8. Keycloak de teste: clientes exibidos como “ONCOPHARMA Care/Clinical/Admin” (sem “(teste)”).
9. Logotipo leva ao início do próprio app (`/care`, `/clinical`); removidos “← Voltar” que apontavam para `/` (que só redirecionava).
10. Admin: borda `#50747c` → `--border-strong` da paleta; admin-web incluído nas verificações.
11. `tools/check-brand.mjs` (`npm run check:brand`, em `verify:local` e CI): `:root` = Plano §2.2, nenhuma cor fora da lista, tabela de contraste (texto 4,5:1; foco/bordas 3:1), sem ®/™, títulos, sem “Intelligence” na UI.
- CI: job `integration` passa a rodar o E2E completo (Playwright + Chrome + axe) com Keycloak efêmero (senhas geradas por execução, mascaradas).
- Pendências mantidas: modo escuro (`prefers-color-scheme`) → M15.6; `apps/portal` aguarda decisão do Henrikael (não removido).
