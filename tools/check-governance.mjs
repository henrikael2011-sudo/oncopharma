import fs from 'node:fs';
const required=['docs/product/PLANO_DIRETOR_V3_BASELINE.md','docs/product/PLANO_DIRETOR_V3_1_ADENDO.md','docs/product/MATRIZ_RASTREABILIDADE.md','docs/decisions/ADR-004-separacao-apps.md','docs/quality/PILOTO_GATES.md','apps/care-web/package.json','apps/clinical-web/package.json','apps/admin-web/package.json','services/integration-gateway/src/fhir-r4.mjs'];
const missing=required.filter(x=>!fs.existsSync(x));if(missing.length){console.error(missing);process.exitCode=1}else console.log('Governança: documentos e limites de release presentes');
