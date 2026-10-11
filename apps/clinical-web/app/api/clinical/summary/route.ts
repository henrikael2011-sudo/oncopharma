import { syntheticUiEnabled } from '../../../../lib/synthetic';
import { NextResponse } from 'next/server';
import { session } from '../../../../lib/auth';
export const runtime='nodejs';
export async function GET(){
 const s=await session();if(!s)return NextResponse.json({error:'Não autenticado'},{status:401});
 const api=process.env.API_INTERNAL_URL||'http://127.0.0.1:4000';
 try {const me=await fetch(`${api}/v1/me`,{headers:{authorization:`Bearer ${s.token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!me.ok)return NextResponse.json({error:'Não foi possível validar acesso profissional'},{status:me.status===401?401:403});
 const profile=await me.json();
 // A lista de pacientes continua indisponível até habilitação explícita do ambiente sintético.
 const org=process.env.DEV_ORGANIZATION_ID;let patients=null;
 if(syntheticUiEnabled() && org){
 const result=await fetch(`${api}/v1/patients`,{headers:{authorization:`Bearer ${s.token}`,'x-organization-id':org},cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(result.ok)patients=await result.json();
 }
 return NextResponse.json({profile,patients,clinicalOperationsEnabled:false},{headers:{'cache-control':'no-store'}});
 }catch{return NextResponse.json({error:'API clínica indisponível'},{status:503});}
}
