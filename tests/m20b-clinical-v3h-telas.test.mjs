// M20b — telas Clinical (lista, detalhe, pedido ao médico) no padrão marca-nova-v3h, só com dados que a API já entrega.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const r = (f) => readFileSync(new URL(`../apps/clinical-web/${f}`, import.meta.url), 'utf8');
const C = 'components/clinical/';
test('lista: título v3h, filtro de status sobre a gravidade real, cartões por leito', () => {
  const s = r(C + 'Worklist.tsx');
  assert.match(s, /Lista de pacientes por andar e leito/); assert.match(s, /\(p\.severity \?\? 'none'\) === filter/);
  assert.match(s, /aria-label="Filtrar por status"/); assert.match(s, /aria-pressed=\{filter === k\}/);
});
test('detalhe e pedido: sem elementos sem backend (resumo de IA, nascimento, SC, protocolo, gráfico de temperatura)', () => {
  for (const f of ['Worklist.tsx', 'PatientView.tsx', 'MedicalRequests.tsx']) {
    const s = r(C + f); assert.doesNotMatch(s, /Resumo com IA|Nascimento|Superfície corporal|Check-ins do cuidador|Temperatura axilar/, f);
  }
  const pv = r(C + 'PatientView.tsx'); assert.match(pv, /Pedir alteração ao médico/); assert.match(pv, /startOpen=\{ask > 0\}/);
  const mr = r(C + 'MedicalRequests.tsx'); assert.match(mr, /<h1>Pedido de alteração ao médico<\/h1>/); assert.match(mr, /function Steps/);
});
test('estilo v3h restrito ao Clinical (.cv-app), sem CDN', () => {
  const css = r('app/clinical/clinical-v3h.css'); assert.doesNotMatch(css, /@import|https?:\/\//);
  for (const sel of ['.cv-pc', '.cv-chip', '.cv-pstrip', '.cv-steps']) assert.ok(css.includes(`.cv-app ${sel}`), sel);
});
