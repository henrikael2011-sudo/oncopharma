/** M22 — Hospital simulado → medicações ORAIS ativas de UM prontuário (FHIR R4 MedicationRequest). Somente sintético.
 * Devolve rascunhos para revisão da equipe; nada é aplicado automaticamente. Vias não orais e pedidos inativos são ignorados. */
export const MED_ADAPTER_VERSION = 'fhir-r4-medreq-synthetic-0.1';
const ORAL = new Set(['26643006']); // SNOMED CT "Oral route"
const hhmm = (t) => (/^([01]\d|2[0-3]):[0-5]\d/.test(String(t)) ? String(t).slice(0, 5) : null);
export function parseFhirOralMedications(bundle, record) {
  if (bundle?.resourceType !== 'Bundle' || !bundle.meta?.tag?.some((t) => t.code === 'SYNTHETIC')) throw Error('Bundle não sintético');
  if (!/^PR-[A-Za-z0-9]{4,12}$/.test(String(record))) throw Error('Prontuário inválido');
  let skippedNonOral = 0, skippedInactive = 0; const items = [];
  for (const { resource: r } of bundle.entry ?? []) {
    if (r?.resourceType !== 'MedicationRequest' || !String(r.id).startsWith('syn-')) continue;
    if (r.subject?.identifier?.value !== record) continue;
    if (r.status !== 'active') { skippedInactive++; continue; }
    const d = r.dosageInstruction?.[0] ?? {};
    if (!(d.route?.coding ?? []).some((c) => ORAL.has(c.code))) { skippedNonOral++; continue; }
    const rep = d.timing?.repeat ?? {};
    items.push({ ref: r.id, medication: String(r.medicationCodeableConcept?.text ?? '').slice(0, 120), dose: String(d.text ?? '').slice(0, 80), route: 'VO',
      times: [...new Set((rep.timeOfDay ?? []).map(hhmm).filter(Boolean))].sort().slice(0, 8), frequency: String(d.timing?.code?.text ?? '').slice(0, 120),
      startDate: rep.boundsPeriod?.start ?? r.authoredOn ?? '', endDate: rep.boundsPeriod?.end ?? '', instructions: String(d.patientInstruction ?? '').slice(0, 500) });
  }
  return { items, skippedNonOral, skippedInactive };
}
