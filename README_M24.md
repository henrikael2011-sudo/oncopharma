# M24 — Autocadastro por convite (link + QR) e painel base do farmacêutico hospitalar

**Somente dados fictícios · ambiente de teste · não liberado para uso clínico. O ONCOPHARMA não decide conduta: a equipe avalia.**

## 1. Autocadastro do paciente/cuidador
- Equipe (farmácia, enfermagem ou medicina; MFA + vínculo profissional) gera em **Clinical → Cadastros por convite** um convite de **uso único** com validade (24 h, 72 h ou 7 dias; máx. 7 dias também no banco). Sai como **link + QR** (SVG gerado no servidor).
- Token `r1.<payload>.<HMAC-SHA256>` assinado com `REGISTRATION_TOKEN_SECRET`; o banco guarda só o **SHA-256** do token. Uso único garantido na transação (`FOR UPDATE` + `used_at IS NULL`) e por `UNIQUE(invite_id)` em `patient_registrations`.
- Paciente/cuidador abre `/cadastro/<token>` no Care **sem login** (página `no-referrer`, `noindex`), preenche nome, nascimento, contato, cuidador, diagnóstico/tratamento *como informado* e consentimento.
- Validação no servidor (`registration-rules.ts`), limite de tentativas no BFF e na API (por hash do cliente e por convite), mesma mensagem para convite inválido/expirado/usado.
- Registro nasce `pending_review` (**pendente de conferência**); dados pessoais cifrados (AES-256-GCM, `CARE_ENCRYPTION_KEY`); auditoria **sem dado pessoal**.
- A equipe confere: **Confirmar** (informa o prontuário; o paciente sintético é criado com os dados enviados — sem redigitação) ou **Devolver** com motivo.
- Migração **0019_patient_self_registration.sql** (RLS FORCE, INSERT só pendente/sintético, dados enviados imutáveis, sem DELETE).

## 2. Painel do farmacêutico hospitalar (base)
- **Clinical → Painel hospitalar**: fila de alertas abertos dos pacientes vinculados, **gravidade (urgente) e depois tempo de espera** (mais antigo primeiro), atualização por consulta a cada 15 s (pausa com a aba oculta).
- Detalhe por paciente: check-ins de 14 dias (sintomas, temperaturas — febre a partir de **37,8 °C** — e adesão), alertas, medicamentos ativos e orais do **hospital SIMULADO** (integration-gateway, FHIR R4 fictício). Alocação vem da sincronização simulada existente.
- Só leitura e auditado; conduta continua no prontuário do paciente pela equipe.

## Pendências / decisões
- Integração real Tasy/MV (adaptador, credenciais, homologação) — fora do escopo; aqui é simulada e rotulada.
- Vínculo assistencial (care_assignments) do paciente recém-confirmado continua por procedimento administrativo (regra da 0002); decidir se quem confere passa a ser vinculado automaticamente.
- Texto do consentimento do cadastro é provisório (`cadastro-ficticio-v1`) — revisão jurídica/LGPD.
- Envio do link por SMS/WhatsApp/e-mail não implementado (equipe copia o link ou mostra o QR).
- Tempo real por SSE/WebSocket e alerta sonoro: avaliar após o piloto (hoje consulta periódica).
