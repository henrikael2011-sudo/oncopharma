# ADR-001 — Plataforma única com duas experiências
Data: 2026-10-10 · Estado: aprovado pelo direcionamento de produto

## Contexto
Care exige acessibilidade e linguagem simples; Clinical exige informação técnica e controle de acesso.

## Decisão
Um monorepo e uma identidade de marca com rotas Care e Clinical; serviços centrais isolados por API. Uma aplicação Next.js para a fundação M0, passível de divisão posterior sem duplicar domínio.

## Consequências
Compartilhamento de tokens e contratos. Antes de qualquer dado real, autenticação, autorização, isolamento por organização e segurança precisam estar implementados e testados.
