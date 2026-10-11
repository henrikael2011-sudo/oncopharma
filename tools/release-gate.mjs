#!/usr/bin/env node
/** ONCOPHARMA M14.1 - Fail-closed release evidence gate. No clinical approvals inferred. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const evidencePath=process.env.ONCOPHARMA_EVIDENCE_FILE || path.join(root,'docs/quality/evidencias-release.json');
const required=['G01','G02','G03','G04','G05','G06','G07','G08','G09'];
const isRealEvidence=(e)=>e && e.status==='approved' && typeof e.approver==='string' && e.approver.trim().length>=3 && typeof e.approved_at==='string' && !Number.isNaN(Date.parse(e.approved_at)) && Array.isArray(e.artifacts) && e.artifacts.length>0 && e.artifacts.every(a=>typeof a==='string' && a.trim().length>0);
let document, parseError=null;
try {document=JSON.parse(fs.readFileSync(evidencePath,'utf8'));}catch(e){parseError=e.message;document={gates:{}};}
const gates=required.map(id=>({id,status:isRealEvidence(document.gates?.[id])?'approved':'blocked',reason:isRealEvidence(document.gates?.[id])?'Evidência declarada (ainda sujeita a auditoria externa)':'Aprovação e evidências completas ausentes'}));
const allApproved=gates.every(g=>g.status==='approved');
const result={product:'ONCOPHARMA',release:'M14.1',clinical_use_allowed:false,gate_declarations_complete:allApproved,independent_verification_performed:false,parse_error:parseError,gates};
if(process.argv.includes('--json')) console.log(JSON.stringify(result,null,2));
else {console.log('ONCOPHARMA — GATE DE EVIDÊNCIAS (não é homologação)');for(const g of gates)console.log(`${g.id} ${g.status.toUpperCase()} — ${g.reason}`);console.log(allApproved?'Declarações completas; validação externa ainda necessária.':'BLOQUEADO: piloto e produção não autorizados.');}
process.exitCode=allApproved?0:1;
