/** Conector Philips Tasy (HTML5) — DEMONSTRAÇÃO NÃO CLÍNICA, DADOS FICTÍCIOS.
 * Mapeia payloads no estilo Tasy (paciente, atendimento, prescrição, resultados de exame) para FHIR R4
 * e interpreta HL7 v2 (ADT^A01/A02/A03, ORM^O01). Modo 'mock' é o único habilitado: não há chamada de rede.
 * Os nomes de campos Tasy aqui são ILUSTRATIVOS; o contrato real depende da interface liberada pela TI do hospital.
 * Configuração via env: TASY_MODE (mock), TASY_BASE_URL, TASY_AUTH_TYPE (none|basic|bearer|oauth2),
 * TASY_CLIENT_ID, TASY_CLIENT_SECRET, TASY_TOKEN_URL, TASY_FACILITY. */
import { readFileSync } from 'node:fs';
import { validateSyntheticBundle } from '../fhir-r4.mjs';
export const TASY_ADAPTER_VERSION = 'tasy-synthetic-0.1';
export const DEMO_LABEL = 'Demonstração não clínica — dados fictícios (Philips Tasy simulado)';
const fixtures = new URL('../../fixtures/tasy/', import.meta.url);
const AUTH = new Set(['none', 'basic', 'bearer', 'oauth2']);
const RECORD = /^[A-Za-z0-9-]{3,30}$/;
const sid = (prefix, v) => { const s = String(v ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50); if (!s) throw Error(`Identificador Tasy ausente (${prefix})`); return `syn-tasy-${prefix}-${s}`; };
const txt = (v, max = 200) => { if (v == null) return undefined; const s = String(v).replace(/[\u0000-\u001f\u007f]/g, '').trim(); if (s.length > max) throw Error('Campo Tasy excede o limite'); return s || undefined; };
/** Datas Tasy chegam como 'dd/mm/aaaa hh:mm[:ss]' ou ISO. Fuso padrão -03:00. */
export function tasyDate(v) {
  if (v == null || v === '') return undefined;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(v).trim());
  if (m) { const [, d, mo, y, h, mi, s] = m; if (!h) return `${y}-${mo}-${d}`; return `${y}-${mo}-${d}T${h}:${mi}:${s || '00'}-03:00`; }
  if (!Number.isNaN(Date.parse(v))) return String(v);
  throw Error(`Data Tasy inválida: ${String(v).slice(0, 30)}`);
}

export function loadTasyConfig(env = process.env) {
  const mode = env.TASY_MODE || 'mock';
  if (mode !== 'mock') throw Error('TASY_MODE: somente "mock" é permitido nesta versão (sem autorização institucional)');
  const authType = env.TASY_AUTH_TYPE || 'none';
  if (!AUTH.has(authType)) throw Error(`TASY_AUTH_TYPE inválido: ${authType}`);
  const baseUrl = env.TASY_BASE_URL || 'https://tasy.example.invalid/api';
  if (!/^https:\/\//.test(baseUrl)) throw Error('TASY_BASE_URL deve usar https');
  if (authType === 'oauth2' && (!env.TASY_CLIENT_ID || !env.TASY_TOKEN_URL)) throw Error('oauth2 exige TASY_CLIENT_ID e TASY_TOKEN_URL');
  return Object.freeze({ mode, baseUrl, authType, clientId: env.TASY_CLIENT_ID || null, hasSecret: Boolean(env.TASY_CLIENT_SECRET), tokenUrl: env.TASY_TOKEN_URL || null, facility: env.TASY_FACILITY || 'SIMHOSP-TASY' });
}

const SEX = { M: 'male', F: 'female', I: 'unknown' };
const ENC_STATUS = { A: 'in-progress', F: 'finished', C: 'cancelled' };
const ENC_CLASS = { I: ['IMP', 'inpatient encounter'], A: ['AMB', 'ambulatory'], E: ['EMER', 'emergency'] };
const RX_STATUS = { L: 'active', S: 'on-hold', C: 'cancelled', E: 'completed' };

export function mapTasyPatient(p) {
  const record = txt(p?.nr_prontuario, 30);
  if (!RECORD.test(record || '')) throw Error('Prontuário Tasy inválido');
  return { resourceType: 'Patient', id: sid('pac', p.cd_pessoa_fisica), meta: { tag: [{ code: 'SYNTHETIC', display: DEMO_LABEL }] },
    identifier: [{ system: 'urn:tasy:prontuario', value: record }], name: [{ text: txt(p.nm_pessoa_fisica, 120) }],
    gender: SEX[p.ie_sexo] || 'unknown', birthDate: tasyDate(p.dt_nascimento) };
}
export function mapTasyEncounter(a, patientRef) {
  const [code, display] = ENC_CLASS[a?.ie_tipo_atendimento] || ENC_CLASS.A;
  return { resourceType: 'Encounter', id: sid('atend', a.nr_atendimento), status: ENC_STATUS[a.ie_status] || 'unknown',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code, display },
    subject: { reference: patientRef }, period: { start: tasyDate(a.dt_entrada), end: tasyDate(a.dt_alta) },
    serviceProvider: { display: txt(a.ds_setor_atendimento, 80) } };
}
export function mapTasyPrescription(rx, patientRef, encounterRef) {
  if (!Array.isArray(rx?.itens) || !rx.itens.length) throw Error('Prescrição Tasy sem itens');
  return rx.itens.map((it, i) => {
    const dose = Number(it.qt_dose);
    if (!Number.isFinite(dose) || dose <= 0 || !txt(it.cd_unidade_medida, 20)) throw Error('Dose/unidade inválida na prescrição Tasy');
    return { resourceType: 'MedicationRequest', id: sid('presc', `${rx.nr_prescricao}-${it.nr_sequencia ?? i + 1}`),
      status: RX_STATUS[rx.ie_status] || 'unknown', intent: 'order', subject: { reference: patientRef }, encounter: { reference: encounterRef },
      authoredOn: tasyDate(rx.dt_prescricao), requester: { display: txt(rx.nm_medico, 120) },
      medicationCodeableConcept: { coding: [{ system: 'urn:tasy:material', code: String(it.cd_material) }], text: txt(it.ds_material, 160) },
      dosageInstruction: [{ text: txt(it.ds_posologia, 200), route: { text: txt(it.ds_via, 40) },
        doseAndRate: [{ doseQuantity: { value: dose, unit: it.cd_unidade_medida } }] }] };
  });
}
export function mapTasyLabResult(r, patientRef) {
  const value = Number(String(r?.vl_resultado ?? '').replace(',', '.'));
  const obs = { resourceType: 'Observation', id: sid('exame', `${r.nr_seq_resultado}`), status: r.ie_status === 'P' ? 'preliminary' : 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
    code: { coding: r.cd_loinc ? [{ system: 'http://loinc.org', code: r.cd_loinc }] : [], text: txt(r.ds_exame, 120) },
    subject: { reference: patientRef }, effectiveDateTime: tasyDate(r.dt_coleta) };
  if (Number.isFinite(value) && r.ds_unidade) obs.valueQuantity = { value, unit: r.ds_unidade };
  else obs.valueString = txt(r.vl_resultado, 200);
  if (r.vl_referencia_min != null || r.vl_referencia_max != null) obs.referenceRange = [{ low: r.vl_referencia_min != null ? { value: Number(r.vl_referencia_min), unit: r.ds_unidade } : undefined, high: r.vl_referencia_max != null ? { value: Number(r.vl_referencia_max), unit: r.ds_unidade } : undefined }];
  return obs;
}
/** Payload Tasy agregado (paciente + atendimentos + prescrições + resultados) -> FHIR R4 Bundle validado. */
export function tasyToFhirBundle(payload) {
  if (!payload?.paciente) throw Error('Payload Tasy sem paciente');
  const patient = mapTasyPatient(payload.paciente); const pref = `Patient/${patient.id}`;
  const out = [patient];
  const encs = (payload.atendimentos || []).map((a) => mapTasyEncounter(a, pref)); out.push(...encs);
  const encRef = (nr) => { const e = encs.find((x) => x.id === sid('atend', nr)); if (!e) throw Error('Prescrição referencia atendimento ausente'); return `Encounter/${e.id}`; };
  for (const rx of payload.prescricoes || []) out.push(...mapTasyPrescription(rx, pref, encRef(rx.nr_atendimento)));
  for (const r of payload.resultados || []) out.push(mapTasyLabResult(r, pref));
  const bundle = { resourceType: 'Bundle', type: 'collection', meta: { tag: [{ code: 'SYNTHETIC', display: DEMO_LABEL }] }, entry: out.map((resource) => ({ resource: JSON.parse(JSON.stringify(resource)) })) };
  validateSyntheticBundle(bundle);
  return bundle;
}

/** HL7 v2 do Tasy (interface de integração): ADT^A01/A02/A03 e ORM^O01 (RXO/RXR). Só aceita MSH-3 iniciando por SIM. */
const hl7ts = (ts) => /^\d{12}/.test(ts || '') ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14) || '00'}-03:00` : null;
export function parseTasyHl7(text) {
  if (typeof text !== 'string' || text.length > 512_000) throw Error('Mensagem HL7 inválida');
  const msgs = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((m) => m.trim()).filter(Boolean);
  if (msgs.length > 500) throw Error('Limite de registros excedido');
  return msgs.map((m) => {
    const lines = m.split('\n').map((l) => l.split('|'));
    const one = (s) => lines.find((l) => l[0] === s); const all = (s) => lines.filter((l) => l[0] === s);
    const msh = one('MSH'); if (!msh || msh[1] !== '^~\\&') throw Error('MSH ausente');
    if (!/^SIM/.test(msh[2] || '')) throw Error('Aplicação de origem não sintética');
    const [type, trigger] = (msh[8] || '').split('^');
    const record = (one('PID')?.[3] || '').split('^')[0];
    if (!RECORD.test(record)) throw Error('Prontuário inválido no HL7');
    const base = { controlId: msh[9] || null, at: hl7ts(msh[6]), record, demoLabel: DEMO_LABEL };
    if (type === 'ADT' && ['A01', 'A02', 'A03'].includes(trigger)) {
      const pv1 = one('PV1') || []; const loc = (pv1[3] || '').split('^');
      return { ...base, kind: 'adt', event: trigger, encounter: pv1[19] || null, unit: loc[0] || null, room: loc[1] || null, bed: loc[2] || null };
    }
    if (type === 'ORM' && trigger === 'O01') {
      const orc = one('ORC') || [];
      const rxo = all('RXO'), rxr = all('RXR');
      if (!rxo.length) throw Error('ORM sem RXO');
      return { ...base, kind: 'orm', control: orc[1] || null, order: orc[2] || null, items: rxo.map((r, i) => {
        const dose = Number(r[2]); if (!Number.isFinite(dose) || dose <= 0 || !r[4]) throw Error('Dose/unidade inválida no RXO');
        const [code, name] = (r[1] || '').split('^');
        return { code, name: name || null, dose, unit: r[4].split('^')[0], route: (rxr[i]?.[1] || '').split('^')[1] || (rxr[i]?.[1] || null) };
      }) };
    }
    throw Error(`Evento HL7 não suportado: ${msh[8]}`);
  });
}

export function createTasyConnector({ env = process.env, config = loadTasyConfig(env) } = {}) {
  const load = (f) => readFileSync(new URL(f, fixtures), 'utf8');
  return {
    vendor: 'tasy', product: 'Philips Tasy HTML5', version: TASY_ADAPTER_VERSION, syntheticOnly: true, demoLabel: DEMO_LABEL,
    /** Configuração pública (sem segredo). */
    config: { ...config },
    async fetchPatientBundle(record) {
      const all = JSON.parse(load('tasy-pacientes.json'));
      const p = all.find((x) => x.paciente?.nr_prontuario === record);
      if (!p) throw Error('Paciente não encontrado no Tasy simulado');
      return tasyToFhirBundle(p);
    },
    async fetchHl7Feed() { return parseTasyHl7(load('tasy-feed.hl7')); },
    parseHl7: parseTasyHl7,
  };
}
