import { NextRequest, NextResponse } from 'next/server';
import { challenge, cookieOptions, FLOW, oidcConfig, origin, random, seal } from '../../../../lib/auth';
export const runtime='nodejs';
// M17: ?mfa=1 = nova autenticação completa (prompt=login, max_age=0) para o IdP executar o formulário OTP.
// Corrige o 1º acesso após cadastrar o autenticador (a ação CONFIGURE_TOTP não gera amr=otp); a API continua exigindo MFA.
function stepUp(url: URL){url.searchParams.set('prompt','login');url.searchParams.set('max_age','0');}
export async function GET(req:NextRequest){
 try {const cfg=oidcConfig();const state=random(),verifier=random(),nonce=random();const url=new URL(cfg.authorizationEndpoint);
 if(url.protocol!=='https:' && url.hostname!=='localhost') throw Error('OIDC requer HTTPS');
 url.searchParams.set('response_type','code');url.searchParams.set('client_id',cfg.clientId);url.searchParams.set('redirect_uri',`${origin()}/api/auth/callback`);url.searchParams.set('scope',process.env.OIDC_SCOPE||'openid profile');url.searchParams.set('state',state);url.searchParams.set('nonce',nonce);url.searchParams.set('code_challenge',challenge(verifier));url.searchParams.set('code_challenge_method','S256');
 if(req.nextUrl.searchParams.get('mfa')==='1')stepUp(url);
 // M15 (D-009, Entra ID): solicita Authentication Context (ex.: c1) para que o access token traga `acrs` (MFA por app autenticador, sem SMS).
 const acrs=(process.env.OIDC_ACRS_REQUEST||'').trim();if(acrs){if(!/^c([1-9]|[1-9][0-9])$/.test(acrs))throw Error('OIDC_ACRS_REQUEST inválido');url.searchParams.set('claims',JSON.stringify({access_token:{acrs:{essential:true,value:acrs}}}));}
 const res=NextResponse.redirect(url);res.cookies.set(FLOW,seal({state,verifier,nonce,issuedAt:Date.now()}),cookieOptions(600));return res;
 }catch{return NextResponse.json({error:'Autenticação indisponível; configuração pendente.'},{status:503});}
}
