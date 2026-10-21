# IA na conferência de prescrição (M19) — Gemini / Groq / mock

> **IA não decide.** O módulo gera um *rascunho* de apoio; quem valida é sempre o farmacêutico.
> **Demonstração não clínica, somente dados fictícios** (ex.: paciente "Maria (fictícia)"). Proibido uso com pacientes reais.

## O que faz
- Recebe uma prescrição **fictícia** (peso, altura, SC, protocolo — ex.: FOLFOX — e itens com dose, diluente, volume e ordem de infusão).
- Para cada item retorna JSON estrito com 4 verificações — `dose_vs_bsa`, `protocol`, `dilution`, `infusion_order` — cada uma com `status` (`ok` | `divergente` | `incerto`), `rule` e `suggestion`, mais `disclaimer` fixo.
- Resultado sempre marcado `decision: PENDING_PHARMACIST_VALIDATION`.

## Onde está
- Módulo (somente servidor): `services/ai-orchestrator/src/prescription-check/index.mjs` (`GeminiProvider`, `GroqProvider`, `MockProvider`, guarda, schema, prompt pt-BR).
- Endpoint: `apps/clinical-web/app/api/ia/conferencia/route.ts` (exige sessão e ambiente sintético `dev/hml/test`; em `prod` responde 503).
- Tela: `/clinical/conferencia-ia` (link "Conferência com IA (teste)" na lista de pacientes). Mostra "Resumo com IA · rascunho", o selo **IA não decide** e **qual provedor respondeu**.
- Testes (sem rede, `fetch` simulado): `services/ai-orchestrator/tests/prescription-check.test.mjs` (`npm run test:extended`).

## Seleção de provedor (em tempo de execução)
1. `GEMINI_API_KEY` definida → Gemini (REST `v1beta/models/<modelo>:generateContent`, header `x-goog-api-key`, `responseMimeType: application/json` + `responseSchema`). Modelo padrão `gemini-2.5-flash-lite`, sobrescrevível por `GEMINI_MODEL`.
2. Senão `GROQ_API_KEY` → Groq (endpoint OpenAI-compatível `https://api.groq.com/openai/v1/chat/completions`, `GROQ_MODEL` opcional).
3. Senão → mock determinístico local (referência didática FOLFOX).

Falha do provedor real (rede, HTTP 4xx/5xx, 429, JSON inválido) → cai para o mock e a tela informa `fallbackFrom`.

> Observação (21/10/2026): para chaves novas o Google retorna 404 "no longer available to new users" para `gemini-2.5-flash-lite`. Defina `GEMINI_MODEL=gemini-flash-lite-latest` (testado com sucesso).

## Como configurar
1. Gere a chave em https://aistudio.google.com/apikey (conta 18+).
2. No servidor do Clinical (nunca no navegador, nunca `NEXT_PUBLIC_*`): `GEMINI_API_KEY=...` e, se necessário, `GEMINI_MODEL=gemini-flash-lite-latest`.
3. `.env` é ignorado pelo git; `.env.example` contém só placeholder vazio. Nunca commitar chaves.
4. Alternativa: `GROQ_API_KEY` (https://console.groq.com).

## Segurança e privacidade
- Guarda recusa entrada sem `fictional: true`, marcada como real (`real`, `realPatient`, `dataOrigin: "real"`) ou contendo padrão de CPF/CNS.
- Chave apenas em variável de ambiente, enviada em header (não na URL); campo privado no provedor; logs nunca incluem prompt nem chave.

## Resumo dos termos (Gemini API — https://ai.google.dev/gemini-api/terms)
- **Nível gratuito:** o Google pode usar entradas e saídas para melhorar seus produtos e **revisores humanos** podem lê-las → não enviar dados pessoais, sensíveis ou confidenciais.
- **Uso clínico proibido:** os termos vedam uso para aconselhamento médico/clínico ou em contexto que exija conformidade regulatória de saúde sem autorização → aqui somente **demo com dados fictícios**.
- Idade mínima **18 anos** para usar a API.
- Rotular saídas como geradas por IA → selo **"IA não decide"** e "rascunho".
- Groq: termos próprios; mesmas regras de dados fictícios se aplicam.
