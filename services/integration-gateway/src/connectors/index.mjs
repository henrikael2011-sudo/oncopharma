/** Registro de conectores por fornecedor (somente sintético). Cada conector expõe:
 *  { vendor, version, config, fetchPatientBundle(record) -> FHIR R4 Bundle, parseHl7(text) -> eventos normalizados }.
 *  DEMONSTRAÇÃO NÃO CLÍNICA: nenhum conector abre conexão com hospital real. */
import { createTasyConnector } from './tasy.mjs';
const factories = { tasy: createTasyConnector };
export const VENDORS = Object.keys(factories);
export function createConnector(vendor, opts = {}) {
  const f = factories[String(vendor || '').toLowerCase()];
  if (!f) throw Error(`Conector hospitalar não suportado: ${vendor}`);
  return f(opts);
}
