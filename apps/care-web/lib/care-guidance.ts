// M21 — textos clínicos APROVADOS do Care, reunidos num só lugar. Fonte: Help.tsx (M15.2) e
// services/api/src/care-rules.ts (RED_FLAGS, regra care-demo-v1). Mockups são só referência visual:
// nenhum limiar, passo ou orientação clínica vem deles.
export const FEVER_THRESHOLD_C = 37.8;
export const FEVER_THRESHOLD_LABEL = '37,8 °C';
export const WARNING_TITLE = 'Procure atendimento imediato se tiver';
export const WARNING_SIGNS = ['Febre (37,8 °C ou mais)', 'Falta de ar', 'Sangramento', 'Não conseguir beber líquidos', 'Confusão ou muita sonolência'] as const;
export const EMERGENCY_TEXT = 'Em caso de emergência, ligue 192 (SAMU).';
export const MEDICATION_RULE = 'Siga sempre a orientação da sua equipe. Não altere doses por conta própria.';
