import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const out='artifacts/validation'; mkdirSync(out,{recursive:true});
const report={schema:'oncopharma-validation-v1',date:new Date().toISOString(),baseline:'Plano Diretor v3.0',release:'M14.4',clinicalApproval:false,checks:[]};
function check(name,cmd,args,opts={}){
 const p=spawnSync(cmd,args,{encoding:'utf8',timeout:opts.timeout||120000,env:process.env,maxBuffer:8*1024*1024});
 const status=p.error?.code==='ENOENT'?'BLOCKED':p.status===0?'PASS':'FAIL';
 report.checks.push({name,status,exitCode:p.status,reason:p.error?.message||((p.stderr||'').slice(-1000)),command:[cmd,...args].join(' ')});
 writeFileSync(`${out}/${name.replace(/[^a-z0-9-]/gi,'_')}.log`,(p.stdout||'')+'\n'+(p.stderr||''));
 return status;
}
check('local-tests','npm',['run','verify:local']);
check('lab-unit-tests','npm',['run','test:lab']);
if(!process.env.DATABASE_URL)report.checks.push({name:'postgres-required',status:'BLOCKED',reason:'DATABASE_URL ausente; nenhum teste PostgreSQL executado.'});
else check('postgres-required','npm',['run','test:db:required'],{timeout:12000});
if(existsSync('node_modules/next')&&existsSync('node_modules/@nestjs'))check('full-build','npm',['run','build'],{timeout:180000});
else report.checks.push({name:'full-build',status:'BLOCKED',reason:'Dependências Next.js/NestJS não instaladas; build não executado.'});
if(!process.env.OIDC_ISSUER||!process.env.OIDC_CLIENT_ID)report.checks.push({name:'oidc-mfa',status:'BLOCKED',reason:'Provedor e identidades de homologação não configurados; não simular autenticação.'});
else report.checks.push({name:'oidc-mfa',status:'BLOCKED',reason:'Credenciais presentes não constituem teste E2E de OIDC/MFA; executar suite institucional.'});
if(existsSync('/usr/bin/chromium')){
 const temp=mkdtempSync(join(tmpdir(),'onco-browser-'));const port=41779;
 const server=spawn(process.execPath,['tools/synthetic-lab/server.mjs'],{env:{...process.env,PORT:String(port),ONCO_LAB_DATA:join(temp,'synthetic.json')},stdio:'ignore'});
 try {
   let ready=false;
   for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
   if(!ready)throw Error('Servidor sintético não iniciou');
   const r=spawnSync('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--window-size=1280,900',`--screenshot=${join(process.cwd(),out,'lab-browser.png')}`,`http://127.0.0.1:${port}/`],{encoding:'utf8',timeout:12000});
   const ok=r.status===0&&existsSync(`${out}/lab-browser.png`);
   report.checks.push({name:'browser-lab-render',status:ok?'PASS':'BLOCKED',reason:ok?'Chromium renderizou laboratório sintético; não é teste E2E do Next.js.':'Chromium indisponível operacionalmente no container (erro ou timeout); sem captura validada.'});
 }catch(e){report.checks.push({name:'browser-lab-render',status:'FAIL',reason:String(e)});}
 finally{server.kill();rmSync(temp,{recursive:true,force:true});}
}else report.checks.push({name:'browser-lab-render',status:'BLOCKED',reason:'Chromium indisponível.'});
const required=['full-build','postgres-required','oidc-mfa'];
report.readyForIntegratedValidation=required.every(n=>report.checks.find(c=>c.name===n)?.status==='PASS');
report.readyForClinicalUse=false;
writeFileSync(`${out}/validation-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.checks.some(c=>c.status==='FAIL'))process.exitCode=1;
