import { syntheticUiEnabled } from '../../../../../lib/synthetic';
import { NextResponse } from 'next/server';
import { session } from '../../../../../lib/auth';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const s=await session(); if(!s)return NextResponse.json({error:'Não autenticado'},{status:401});
 if(!syntheticUiEnabled())return NextResponse.json({error:'Recurso não habilitado'},{status:503});
 const {id}=await params;const org=process.env.DEV_ORGANIZATION_ID;
 if(!uuid.test(id)||!org||!uuid.test(org))return NextResponse.json({error:'Identificador inválido'},{status:400});
 try{const r=await fetch(`${process.env.API_INTERNAL_URL||'http://127.0.0.1:4000'}/v1/patients/${id}/record`,{headers:{authorization:`Bearer ${s.token}`,'x-organization-id':org},cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!r.ok)return NextResponse.json({error:'Acesso negado ou prontuário indisponível'},{status:r.status});
 return NextResponse.json(await r.json(),{headers:{'cache-control':'no-store'}});
 }catch{return NextResponse.json({error:'API indisponível'},{status:503});}
}
