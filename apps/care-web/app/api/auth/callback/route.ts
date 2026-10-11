import { NextRequest, NextResponse } from 'next/server';
import { cookieOptions, FLOW, oidcConfig, origin, seal, SESSION, unseal } from '../../../../lib/auth';
export const runtime='nodejs';
type Flow = {state:string;verifier:string;nonce:string;issuedAt:number};
export async function GET(req:NextRequest){
 const back=NextResponse.redirect(`${origin()}/care`);
 back.cookies.delete(FLOW);
 try {
 const code=req.nextUrl.searchParams.get('code'),state=req.nextUrl.searchParams.get('state');
 const flow=unseal<Flow>(req.cookies.get(FLOW)?.value||'');
 if(!code || !state || !flow || flow.state!==state || Date.now()-flow.issuedAt>600000 || flow.issuedAt>Date.now()+30000)throw Error('state inválido');
 const cfg=oidcConfig();const endpoint=new URL(cfg.tokenEndpoint);if(endpoint.protocol!=='https:'&&endpoint.hostname!=='localhost')throw Error('HTTPS obrigatório');
 const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:cfg.clientId,code_verifier:flow.verifier,redirect_uri:`${origin()}/api/auth/callback`}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('troca de código falhou');
 const tokens=await response.json() as {access_token?:string;token_type?:string;expires_in?:number};
 if(!tokens.access_token||tokens.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(tokens.expires_in)||Number(tokens.expires_in)<30)throw Error('token inválido');
 const maxAge=Math.min(1800,Math.floor(Number(tokens.expires_in))-15);
 back.cookies.set(SESSION,seal({token:tokens.access_token,expiresAt:Date.now()+maxAge*1000}),cookieOptions(maxAge));return back;
 }catch{const fail=NextResponse.redirect(`${origin()}/care?login=failed`);fail.cookies.delete(FLOW);fail.cookies.delete(SESSION);return fail;}
}
