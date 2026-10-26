// M21 — textos clínicos APROVADOS do Care, reunidos num só lugar. Fonte: Help.tsx (M15.2) e
// services/api/src/care-rules.ts (RED_FLAGS, regra care-demo-v1). Mockups são só referência visual:
// nenhum limiar, passo ou orientação clínica vem deles.
export const FEVER_THRESHOLD_C = 37.8;
export const FEVER_THRESHOLD_LABEL = '37,8 °C';
export const WARNING_TITLE = 'Procure atendimento imediato se tiver';
export const WARNING_SIGNS = ['Febre (37,8 °C ou mais)', 'Falta de ar', 'Sangramento', 'Não conseguir beber líquidos', 'Confusão ou muita sonolência'] as const;
export const EMERGENCY_TEXT = 'Em caso de emergência, ligue 192 (SAMU).';
export const MEDICATION_RULE = 'Siga sempre a orientação da sua equipe. Não altere doses por conta própria.';
// M23 — orientações de urgência por alerta (rascunho audit-oncopharma/orientacoes-urgencia-rascunho.md, autorizado por Henrikael).
// NÃO criam regra nem limiar: cada chave corresponde a um gatilho JÁ existente em services/api/src/care-rules.ts
// (RED_FLAGS linha 10; assessSymptom linha 44: sintoma febre, sinal de alerta ou intensidade forte). Sem dose; o app não diagnostica.
// LACUNAS (fora do app): calafrio, febre axilar, nível amarelo, limiares de vômito/diarreia/dor/sangramento, náusea separada de vômito.
export type AlertKey = 'febre' | 'falta_ar' | 'sangramento' | 'nao_bebe' | 'confusao' | 'forte';
export type AlertGuidance = { title: string; patient: string; caregiver: string; source: string };
export const ALERT_GUIDANCE: Record<AlertKey, AlertGuidance> = {
  febre: { title: 'Febre: procure atendimento agora', patient: 'Sua temperatura deu 37,8 °C ou mais. Procure atendimento agora. Ligue 192 ou vá ao pronto-atendimento. Não espere resposta pelo app.', caregiver: 'A temperatura deu 37,8 °C ou mais. Leve a pessoa ao pronto-atendimento agora ou ligue 192. Leve os papéis do tratamento. Não espere resposta pelo app.', source: 'care-rules.ts:10 RED_FLAGS.febre; :52 FEVER_THRESHOLD_C; :44 symptomCode fever' },
  falta_ar: { title: 'Falta de ar: procure atendimento agora', patient: 'Está com falta de ar? Ligue 192 agora. Não espere resposta pelo app.', caregiver: 'A pessoa está com falta de ar. Ligue 192 agora. Fique ao lado dela.', source: 'care-rules.ts:10 RED_FLAGS.falta_ar' },
  sangramento: { title: 'Sangramento: procure atendimento agora', patient: 'Está sangrando? Procure atendimento agora. Ligue 192 ou vá ao pronto-atendimento.', caregiver: 'A pessoa está sangrando. Leve ao pronto-atendimento agora ou ligue 192.', source: 'care-rules.ts:10 RED_FLAGS.sangramento' },
  nao_bebe: { title: 'Sem conseguir beber: procure atendimento', patient: 'Não consegue beber líquidos? Procure atendimento agora. Ligue para o seu hospital ou vá ao pronto-atendimento.', caregiver: 'A pessoa não consegue beber líquidos. Leve ao pronto-atendimento agora ou ligue 192.', source: 'care-rules.ts:10 RED_FLAGS.nao_bebe' },
  confusao: { title: 'Confusão ou muito sono: ligue 192', patient: 'Se sentir confuso ou com muito sono, peça ajuda. Ligue 192 agora.', caregiver: 'A pessoa está confusa ou com muito sono. Ligue 192 agora. Não deixe a pessoa sozinha.', source: 'care-rules.ts:10 RED_FLAGS.confusao' },
  forte: { title: 'Sintoma forte: procure atendimento agora', patient: 'Você marcou um sintoma forte. Procure atendimento agora. Ligue para o seu hospital ou vá ao pronto-atendimento. Não espere resposta pelo app.', caregiver: 'A pessoa está com um sintoma forte. Leve ao pronto-atendimento ou ligue para o hospital agora. Se piorar, ligue 192.', source: 'care-rules.ts:44 intensity forte' },
};
export const ROUTINE_GUIDANCE: AlertGuidance = { title: 'Relato registrado', patient: 'Seu relato foi registrado. O app não é acompanhado em tempo real. Se piorar ou surgir febre, falta de ar ou sangramento, ligue 192 ou para o seu hospital.', caregiver: 'O relato foi registrado. Fique atento. Se a pessoa piorar ou tiver febre, falta de ar ou sangramento, ligue 192 ou para o hospital.', source: 'care-rules.ts:32 ROUTINE_MESSAGE' };
/** Gatilhos idênticos a assessSymptom (care-rules.ts:44); só escolhe o texto, não classifica. */
export function alertKeys(a: { symptomCode: string; intensity: string; redFlags: string[] }): AlertKey[] {
  const keys: AlertKey[] = [];
  if (a.symptomCode === 'fever' || a.redFlags.includes('febre')) keys.push('febre');
  for (const f of ['falta_ar', 'sangramento', 'nao_bebe', 'confusao'] as const) if (a.redFlags.includes(f)) keys.push(f);
  if (a.intensity === 'forte') keys.push('forte');
  return keys;
}
