/** M15.4b — Hospital simulado (100% sintético). Fase 0 = censo FHIR R4 (Encounter + Location); fase 1 = transferências HL7 ADT^A02.
 * Nenhum dado real; prontuários PR-1002x são os pacientes sintéticos dos seeds. */
import { readFileSync } from 'node:fs';
const dir = new URL('../fixtures/', import.meta.url);
export const SIM_SOURCE = 'Hospital simulado';
export function createHospitalSimulator() {
  let phase = 0;
  return {
    reset() { phase = 0; },
    advance() { phase = Math.min(phase + 1, 1); return phase; },
    get phase() { return phase; },
    feed() {
      return phase === 0
        ? { format: 'fhir_r4', payload: JSON.parse(readFileSync(new URL('hospital-sim-census.fhir.json', dir), 'utf8')) }
        : { format: 'hl7v2_adt', payload: readFileSync(new URL('hospital-sim-transfers.hl7', dir), 'utf8') };
    },
  };
}
