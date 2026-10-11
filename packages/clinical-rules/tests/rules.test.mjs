import test from 'node:test'; import assert from 'node:assert/strict';
import {evaluateSyntheticPreCycle,classifyPatientMessage} from '../src/index.mjs';
const base={synthetic:true,patientId:'DEMO-01',protocol:'FOLFOX',cycle:3,allergyReviewed:true,labReviewed:true,medicationReconciliation:true,symptoms:[]};
test('reject real patient input',()=>assert.throws(()=>evaluateSyntheticPreCycle({...base,synthetic:false})));
test('never authorizes chemotherapy',()=>assert.equal(evaluateSyntheticPreCycle(base).automaticTreatmentAuthorization,false));
test('fever routes to human urgent review',()=>assert.equal(evaluateSyntheticPreCycle({...base,symptoms:[{type:'fever'}]}).findings[0].level,'urgent_review'));
test('missing labs flag review',()=>assert.ok(evaluateSyntheticPreCycle({...base,labReviewed:false}).findings.some(f=>f.code==='LAB_REVIEW')));
test('urgent text uses deterministic classifier',()=>assert.equal(classifyPatientMessage('estou com falta de ar').kind,'POTENTIAL_URGENCY'));
