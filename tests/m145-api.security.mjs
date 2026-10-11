import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const {DatabaseService}=require('../services/api/dist/database.service.js');
const {WorkflowController}=require('../services/api/dist/workflow.controller.js');
test('DatabaseService refuses superuser, BYPASSRLS and unexpected role before transaction',async()=>{
 for(const role of [{name:'oncopharma_app',rolsuper:true,rolbypassrls:false},{name:'oncopharma_app',rolsuper:false,rolbypassrls:true},{name:'postgres',rolsuper:false,rolbypassrls:false}]){
  const events=[];const client={query:async sql=>{events.push(sql);return {rows:[role]}},release:()=>{}};
  const db=new DatabaseService();db.pool={connect:async()=>client,end:async()=>{}};
  await assert.rejects(db.withTenant('test',async()=>{throw Error('must not run')}),/Role de banco não permitida/);
  assert.equal(events.includes('BEGIN'),false);
 }
});
test('staff assignments are checked inside tenant context, with MFA and active membership',async()=>{
 const req={principal:{sub:'synthetic-pharmacist',issuer:'synthetic-idp',mfa:true}};let tenantCalls=0;
 const db={withTenant:async(org,fn)=>{assert.equal(org,'synthetic-tenant');tenantCalls++;return fn({query:async(sql,args)=>({rows:sql.includes('memberships')?[{role:'pharmacist'}]:[{patient_id:'synthetic-patient'}]})})}};
 const controller=new WorkflowController(db);await controller.checkStaff(req,'synthetic-tenant','synthetic-patient');assert.equal(tenantCalls,1);
 await assert.rejects(controller.checkStaff({principal:{...req.principal,mfa:false}},'synthetic-tenant','synthetic-patient'),/MFA obrigatório/);
 await assert.rejects(new WorkflowController({withTenant:async(org,fn)=>fn({query:async()=>({rows:[]})})}).checkStaff(req,'synthetic-tenant','synthetic-patient'),/Profissional sem vínculo/);
});
