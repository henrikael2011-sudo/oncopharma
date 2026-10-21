# RF — Prescrição por foto e prescrição online editável

Registrado em 21/10/2026 a pedido de Henrikael Walisson. Status: **planejado** — não liberado para uso clínico.
Referências: PR #15 (fase A, página `/clinical/prescricao-foto`, dados fictícios), PR #11 (base), `RF_PRESCRICAO_ASSISTIDA_IA.md`, `RF_SOLICITACAO_ALTERACAO_MEDICO.md` (M15.5).
Marco: fase A em **M18 (PR #15)**; itens 2 e 3 em fase B, bloqueada (`FASE_B_HABILITADA=false`) até validação clínica, LGPD e Anvisa.

## 1. Foto da prescrição → versão online editável
- Farmacêutico fotografa/anexa a prescrição; o sistema mostra a foto de um lado e os itens transcritos do outro, editáveis.
- Cada item: Validar / Desvalidar / Voltar a pendente; rodapé com o resumo do que falta.
- Enquanto não houver liberação: **somente dados fictícios**.

## 2. Criação automática a partir só da foto
- Quando a foto for legível, o sistema gera sozinho a prescrição online.
- Sempre como **rascunho** ("Resumo com IA · rascunho"), com o aviso "A IA não decide".
- Nenhum item fica validado sem ação do farmacêutico; nada é liberado automaticamente.

## 3. Abrir prescrição existente como documento editável
- Clicar num paciente que já tem prescrição no sistema abre a prescrição numa página editável estilo documento (tipo Word).
- Histórico de versões: quem editou, quando, o que mudou (trilha de auditoria imutável).
- Permissões por papel (RBAC/ABAC) e RLS por organização.

## 4. Cuidado regulatório
- Alterar o conteúdo da prescrição em si é atribuição do **médico prescritor**.
- O farmacêutico registra validação, observações e intervenções; mudanças de conduta seguem como solicitação ao médico (M15.5, D-012).
- Seguir RDC Anvisa 657/2022 e LGPD; sem dados reais até validação clínica de Henrikael.
