import { NextRequest,NextResponse } from 'next/server';
import { FLOW, origin, SESSION } from '../../../../lib/auth';
const required=(n:string)=>{const v=process.env[n];if(!v)throw Error(`${n} ausente`);return v;};
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try {if(req.headers.get('origin')!==origin())return NextResponse.json({error:'Origem inválida'},{status:403});
 // M14.5: logout também encerra a sessão SSO no IdP (RP-initiated logout), se OIDC_END_SESSION_ENDPOINT estiver configurado.
 // Sem isso, o próximo "Entrar" reautentica silenciosamente pelo cookie do IdP (risco em dispositivo compartilhado).
 const end=process.env.OIDC_END_SESSION_ENDPOINT;let target=`${origin()}/`;
 if(end){const u=new URL(end);if(u.protocol!=='https:'&&u.hostname!=='localhost')throw Error('HTTPS obrigatório');u.searchParams.set('client_id',required('OIDC_CLIENT_ID'));u.searchParams.set('post_logout_redirect_uri',`${origin()}/`);target=u.toString();}
 const res=NextResponse.redirect(target,303);res.cookies.delete(SESSION);res.cookies.delete(FLOW);return res;
 }catch{return NextResponse.json({error:'Configuração ausente'},{status:503});}
}
