import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { cookieOptions, FLOW, oidcConfig, origin, postLoginPath, seal, SESSION, unseal } from '../../../../lib/auth';
export const runtime='nodejs';
type Flow = {state:string;verifier:string;nonce:string;issuedAt:number};
export async function GET(req:NextRequest){
 try {
 const code=req.nextUrl.searchParams.get('code'),state=req.nextUrl.searchParams.get('state');
 const flow=unseal<Flow>(req.cookies.get(FLOW)?.value||'');
 if(!code || !state || !flow || flow.state!==state || Date.now()-flow.issuedAt>600000 || flow.issuedAt>Date.now()+30000)throw Error('state inválido');
 const cfg=oidcConfig();const endpoint=new URL(cfg.tokenEndpoint);if(endpoint.protocol!=='https:'&&endpoint.hostname!=='localhost')throw Error('HTTPS obrigatório');
 const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:cfg.clientId,code_verifier:flow.verifier,redirect_uri:`${origin()}/api/auth/callback`}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('troca de código falhou');
 const tokens=await response.json() as {access_token?:string;id_token?:string;token_type?:string;expires_in?:number};
 if(!tokens.access_token||!tokens.id_token||tokens.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(tokens.expires_in)||Number(tokens.expires_in)<30)throw Error('token inválido');
 const jwksUrl=new URL(cfg.jwksUri);if(jwksUrl.protocol!=='https:'&&jwksUrl.hostname!=='localhost')throw Error('HTTPS obrigatório');
 const jwks=createRemoteJWKSet(jwksUrl);
 const {payload:id}=await jwtVerify(tokens.id_token,jwks,{issuer:cfg.issuer,audience:cfg.clientId,algorithms:['RS256','ES256'],requiredClaims:['exp','iat','sub'],clockTolerance:5});
 const {payload:access}=await jwtVerify(tokens.access_token,jwks,{issuer:cfg.issuer,audience:cfg.audience,algorithms:['RS256','ES256'],requiredClaims:['exp','iat','sub'],clockTolerance:5});
 if(id.nonce!==flow.nonce||!id.sub||id.sub!==access.sub)throw Error('identidade/nonce inválido');
 if(id.at_hash!==undefined){const hash=createHash('sha256').update(tokens.access_token).digest();if(id.at_hash!==hash.subarray(0,hash.length/2).toString('base64url'))throw Error('at_hash inválido');}
 const maxAge=Math.min(1800,Math.floor(Number(tokens.expires_in))-15,Math.floor(Number(access.exp)-Date.now()/1000)-15);
 if(maxAge<10)throw Error('token expirando');
 const back=NextResponse.redirect(`${origin()}${postLoginPath()}`);back.cookies.delete(FLOW);
 back.cookies.set(SESSION,seal({token:tokens.access_token,expiresAt:Date.now()+maxAge*1000}),cookieOptions(maxAge));return back;
 }catch{const fail=NextResponse.redirect(`${origin()}${postLoginPath()}?login=failed`);fail.cookies.delete(FLOW);fail.cookies.delete(SESSION);return fail;}
}
