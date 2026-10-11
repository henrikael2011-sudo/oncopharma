import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Development-only lab: local loopback, synthetic records, no real auth or clinical use.
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const FILE=process.env.ONCO_LAB_DATA || path.join(ROOT,'.local','workflow.json');
const HOST='127.0.0.1'; const PORT=Number(process.env.PORT || 4177);
const patients=[{id:'synthetic-folfox',name:'Paciente sintético A',protocol:'FOLFOX',cycle:3},{id:'synthetic-act',name:'Paciente sintético B',protocol:'AC-T',cycle:2}];
const initial=()=>({patients,reports:[],alerts:[],interventions:[],guidance:[],audit:[]});
let store;
async function load(){try{const s=JSON.parse(await readFile(FILE,'utf8'));if(!Array.isArray(s.reports)||!Array.isArray(s.audit))throw Error('schema');return s;}catch(e){if(e.code==='ENOENT')return initial();throw e;}}
async function persist(){await mkdir(path.dirname(FILE),{recursive:true});const temp=FILE+'.tmp';await writeFile(temp,JSON.stringify(store,null,2),{mode:0o600});await rename(temp,FILE);}
function event(action,entity){store.audit.push({id:randomUUID(),at:new Date().toISOString(),action,entity});}
function reply(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});res.end(JSON.stringify(data));}
function validPatient(id){return patients.some(p=>p.id===id);}
function classify(symptom){return symptom==='fever'||symptom==='dyspnea'?'urgent_review':'needs_review';}
function alertText(symptom){return ({fever:'Febre relatada: avaliação imediata pela equipe conforme protocolo institucional.',dyspnea:'Falta de ar relatada: procurar atendimento de urgência.',neuropathy:'Sintoma neurológico: revisão profissional e correlação com o protocolo.',nausea:'Náusea: revisar suporte prescrito, administrações e evolução.'})[symptom];}
function validate(body,fields){return body && typeof body==='object' && !Array.isArray(body) && Object.keys(body).every(k=>fields.includes(k));}
export async function createServer(){store=await load();return http.createServer(async(req,res)=>{
 const url=new URL(req.url||'/',`http://${HOST}`);
 if(req.method==='GET' && url.pathname==='/'){const html=await readFile(path.join(ROOT,'public','index.html'));res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(html);return;}
 if(req.method==='GET' && url.pathname==='/app.js'){const js=await readFile(path.join(ROOT,'public','app.js'));res.writeHead(200,{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'});res.end(js);return;}
 if(req.method==='GET' && url.pathname==='/api/state'){reply(res,200,{...store,syntheticOnly:true,clinicallyValidated:false});return;}
 if(req.method==='POST' && url.pathname.startsWith('/api/')){
   if(req.headers.origin && req.headers.origin!==`http://${HOST}:${server.address()?.port}`){reply(res,403,{error:'Origem inválida'});return;}
   if(req.headers['content-type']?.split(';')[0]!=='application/json'){reply(res,415,{error:'JSON obrigatório'});return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096){reply(res,413,{error:'Requisição excede limite'});return;}}
   let b;try{b=JSON.parse(raw);}catch{reply(res,400,{error:'JSON inválido'});return;}
   try{
    if(url.pathname==='/api/report'){
      if(!validate(b,['patientId','symptom','description'])||!validPatient(b.patientId)||!['fever','dyspnea','neuropathy','nausea'].includes(b.symptom)||typeof b.description!=='string'||b.description.length>280){reply(res,400,{error:'Dados inválidos'});return;}
      const report={id:randomUUID(),patientId:b.patientId,symptom:b.symptom,description:b.description,at:new Date().toISOString()};const level=classify(b.symptom);
      const alert={id:randomUUID(),patientId:b.patientId,reportId:report.id,level,status:'open',explanation:alertText(b.symptom),ruleVersion:'synthetic-2026.10.1'};
      store.reports.push(report);store.alerts.push(alert);event('symptom.reported',report.id);event('alert.created',alert.id);await persist();reply(res,201,{report,alert,notice:level==='urgent_review'?'DEMONSTRAÇÃO: sinal potencialmente urgente; não aguarde resposta deste sistema.':''});return;
    }
    if(url.pathname==='/api/review'){
      if(!validate(b,['alertId','decision','note'])||!['acknowledged','resolved'].includes(b.decision)||typeof b.note!=='string'||b.note.trim().length<5||b.note.length>500){reply(res,400,{error:'Revisão inválida'});return;}
      const alert=store.alerts.find(a=>a.id===b.alertId);if(!alert||alert.status!=='open'){reply(res,409,{error:'Alerta inexistente ou já revisado'});return;}
      alert.status=b.decision;const intervention={id:randomUUID(),alertId:alert.id,patientId:alert.patientId,note:b.note.trim(),decision:b.decision,actor:'PROFISSIONAL_SIMULADO',at:new Date().toISOString()};store.interventions.push(intervention);event('alert.reviewed',alert.id);await persist();reply(res,201,{intervention});return;
    }
    if(url.pathname==='/api/guidance'){
      if(!validate(b,['interventionId','body'])||typeof b.body!=='string'||b.body.trim().length<10||b.body.length>500){reply(res,400,{error:'Orientação inválida'});return;}
      const intervention=store.interventions.find(i=>i.id===b.interventionId);if(!intervention){reply(res,404,{error:'Intervenção não encontrada'});return;}
      if(store.guidance.some(g=>g.interventionId===intervention.id)){reply(res,409,{error:'Orientação já registrada'});return;}
      const guidance={id:randomUUID(),patientId:intervention.patientId,interventionId:intervention.id,body:b.body.trim(),status:'draft',at:new Date().toISOString()};store.guidance.push(guidance);event('guidance.drafted',guidance.id);await persist();reply(res,201,{guidance});return;
    }
    if(url.pathname==='/api/reset' && b?.confirm==='RESET_SYNTHETIC'){store=initial();event('lab.reset','synthetic');await persist();reply(res,200,{ok:true});return;}
    reply(res,404,{error:'Rota inexistente'});
   }catch(e){console.error('lab error',e);reply(res,500,{error:'Falha interna'});}return;
 }
 reply(res,404,{error:'Rota inexistente'});
});}
let server;
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 server=await createServer();server.listen(PORT,HOST,()=>console.log(`ONCOPHARMA laboratório sintético: http://${HOST}:${server.address().port}`));
}
