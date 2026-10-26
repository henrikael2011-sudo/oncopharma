// M25 — Care: check-in diário e mensagens com a equipe. Validação pura (sem banco), mensagens fixas e regra de febre existente.
// O app só registra e encaminha: quem avalia e decide é a equipe. Mensagem NÃO é canal de urgência (192 SAMU).
import { BadRequestException } from '@nestjs/common';
import { parseTemperature, type TemperatureInput } from './care-rules';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FEELINGS = { bem: 'Estou bem', mais_ou_menos: 'Mais ou menos', mal: 'Não estou bem' } as const;
export type Feeling = keyof typeof FEELINGS;
export const MESSAGE_TOPICS = { geral: 'Dúvida geral', remedios: 'Remédios', consulta: 'Consulta ou sessão', outro: 'Outro assunto' } as const;
export type MessageTopic = keyof typeof MESSAGE_TOPICS;
export const NOTE_MAX = 500, MESSAGE_MAX = 1000, MESSAGE_MIN = 2;
export const MESSAGE_DISCLAIMER = 'Mensagens não são para urgência: a equipe responde em horário de atendimento. Em emergência, ligue 192 (SAMU) ou procure o pronto-atendimento mais próximo.';
export const CHECKIN_ROUTINE = 'Check-in de hoje enviado para a sua equipe. Você pode alterar até o fim do dia. Se piorar ou surgir febre, falta de ar ou sangramento, não espere resposta pelo app: ligue 192 (SAMU) ou para o seu hospital.';
export const CHECKIN_UNWELL = 'Check-in enviado: você informou que não está bem, e isso aparece para a sua equipe avaliar. Este aplicativo não é acompanhado em tempo real. Se piorar, ligue 192 (SAMU) ou procure atendimento.';
export type CheckinInput = { feeling: Feeling; note: string | null; temperature: TemperatureInput | null; requestId: string };
export function parseCheckin(b: Record<string, unknown>, now = new Date()): CheckinInput {
  if (!b || typeof b !== 'object') throw new BadRequestException('Check-in inválido');
  const feeling = String(b.feeling) as Feeling;
  if (!(feeling in FEELINGS)) throw new BadRequestException('Escolha como você está hoje');
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null;
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') throw new BadRequestException('Observação inválida');
  if (note && note.length > NOTE_MAX) throw new BadRequestException(`Observação: no máximo ${NOTE_MAX} caracteres`);
  const requestId = String(b.requestId);
  if (!UUID.test(requestId)) throw new BadRequestException('requestId deve ser UUID');
  const hasT = b.celsius !== undefined && b.celsius !== null && b.celsius !== '';
  const temperature = hasT ? parseTemperature({ celsius: b.celsius, requestId }, now) : null; // mesma validação (34,0–43,0; 1 casa)
  return { feeling, note, temperature, requestId };
}
export type MessageInput = { body: string; topic: MessageTopic; requestId: string };
export function parseMessage(b: Record<string, unknown>, withTopic = true): MessageInput {
  if (!b || typeof b !== 'object') throw new BadRequestException('Mensagem inválida');
  const body = typeof b.body === 'string' ? b.body.trim() : '';
  if (body.length < MESSAGE_MIN || body.length > MESSAGE_MAX) throw new BadRequestException(`Mensagem: escreva entre ${MESSAGE_MIN} e ${MESSAGE_MAX} caracteres`);
  const topic = (withTopic && b.topic !== undefined ? String(b.topic) : 'geral') as MessageTopic;
  if (!(topic in MESSAGE_TOPICS)) throw new BadRequestException('Assunto inválido');
  const requestId = String(b.requestId);
  if (!UUID.test(requestId)) throw new BadRequestException('requestId deve ser UUID');
  return { body, topic, requestId };
}
/** Rótulo do alerta exibido ao paciente (sem conduta). */
export const ALERT_CODE_LABEL: Record<string, string> = { 'symptom.fever': 'Febre registrada', 'checkin.unwell': 'Check-in: não está bem', 'symptom.nausea': 'Enjoo ou vômito', 'symptom.neuropathy': 'Formigamento', 'symptom.diarrhea': 'Diarreia', 'symptom.fatigue': 'Cansaço', 'symptom.pain': 'Dor', 'symptom.mouth': 'Feridas na boca', 'symptom.other': 'Outro sintoma' };
export const alertCodeLabel = (code: string) => ALERT_CODE_LABEL[code] ?? 'Aviso registrado';
