// M15.2 — regras do Care para relato estruturado de sintoma. Conteúdo DEMONSTRATIVO (rule_version care-demo-v1):
// perguntas e mensagens provisórias, pendentes de validação clínica institucional. Não é triagem validada,
// não sugere conduta nem dose; qualquer sinal de alerta => prioridade para a equipe + orientação imediata de procurar atendimento.
import { BadRequestException } from '@nestjs/common';
export const CONSENT_TERMS_VERSION = 'care-termos-2026-10';
export const SYMPTOMS = { nausea: 'Enjoo ou vômito', neuropathy: 'Formigamento', fever: 'Febre', diarrhea: 'Diarreia', fatigue: 'Cansaço', pain: 'Dor', mouth: 'Feridas na boca', other: 'Outro' } as const;
export type SymptomCode = keyof typeof SYMPTOMS;
export const INTENSITY = ['leve', 'moderada', 'forte'] as const;
export const ONSET = ['hoje', '1-3-dias', 'mais-3-dias'] as const;
export const RED_FLAGS = { febre: 'Febre (37,8 °C ou mais)', falta_ar: 'Falta de ar', sangramento: 'Sangramento', nao_bebe: 'Não consigo beber líquidos', confusao: 'Confusão ou muita sonolência' } as const;
export type SymptomAnswers = { symptomCode: SymptomCode; intensity: typeof INTENSITY[number]; onset: typeof ONSET[number]; redFlags: (keyof typeof RED_FLAGS)[]; description: string; requestId: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseSymptomAnswers(b: Record<string, unknown>): SymptomAnswers {
  if (!b || typeof b !== 'object') throw new BadRequestException('Relato inválido');
  const symptomCode = String(b.symptomCode) as SymptomCode;
  if (!(symptomCode in SYMPTOMS)) throw new BadRequestException('Escolha o sintoma');
  const intensity = String(b.intensity) as SymptomAnswers['intensity'];
  if (!INTENSITY.includes(intensity)) throw new BadRequestException('Escolha a intensidade');
  const onset = String(b.onset) as SymptomAnswers['onset'];
  if (!ONSET.includes(onset)) throw new BadRequestException('Informe quando começou');
  const redFlags = Array.isArray(b.redFlags) ? b.redFlags.map(String) : [];
  if (redFlags.length > 5 || redFlags.some((f) => !(f in RED_FLAGS)) || new Set(redFlags).size !== redFlags.length) throw new BadRequestException('Sinais de alerta inválidos');
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (description.length > 1000) throw new BadRequestException('Descrição muito longa');
  const requestId = String(b.requestId);
  if (!UUID.test(requestId)) throw new BadRequestException('requestId deve ser UUID');
  return { symptomCode, intensity, onset, redFlags: redFlags as SymptomAnswers['redFlags'], description, requestId };
}
// M16 (P1): sem fila monitorada (D-008), a mensagem NUNCA afirma que a equipe foi avisada; diz que foi registrado
// e manda procurar atendimento/192 explicitamente, sem esperar resposta pelo app.
export const URGENT_MESSAGE = 'Seu relato foi registrado no sistema, mas este aplicativo não é acompanhado em tempo real e não gera aviso imediato para a equipe. Não espere resposta pelo app: procure atendimento agora — ligue 192 (SAMU), vá ao pronto-atendimento mais próximo ou ligue para o seu hospital.';
export const ROUTINE_MESSAGE = 'Seu relato foi registrado no sistema e ficará disponível para a sua equipe avaliar. Este aplicativo não é acompanhado em tempo real. Se piorar ou surgir febre, falta de ar ou sangramento, não espere resposta pelo app: ligue 192 (SAMU) ou para o seu hospital.';
/** M16 (P1): estado do relato no histórico do paciente derivado do estado REAL do alerta (clinical_alerts.status). */
export function reportStatusLabel(alertStatus: string | null | undefined, urgent: boolean): string {
  switch (alertStatus) {
    case 'detected': case 'awaiting_review': return urgent ? 'Registrado — prioridade, aguardando avaliação da equipe' : 'Registrado — aguardando avaliação da equipe';
    case 'in_evaluation': case 'referred': case 'monitoring': return 'Em avaliação pela equipe';
    case 'resolved': case 'dismissed': return 'Avaliado pela equipe';
    case 'duplicate': return 'Avaliado pela equipe (registro repetido)';
    default: return 'Registrado';
  }
}
export function assessSymptom(a: SymptomAnswers) {
  const urgent = a.symptomCode === 'fever' || a.redFlags.length > 0 || a.intensity === 'forte';
  const reasons = [...(a.symptomCode === 'fever' ? ['sintoma febre'] : []), ...a.redFlags.map((f) => `sinal de alerta: ${RED_FLAGS[f]}`), ...(a.intensity === 'forte' ? ['intensidade forte'] : [])];
  return { urgent, ruleVersion: 'care-demo-v1', patientMessage: urgent ? URGENT_MESSAGE : ROUTINE_MESSAGE,
    explanation: urgent ? `Regra demonstrativa: prioridade por ${reasons.join(', ')}. Exige avaliação profissional; não representa diagnóstico ou conduta.` : 'Regra demonstrativa: exige avaliação profissional. Não representa diagnóstico ou conduta.',
    details: { intensity: a.intensity, onset: a.onset, redFlags: a.redFlags, questionnaire: 'care-demo-v1' } };
}
