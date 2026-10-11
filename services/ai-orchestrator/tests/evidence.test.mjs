import test from 'node:test';import assert from 'node:assert/strict';import {validateEvidenceDraft} from '../src/evidence-gate.mjs';
const refs=[{id:'demo-protocol',version:'1.0',reviewedAt:'2026-10-01',approved:true}];const d={synthetic:true,claims:[{text:'Possível associação para revisão',patientSource:'symptom-report:synthetic',observedAt:'2026-10-01',referenceId:'demo-protocol'}]};
test('rascunho sempre pendente de revisão',()=>{const r=validateEvidenceDraft(d,refs);assert.equal(r.status,'PENDING_CLINICIAN_REVIEW');assert.equal(r.approvedForPatient,false)});
test('bloqueia referência não aprovada',()=>assert.throws(()=>validateEvidenceDraft(d,[{...refs[0],approved:false}])));
test('bloqueia ação terapêutica',()=>assert.throws(()=>validateEvidenceDraft({...d,doseChange:true},refs)));
test('bloqueia evidência sem origem',()=>assert.throws(()=>validateEvidenceDraft({...d,claims:[{...d.claims[0],patientSource:''}]},refs)));
