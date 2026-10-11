# ONCOPHARMA — execução consolidada dos marcos M2.2–M8

**Estado:** implementação de base, protótipo navegável e contratos. **Não equivale a produto hospitalar implantado, certificado ou clinicamente validado.**

| Marco | Entrega neste pacote | Falta para conclusão operacional |
|---|---|---|
| M2.2 Pré-ciclo | Checklist, regras sintéticas e visualização de conferência | Protocolo institucional, limiares validados, persistência autorizada, E2E |
| M3 Care | Jornada demonstrativa de sintomas, cuidador e orientações | Autenticação de paciente, consentimento, notificações reais e equipe de retaguarda |
| M4 Clinical | Painel de fila, visualização longitudinal e revisão | Workflows persistidos, filas reais, escala/SLA |
| M5 Regras | Motor determinístico versionado e testes unitários | Aprovação por comitê, validação retrospectiva/prospectiva, governança |
| M6 IA | Especificação de orquestração com RAG e revisão humana | Conector de modelo, corpus licenciado, validação e monitoramento de desempenho |
| M7 Integrações | Contrato de eventos e plano de gateway | Integração real autorizada com FHIR/Tasy/MV e testes com fornecedor |
| M8 Piloto | Plano de testes, riscos e critérios de go/no-go | Infraestrutura, equipe, jurídico/LGPD, segurança, avaliação regulatória e homologação |

## Próxima fase real
1. Instalar dependências e executar builds Next/Nest; subir PostgreSQL e executar migrações em DEV.
2. Validar login OIDC/MFA e RLS com testes de isolamento e tentativas de acesso cruzado.
3. Implementar endpoints de escrita com ABAC e trilha de auditoria transacional (a API existente permanece leitura).
4. Revisar os fluxos de escalonamento e estabelecer responsável clínico, disponibilidade e SLA.
5. Validar protocolos e regras com equipe multiprofissional e avaliação de software como dispositivo médico, quando aplicável.
6. Executar piloto supervisionado somente após aprovação formal e ambiente apropriado.
