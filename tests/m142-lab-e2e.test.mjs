import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../tools/synthetic-lab/server.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const dir=mkdtempSync(join(tmpdir(),'onco-m142-'));
const port=44000+Math.floor(Math.random()*10000);
const server=spawn(process.execPath,['tools/synthetic-lab/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),ONCO_LAB_DATA:join(dir,'test.json')},stdio:['ignore','pipe','pipe']});
const base=`http://127.0.0.1:${port}`;
async function waitReady(){for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error('Servidor encerrou');try{const r=await fetch(base+'/api/state');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,80));}throw Error('Servidor não iniciou');}
async function post(path,data,headers={}){return fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)});}
test('M14.2: laboratório sintético HTTP ponta a ponta e isolamento local',async()=>{
 await waitReady();
 const initial=await (await fetch(base+'/api/state')).json();assert.equal(initial.syntheticOnly,true);assert.equal(initial.clinicallyValidated,false);assert.equal(initial.patients.length,2);
 const bad=await post('/api/report',{patientId:'real-person',symptom:'nausea',description:'teste'});assert.equal(bad.status,400);
 const origin=await post('/api/report',{patientId:'synthetic-folfox',symptom:'nausea',description:'teste'},{origin:'https://example.com'});assert.equal(origin.status,403);
 const r=await post('/api/report',{patientId:'synthetic-folfox',symptom:'neuropathy',description:'Parestesia sintética após ciclo'});assert.equal(r.status,201);const {alert}=await r.json();assert.equal(alert.level,'needs_review');
 const urgent=await post('/api/report',{patientId:'synthetic-act',symptom:'fever',description:'Febre fictícia'});assert.equal(urgent.status,201);const u=await urgent.json();assert.equal(u.alert.level,'urgent_review');assert.match(u.notice,/DEMONSTRAÇÃO/);
 const review=await post('/api/review',{alertId:alert.id,decision:'acknowledged',note:'Revisão simulada registrada'});assert.equal(review.status,201);const intervention=(await review.json()).intervention;
 assert.equal((await post('/api/review',{alertId:alert.id,decision:'resolved',note:'Duplicado'})).status,409);
 const guidance=await post('/api/guidance',{interventionId:intervention.id,body:'Texto fictício sujeito a aprovação clínica'});assert.equal(guidance.status,201);assert.equal((await guidance.json()).guidance.status,'draft');
 const final=await (await fetch(base+'/api/state')).json();assert.equal(final.reports.length,2);assert.equal(final.alerts.length,2);assert.equal(final.interventions.length,1);assert.equal(final.guidance.length,1);assert.ok(final.audit.length>=6);
 const reset=await post('/api/reset',{confirm:'RESET_SYNTHETIC'});assert.equal(reset.status,200);const clean=await (await fetch(base+'/api/state')).json();assert.equal(clean.reports.length,0);
},{timeout:20000});
test.after(async()=>{server.kill('SIGTERM');try{await once(server,'exit');}catch{}rmSync(dir,{recursive:true,force:true});});
