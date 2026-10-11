/** Rules are intentionally conservative; no automated clinical dosing or treatment approval. */
export const RULESET_VERSION = 'synthetic-2026.10.1';
export const EVIDENCE_STATUS = 'DEMONSTRATION_ONLY_NOT_CLINICALLY_VALIDATED';
export function evaluateSyntheticPreCycle(input) {
  if (!input || input.synthetic !== true) throw new Error('Motor de demonstração: somente dados sintéticos');
  const findings = [];
  const add = (code, level, title, reason, nextStep) => findings.push({code,level,title,reason,nextStep,ruleVersion:RULESET_VERSION,evidenceStatus:EVIDENCE_STATUS,requiresHumanReview:true});
  if (!input.patientId || !input.protocol || !input.cycle) add('MISSING_CONTEXT','needs_review','Contexto incompleto','Identificação, protocolo ou ciclo ausente','Conferir fonte primária');
  if (!input.allergyReviewed) add('ALLERGY_REVIEW','needs_review','Alergias não revisadas','Sem confirmação documental da revisão de alergias','Revisar alergias no prontuário');
  if (!input.labReviewed) add('LAB_REVIEW','needs_review','Exames não revisados','Sem validação humana dos exames e datas','Conferir exames e referências institucionais');
  if (!input.medicationReconciliation) add('MED_REC','needs_review','Conciliação pendente','Lista medicamentosa não conciliada','Executar conciliação farmacêutica');
  if (input.symptoms?.some(s=>s.type==='fever')) add('FEVER_REPORTED','urgent_review','Febre relatada','Sinal informado requer triagem imediata conforme protocolo institucional','Acionar equipe assistencial, sem depender de IA');
  if (input.symptoms?.some(s=>s.type==='neuropathy')) add('NEUROPATHY_REPORTED','needs_review','Sintoma neurológico relatado','Possível toxicidade a ser correlacionada com tratamento e avaliação profissional','Avaliar e registrar graduação por profissional');
  if (input.symptoms?.some(s=>s.type==='nausea')) add('NAUSEA_REPORTED','needs_review','Náusea relatada','Verificar antieméticos prescritos/administrados, alergias e intensidade','Revisar suporte e encaminhar para decisão profissional');
  return {status:findings.length?'REQUIRES_HUMAN_REVIEW':'INSUFFICIENT_TO_DECLARE_SAFE',findings,automaticTreatmentAuthorization:false,version:RULESET_VERSION};
}
export function classifyPatientMessage(message) {
  const t=String(message||'').toLowerCase();
  if (/(febre|falta de ar|desmaio|sangramento intenso|dor no peito)/.test(t)) return {kind:'POTENTIAL_URGENCY',action:'CONTACT_CARE_TEAM_OR_EMERGENCY',aiUsed:false};
  return {kind:'ROUTINE_REVIEW',action:'AWAIT_CLINICIAN_REVIEW',aiUsed:false};
}
