# Revisão clínica — textos do PR #12 (M16 P1 segurança do paciente) + termo care-termos-2026-10

> **Nada aqui está validado.** Este checklist é para a validação profissional do Henrikael. **Não liberado para uso clínico.**
> Referência: https://github.com/henrikael2011-sudo/oncopharma/pull/12. Linhas conforme `main` (commit 6c016ff).

## A. Textos ao paciente introduzidos pelo PR #12

- [ ] `apps/care-web/lib/care-urgency.ts:8`: título urgente local: "Procure atendimento agora"
- [ ] `apps/care-web/lib/care-urgency.ts:9`: orientação urgente local (antes do envio, sem API): "Pelo que você marcou, não espere resposta pelo aplicativo: ele não é acompanhado em tempo real. Ligue 192 (SAMU), vá ao pronto-atendimento mais próximo ou ligue para o seu hospital. Você pode salvar o relato depois."
- [ ] `apps/care-web/lib/care-urgency.ts:10`: falha de envio: "Não foi possível enviar: seu relato NÃO foi registrado. Tente enviar de novo (não haverá registro duplicado)."
- [ ] `apps/care-web/components/care/SymptomFlow.tsx:28`: título de sucesso: "Relato registrado" (ou o título urgente acima)
- [ ] `apps/care-web/components/care/SymptomFlow.tsx:31`: botão pós-envio urgente: "Ligar 192" (`tel:192`)
- [ ] `apps/care-web/components/care/SymptomFlow.tsx:36`: bloco de alerta local com título, texto e botão "Ligar 192"
- [ ] `services/api/src/care-rules.ts:31`: `URGENT_MESSAGE`: "Seu relato foi registrado no sistema, mas este aplicativo não é acompanhado em tempo real e não gera aviso imediato para a equipe. Não espere resposta pelo app: procure atendimento agora — ligue 192 (SAMU), vá ao pronto-atendimento mais próximo ou ligue para o seu hospital."
- [ ] `services/api/src/care-rules.ts:32`: `ROUTINE_MESSAGE`: "Seu relato foi registrado no sistema e ficará disponível para a sua equipe avaliar. Este aplicativo não é acompanhado em tempo real. Se piorar ou surgir febre, falta de ar ou sangramento, não espere resposta pelo app: ligue 192 (SAMU) ou para o seu hospital."
- [ ] `services/api/src/care-rules.ts:36`: histórico: "Registrado — prioridade, aguardando avaliação da equipe" / "Registrado — aguardando avaliação da equipe"
- [ ] `services/api/src/care-rules.ts:37`: histórico: "Em avaliação pela equipe"
- [ ] `services/api/src/care-rules.ts:38`: histórico: "Avaliado pela equipe"
- [ ] `services/api/src/care-rules.ts:39`: histórico: "Avaliado pela equipe (registro repetido)"
- [ ] `services/api/src/care-rules.ts:40`: histórico (padrão): "Registrado"

## B. Regra clínica introduzida pelo PR #12 (comportamento, não texto)

- [ ] `apps/care-web/lib/care-urgency.ts:5-7`: critério de urgência local, igual ao servidor `care-demo-v1`: sintoma febre **ou** qualquer sinal de alerta **ou** intensidade "forte". Confirmar se o critério está clinicamente adequado

## C. Proposta de atualização do termo de consentimento (`care-termos-2026-10`), neste PR

- [ ] `apps/care-web/components/care/Consent.tsx:15`: "O que você registrar aqui fica salvo no sistema para a sua equipe de cuidado avaliar depois." (substitui "…é enviado para a sua equipe de cuidado.")
- [ ] `apps/care-web/components/care/Consent.tsx:16`: (novo) "Este aplicativo não é acompanhado em tempo real: a equipe não recebe aviso imediato do que você registra."
- [ ] `apps/care-web/components/care/Consent.tsx:17`: (sem alteração) "Somente pessoas da equipe ligadas ao seu tratamento podem ver seus registros. Todo acesso fica registrado."
- [ ] `apps/care-web/components/care/Consent.tsx:18`: "Este aplicativo não substitui consulta nem atendimento de urgência. Se piorar ou em uma emergência, não espere resposta pelo app: ligue 192 (SAMU) ou para o seu hospital."
- [ ] `apps/care-web/components/care/Consent.tsx:19`: (sem alteração) "Você pode pedir à equipe, a qualquer momento, para encerrar o uso."
- [ ] **Decisão pendente:** manter a versão `care-termos-2026-10` (`services/api/src/care-rules.ts:5`) ou criar uma nova versão (ex.: `care-termos-2026-11`) para exigir novo aceite de quem já aceitou o texto anterior. Neste PR a versão foi **mantida**
- [ ] Revisão jurídica/LGPD da instituição (pendência herdada do M15.2)

Validado por: ________ · Data: ________ (em branco até a validação profissional)
