import { NextRequest,NextResponse } from 'next/server';
import { FLOW, origin, SESSION } from '../../../../lib/auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try {if(req.headers.get('origin')!==origin())return NextResponse.json({error:'Origem inválida'},{status:403});
 const res=NextResponse.redirect(`${origin()}/`,303);res.cookies.delete(SESSION);res.cookies.delete(FLOW);return res;
 }catch{return NextResponse.json({error:'Configuração ausente'},{status:503});}
}
