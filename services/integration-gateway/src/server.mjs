/** M15.4b — integration-gateway HTTP (somente ambiente sintético). A API chama GET /v1/locations com token de serviço;
 * o gateway lê o hospital simulado, normaliza (FHIR R4 / HL7 ADT) e devolve apenas alocação — nunca dado clínico. */
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { LOCATION_ADAPTER_VERSION, parseFhirLocations, parseHl7Adt } from './location-feed.mjs';
import { createHospitalSimulator, SIM_SOURCE } from '../simulator/hospital-sim.mjs';

export function createGateway({ token, simulator = createHospitalSimulator(), now = () => new Date() }) {
  if (typeof token !== 'string' || token.length < 32) throw Error('INTEGRATION_GATEWAY_TOKEN ausente ou curto (mín. 32)');
  const expected = Buffer.from(`Bearer ${token}`);
  const authorized = (h) => { const b = Buffer.from(String(h || '')); return b.length === expected.length && timingSafeEqual(b, expected); };
  const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://gateway');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok', syntheticOnly: true });
    if (!authorized(req.headers.authorization)) return send(res, 401, { error: 'Não autorizado' });
    try {
      if (req.method === 'GET' && url.pathname === '/v1/locations') {
        const f = simulator.feed();
        const items = f.format === 'fhir_r4' ? parseFhirLocations(f.payload) : parseHl7Adt(f.payload);
        return send(res, 200, { source: SIM_SOURCE, format: f.format, adapterVersion: LOCATION_ADAPTER_VERSION, fetchedAt: now().toISOString(), syntheticOnly: true, items });
      }
      // Controle do simulador (somente testes/dev): fase do feed.
      if (req.method === 'POST' && url.pathname === '/v1/sim/reset') { simulator.reset(); return send(res, 200, { phase: simulator.phase }); }
      if (req.method === 'POST' && url.pathname === '/v1/sim/advance') return send(res, 200, { phase: simulator.advance() });
      return send(res, 404, { error: 'Rota não encontrada' });
    } catch (e) { return send(res, 502, { error: 'Feed hospitalar inválido', detail: String(e.message).slice(0, 200) }); }
  });
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const env = process.env.ONCO_ENVIRONMENT;
  if (!['test', 'development'].includes(env || '')) { console.error('integration-gateway: somente ONCO_ENVIRONMENT=test|development (hospital simulado)'); process.exit(2); }
  const port = Number(process.env.GATEWAY_PORT || 4310);
  createGateway({ token: process.env.INTEGRATION_GATEWAY_TOKEN }).listen(port, '127.0.0.1', () => console.log(`integration-gateway (simulado) em 127.0.0.1:${port}`));
}
