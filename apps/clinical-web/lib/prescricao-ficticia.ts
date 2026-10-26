// M18 — Validação de prescrição por foto, FASE A. Dados 100% FICTÍCIOS (nenhum paciente, protocolo ou dose real).
// PROVISÓRIO (Q1 — exemplos de prescrição): sem exemplos reais do Henrikael; usamos apenas esta prescrição inventada.
// PROVISÓRIO (Q2 — protocolos comuns): nenhum protocolo real nomeado; "Esquema Fictício X" é um rótulo genérico.
// Ver docs/decisoes-provisorias-prescricao-foto.md.
export type ItemStatus = 'pendente' | 'conferido' | 'desvalidado';
export type ItemPrescricao = { id: string; campo: string; lido: string; sugestao: string };
export const PRESCRICAO_FICTICIA = {
  paciente: 'Paciente Fictício 001', esquema: 'Esquema Fictício X (sem correspondência clínica)',
  linhasFoto: ['PRESCRIÇÃO FICTÍCIA — EXEMPLO DE TESTE', 'Paciente: Paciente Fictício 001', 'Peso: 70 kg · Altura: 170 cm', 'Medicamento A fictício — 100 mg/m² — D1', 'Medicamento B fictício — 50 mg — D1', 'Data: 01/01/2099'],
  itens: [
    { id: 'peso', campo: 'Peso / altura', lido: '70 kg · 170 cm', sugestao: 'Conferir com o registro mais recente do prontuário.' },
    { id: 'sc', campo: 'Superfície corporal', lido: 'não informada na foto', sugestao: 'Valor deve ser calculado e conferido pelo farmacêutico.' },
    { id: 'medA', campo: 'Medicamento A fictício', lido: '100 mg/m² — D1', sugestao: 'Conferir dose, unidade e dia do ciclo.' },
    { id: 'medB', campo: 'Medicamento B fictício', lido: '50 mg — D1', sugestao: 'Conferir ordem de infusão e estabilidade.' },
    { id: 'data', campo: 'Data da prescrição', lido: '01/01/2099', sugestao: 'Data fictícia; conferir validade.' },
  ] as ItemPrescricao[],
};
// PROVISÓRIO (Q3 — ciência sobre fase B): fase B permanece BLOQUEADA; nenhum dado real, upload ou envio à API.
export const FASE_B_HABILITADA = false as const;
export const readyForClinicalUse = false as const;
