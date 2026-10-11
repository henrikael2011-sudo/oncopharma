/** M15.4b — Adaptadores de alocação hospitalar (somente sintético): FHIR R4 Encounter.location e HL7 v2 ADT (A01/A02, PV1-3).
 * Saída normalizada: { record, unit, floor, room, bed, ref, at }. Nada clínico é extraído; nenhuma escrita é feita aqui. */
export const LOCATION_ADAPTER_VERSION = 'location-feed-0.1';
const RECORD = /^[A-Za-z0-9-]{3,30}$/;
const clean = (v, max) => { if (v == null) return null; const s = String(v).replace(/[\u0000-\u001f\u007f]/g, '').trim(); if (!s) return null; if (s.length > max) throw Error('Campo de alocação excede o limite'); return s; };
function entry(record, unit, floor, room, bed, ref, at) {
  if (!RECORD.test(record || '')) throw Error('Prontuário inválido no feed');
  const u = clean(unit, 80); if (!u || u.length < 2) throw Error(`Unidade ausente para ${record}`);
  if (at && Number.isNaN(Date.parse(at))) throw Error('Data inválida no feed');
  return { record, unit: u, floor: clean(floor, 40), room: clean(room, 40), bed: clean(bed, 20), ref: clean(ref, 120), at: at || null };
}
const MAX = 500;
/** FHIR R4: Bundle collection com Encounter (status in-progress) + Location (physicalType wa=unidade, lvl=andar, ro=quarto, bd=leito). */
export function parseFhirLocations(bundle) {
  if (!bundle || bundle.resourceType !== 'Bundle' || !['collection', 'searchset'].includes(bundle.type) || !Array.isArray(bundle.entry)) throw Error('FHIR Bundle inválido');
  if (bundle.entry.length > MAX * 5) throw Error('Limite de registros excedido');
  const locations = new Map(), encounters = [];
  for (const e of bundle.entry) {
    const r = e?.resource;
    if (!r || typeof r.id !== 'string' || !/^syn-[a-z0-9-]{1,60}$/.test(r.id)) throw Error('Recurso sem identificador sintético');
    if (r.resourceType === 'Location') locations.set(`Location/${r.id}`, r);
    else if (r.resourceType === 'Encounter') encounters.push(r);
    else throw Error(`Recurso não permitido no feed de alocação: ${r.resourceType}`);
  }
  const out = [];
  for (const enc of encounters) {
    if (enc.status !== 'in-progress') continue;
    const record = enc.subject?.identifier?.value;
    const parts = {};
    for (const l of enc.location || []) {
      if (l.status && l.status !== 'active') continue;
      const loc = locations.get(l.location?.reference);
      if (!loc) throw Error('Encounter referencia Location ausente');
      const code = loc.physicalType?.coding?.[0]?.code;
      const key = { wa: 'unit', lvl: 'floor', ro: 'room', bd: 'bed' }[code];
      if (key) parts[key] = loc.name;
    }
    if (!parts.unit) continue; // sem unidade informada: hospital não informa (preenchimento manual permitido)
    out.push(entry(record, parts.unit, parts.floor, parts.room, parts.bed, `Encounter/${enc.id}`, enc.meta?.lastUpdated));
  }
  if (out.length > MAX) throw Error('Limite de registros excedido');
  return out;
}
/** HL7 v2: mensagens ADT^A01/A02 separadas por linha em branco; PID-3 = prontuário; PV1-3 = PontoDeCuidado^Quarto^Leito^Instalação^^^Prédio^Andar. */
export function parseHl7Adt(text) {
  if (typeof text !== 'string' || text.length > 512_000) throw Error('Mensagem HL7 inválida');
  const msgs = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((m) => m.trim()).filter(Boolean);
  if (msgs.length > MAX) throw Error('Limite de registros excedido');
  const out = [];
  for (const m of msgs) {
    const seg = Object.fromEntries(m.split('\n').map((l) => [l.slice(0, 3), l.split('|')]));
    const msh = seg.MSH; if (!msh || msh[1] !== '^~\\&') throw Error('MSH ausente');
    const type = msh[8] || '';
    if (!/^ADT\^A0[12]/.test(type)) throw Error(`Evento ADT não suportado: ${type}`);
    if (!/^SIM/.test(msh[2] || '')) throw Error('Aplicação de origem não sintética');
    const record = (seg.PID?.[3] || '').split('^')[0];
    const pv1 = (seg.PV1?.[3] || '').split('^');
    const ts = msh[6]; const at = /^\d{14}/.test(ts || '') ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}-03:00` : null;
    out.push(entry(record, pv1[0], pv1[7], pv1[1], pv1[2], `HL7/${msh[9] || ''}`, at));
  }
  return out;
}
