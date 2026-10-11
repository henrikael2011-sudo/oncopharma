import { NextResponse } from 'next/server';
import { session } from './auth';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(error:string,status:number)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function workflowProxy(request:Request,patientId:string,action:'symptoms'|'alerts'|'interventions'){
  if(process.env.NODE_ENV==='production'||process.env.NEXT_PUBLIC_ALLOW_SYNTHETIC_UI!=='true'||process.env.ALLOW_SYNTHETIC_API!=='true')return json('Somente ambiente DEV sintético',503);
  const org=process.env.DEV_ORGANIZATION_ID;
  if(!org||!UUID.test(org)||!UUID.test(patientId))return json('Identificador inválido',400);
  const s=await session();if(!s)return json('Autenticação necessária',401);
  if(request.method==='POST'){
    // Mesma origem é obrigatória: protege endpoints mutáveis contra CSRF.
    const origin=request.headers.get('origin');
    const configured=process.env.PORTAL_ORIGIN;
    if(!origin||!configured||origin!==new URL(configured).origin)return json('Origem não autorizada',403);
    const ct=request.headers.get('content-type')||'';
    if(!ct.toLowerCase().startsWith('application/json'))return json('Content-Type inválido',415);
  }
  let body:string|undefined;
  if(request.method==='POST'){
    body=await request.text();
    if(body.length>4096)return json('Solicitação excede o limite',413);
    try{const parsed=JSON.parse(body);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return json('Corpo inválido',400);}catch{return json('JSON inválido',400);}
  }
  const base=process.env.API_INTERNAL_URL||'http://127.0.0.1:4000';
  const path=action==='symptoms'?`care/patients/${patientId}/symptoms`:`clinical/patients/${patientId}/${action}`;
  try{
    const upstream=await fetch(`${base}/v1/workflow/${path}`,{method:request.method,headers:{authorization:`Bearer ${s.token}`,'x-organization-id':org,...(body?{'content-type':'application/json'}:{})},body,cache:'no-store',signal:AbortSignal.timeout(8000)});
    const raw=await upstream.text();let result:unknown;
    try{result=JSON.parse(raw)}catch{result={error:'Resposta inesperada da API'};}
    // Não repassar informações internas de erro ao cliente.
    if(upstream.status>=500)return json('Serviço clínico indisponível',503);
    // M14.5: negações 4xx da API (NestJS: {message,error}) exibidas com a mensagem pt-BR, sem detalhes internos.
    if(upstream.status>=400){const m=(result as {message?:unknown})?.message;return json(typeof m==='string'&&m.length<=200?m:'Solicitação recusada',upstream.status);}
    return NextResponse.json(result,{status:upstream.status,headers:{'Cache-Control':'no-store'}});
  }catch{return json('Não foi possível conectar à API',503);}
}
