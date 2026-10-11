import { WorkflowReview } from './WorkflowReview';
'use client';
import { SyntheticRecord } from './SyntheticRecord';
import { useEffect,useState } from 'react';
type Data={profile:{subject:string;mfa:boolean;memberships:{organization_id:string;role:string;active:boolean}[]};patients?:{patients:{id:string;external_reference:string}[]} | null};
export function ClinicalAccess(){const [data,setData]=useState<Data|null>(null);const [error,setError]=useState('Verificando sessão profissional...');
useEffect(()=>{let live=true;fetch('/api/clinical/summary',{cache:'no-store'}).then(async r=>{const body=await r.json();if(!live)return;if(!r.ok){setError(r.status===401?'Faça login para acessar os dados profissionais.':body.error||'Acesso indisponível.');return;}setData(body);setError('');}).catch(()=>live&&setError('Não foi possível conectar ao servidor.'));return()=>{live=false;};},[]);
return <section className="next-step" aria-live="polite"><h2>Acesso profissional</h2>{data?<><p>Identidade autenticada • MFA: {data.profile.mfa?'confirmado pelo token':'não confirmado'}</p><p>Vínculos institucionais ativos: {data.profile.memberships?.length||0}</p><p>Pacientes sintéticos autorizados: {data.patients?.patients?.length??'não habilitado'}</p><p>Os dados abaixo são exclusivamente sintéticos e não constituem prontuário clínico homologado.</p>{data.patients?.patients?.length ? <><SyntheticRecord patients={data.patients.patients}/><WorkflowReview patients={data.patients.patients}/></> : null}<form method="post" action="/api/auth/logout"><button type="submit">Encerrar sessão</button></form></>:<><p>{error}</p><a className="back" href="/api/auth/login">Entrar com identidade institucional</a></>}</section>;
}
