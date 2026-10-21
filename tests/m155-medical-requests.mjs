// Executa regras compiladas e controlador real com banco instrumentado; não representa teste de RLS/PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {REQUEST_TRANSITIONS,requestTransition,evidenceRefs}=require('../services/api/dist/medical-request-rules.js');
const {MedicalRequestsController}=require('../services/api/dist/medical-requests.controller.js');
const ORG='11111111-1111-4111-8111-111111111111',PAT='22222222-2222-4222-8222-222222222221',ID='33333333-3333-4333-8333-333333333333';
const req={principal:{issuer:'https://idp.synthetic.invalid',sub:'farm',mfa:true,claims:{}}};
process.env.ONCO_ENVIRONMENT='test';process.env.ALLOW_SYNTHETIC_API='true';
test('grafo de estados: ator correto, sem atalhos/reabertura',()=>{
 for(const from of Object.keys(REQUEST_TRANSITIONS))for(const to of Object.keys(REQUEST_TRANSITIONS)){
  const valid=REQUEST_TRANSITIONS[from].includes(to),author=['sent','discarded','completed'].includes(to);
  assert.equal(requestTransition(from,to,true,false),valid&&author,`${from}->${to} autor`);
  assert.equal(requestTransition(from,to,false,true),valid&&!author,`${from}->${to} destinatário`);
  assert.equal(requestTransition(from,to,false,false),false);
 }
});
test('evidências: quantidade, UUID, tipo fechado e duplicatas',()=>{
 for(const bad of [null,[],[{type:'pdf',id:ID}],[{type:'lab',id:'x'}],[{type:'lab',id:ID},{type:'lab',id:ID}],Array(11).fill({type:'lab',id:ID})])assert.throws(()=>evidenceRefs(bad));
 assert.deepEqual(evidenceRefs([{type:'lab',id:ID,snapshot:'forjado'}]),[{type:'lab',id:ID}]);
});
function controller({role='pharmacist',linked=true,row={}}={}){
 const calls=[];
 const c={query:async(sql,params)=>{calls.push({sql,params});if(sql.includes('FROM memberships'))return{rows:[{role}]};if(sql.includes('sam_link'))return{rows:[{ok:linked}]};if(sql.includes('FROM medical_requests WHERE'))return{rows:[{id:ID,status:'draft',revision:1,author_issuer:req.principal.issuer,author_sub:'farm',...row}]};if(sql.includes('sam_recipient'))return{rows:[{ok:false}]};return{rows:[]};}};
 return{api:new MedicalRequestsController({withTenant:async(org,fn)=>{assert.equal(org,ORG);return fn(c);}}),calls};
}
test('MFA, papéis, vínculo e contexto somente derivado do principal',async()=>{
 const {api,calls}=controller();await assert.rejects(api.inbox({...req,principal:{...req.principal,mfa:false}},ORG),/MFA/);assert.equal(calls.length,0);
 for(const role of ['technical_admin','patient','caregiver','clinical_manager'])await assert.rejects(controller({role}).api.inbox(req,ORG),/Perfil/);
 await assert.rejects(controller({linked:false}).api.options(req,ORG,PAT),/não atribuído/);
 await api.inbox(req,ORG);const call=calls.find(c=>c.sql.includes('set_config'));assert.deepEqual(call.params,[req.principal.issuer,'farm']);
});
test('envio exige confirmação explícita, versão e autoria; nunca escreve prescrição',async()=>{
 const {api,calls}=controller();await assert.rejects(api.transition(req,ORG,ID,{revision:1,to:'sent'}),/revisão humana/);
 await assert.rejects(api.transition(req,ORG,ID,{revision:0,to:'sent',confirmed:true}),/mudou/);
 await assert.rejects(controller({row:{author_sub:'outro'}}).api.transition(req,ORG,ID,{revision:1,to:'sent',confirmed:true}),/não permitida/);
 await api.transition(req,ORG,ID,{revision:1,to:'sent',confirmed:true});assert.ok(calls.some(c=>c.sql.startsWith('UPDATE medical_requests')));
 assert.ok(calls.every(c=>!/^UPDATE clinical_medication/.test(c.sql)));
});
test('resposta só destinatário e conclusão só autor com referência; rascunho pode ser descartado',async()=>{
 await assert.rejects(controller().api.transition(req,ORG,ID,{revision:1,to:'accepted',response:'não'}),/não permitida/);
 const {api}=controller({row:{status:'accepted'}});await assert.rejects(api.transition(req,ORG,ID,{revision:1,to:'completed',outcome:'Avaliado'}),/caracteres/);
 await api.transition(req,ORG,ID,{revision:1,to:'completed',outcome:'Avaliado',officialReference:'REG-SINT-1'});
 await controller().api.transition(req,ORG,ID,{revision:1,to:'discarded'});
 await assert.rejects(controller({row:{status:'sent'}}).api.transition(req,ORG,ID,{revision:1,to:'discarded'}),/não permitida/);
});
