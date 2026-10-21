// M16 (P1): avaliação de urgência NO CLIENTE, espelho da regra care-demo-v1 de services/api/src/care-rules.ts
// (assessSymptom: sintoma febre, qualquer sinal de alerta ou intensidade forte). Serve só para mostrar a orientação
// de procurar atendimento imediatamente, mesmo sem servidor/rede. A classificação registrada continua sendo a do servidor.
export type UrgencyInput = { symptomCode: string; intensity: string; redFlags: string[] };
export function isUrgentLocal(a: UrgencyInput): boolean {
  return a.symptomCode === 'fever' || a.redFlags.length > 0 || a.intensity === 'forte';
}
export const LOCAL_URGENT_TITLE = 'Procure atendimento agora';
export const LOCAL_URGENT_TEXT = 'Pelo que você marcou, não espere resposta pelo aplicativo: ele não é acompanhado em tempo real. Ligue 192 (SAMU), vá ao pronto-atendimento mais próximo ou ligue para o seu hospital. Você pode salvar o relato depois.';
export const SEND_FAILED_TEXT = 'Não foi possível enviar: seu relato NÃO foi registrado. Tente enviar de novo (não haverá registro duplicado).';
