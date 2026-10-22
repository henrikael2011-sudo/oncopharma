'use client';
// M15.5: detalhes somente após abrir; decisões explícitas e estados humanos, sem alteração de prescrição.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { work, when } from '../../lib/work-client';
import { ClinIcon, ClinTile } from './ClinIcons';

type Status = 'draft'|'sent'|'in_review'|'accepted'|'adjusted'|'declined'|'completed'|'discarded';
const LABEL: Record<Status,string> = { draft:'Rascunho',sent:'Enviada',in_review:'Em revisão',accepted:'Aceita',adjusted:'Ajustada',declined:'Recusada',completed:'Concluída',discarded:'Descartada' };
const PRIORITY: Record<string,string> = { routine:'Rotina',priority:'Prioritária',urgent:'Urgente' };
const TYPES: Record<string,string> = { alert:'Alerta',lab:'Exame',order:'Prescrição registrada',administration:'Administração',symptom:'Relato de sintoma' };
type Ref = {type:string;id:string};
type Option = Ref & {label:string;at:string;source:string};
type Options = {unit:string|null; doctors:{issuer:string;sub:string;label:string}[];priorities:{priority:string;label:string;description:string;sla_minutes:number|null}[];evidence:Option[]};
type Item = {id:string;status:Status;priority:string;created_at:string};
type Detail = Item & { patient:{name:string|null;record:string|null}; revision:number;mine:boolean;actions:Status[];justification:string;response:string|null;outcome:string|null;official_reference:string|null;unit:string;recipient_mode:string;recipientLabel:string;recipientActive:boolean;actorProfileComplete:boolean;
 evidence:(Ref & {source_reference:string;source_at:string;snapshot:Record<string,unknown>})[];
 criteria_snapshot:{description:string;sla_minutes:number|null}|null;events:{revision:number;action:string;actor_role:string;actor_name:string|null;actor_reference:string|null;actor_registration:string|null;at:string;access_reason:string}[]};
const message = (e: unknown) => e instanceof Error ? e.message : 'Não foi possível concluir agora.';
const refKey = (r:Ref) => `${r.type}:${r.id}`;

export function MedicalRequestList({patientId,startOpen=false}:{patientId?:string;startOpen?:boolean}) {
 const [items,setItems]=useState<Item[]|null>(null),[error,setError]=useState(''),[creating,setCreating]=useState(startOpen);
 const load=useCallback(async()=>{try{const r=await work<{items:Item[]}>(patientId?`patients/${patientId}/medical-requests`:'medical-requests/inbox');setItems(r.items);setError('');}catch(e){setError(message(e));}},[patientId]);
 useEffect(()=>{void load();},[load]);
 return <div>
  <p>O pedido registra uma avaliação médica. A prescrição só pode ser alterada pelo médico no sistema oficial.</p>
  {error&&<p role="alert" className="clin-error">{error}<button type="button" className="btn-secondary" onClick={()=>void load()}>Tentar de novo</button></p>}
  {patientId&&<button type="button" className="btn-primary" aria-expanded={creating} onClick={()=>setCreating(!creating)}>Nova solicitação ao médico</button>}
  {creating&&patientId&&<MedicalRequestForm patientId={patientId}/>}
  {!items&&!error&&<p role="status">Carregando solicitações…</p>}
  {items?.length===0&&<p className="clin-empty">Nenhuma solicitação disponível.</p>}
  <ul className="clin-list">{items?.map(r=><li key={r.id} className="clin-card"><Link href={`/clinical/solicitacoes/${r.id}`}>Abrir solicitação de {when(r.created_at)}</Link><p>{LABEL[r.status]} · {PRIORITY[r.priority]}</p></li>)}</ul>
 </div>;
}
function EvidenceChoices({options,selected,onChange}:{options:Option[];selected:Ref[];onChange:(v:Ref[])=>void}) {
 return <fieldset style={{minWidth:0,maxWidth:'100%'}}><legend>Evidências vinculadas (1 a 10)</legend>{options.length===0&&<p>Sem evidências disponíveis.</p>}
  {options.map(o=><label key={refKey(o)} className="clin-toggle" style={{overflowWrap:'anywhere'}}><input style={{width:24,minHeight:24,flexShrink:0}} type="checkbox" checked={selected.some(x=>refKey(x)===refKey(o))} onChange={e=>onChange(e.target.checked?[...selected,{type:o.type,id:o.id}]:selected.filter(x=>refKey(x)!==refKey(o)))}/>{TYPES[o.type]}: {o.label} · {when(o.at)}<small>Origem: {o.source}</small></label>)}
 </fieldset>;
}
export function MedicalRequestForm({patientId}:{patientId:string}) {
 const [o,setO]=useState<Options|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[created,setCreated]=useState<string|null>(null);
 const [justification,setJustification]=useState(''),[priority,setPriority]=useState('routine'),[target,setTarget]=useState('on_call'),[refs,setRefs]=useState<Ref[]>([]);
 const load=useCallback(()=>{setError('');work<Options>(`patients/${patientId}/medical-request-options`).then(setO).catch(e=>setError(message(e)));},[patientId]);useEffect(load,[load]);
 if(created)return <p role="status">Rascunho salvo. <Link href={`/clinical/solicitacoes/${created}`}>Abrir rascunho para revisar e enviar</Link></p>;
 return <div>{error&&<p role="alert" className="clin-error">{error}<button type="button" className="btn-secondary" onClick={load}>Recarregar opções</button></p>}
 {!o&&!error&&<p role="status">Carregando opções…</p>}
 {o&&<form className="workflow-form" onSubmit={async e=>{e.preventDefault();setError('');setBusy(true);try{
  const doctor=o.doctors.find(d=>d.sub+'|'+d.issuer===target);
  const r=await work<{id:string}>(`patients/${patientId}/medical-requests`,{method:'POST',body:{justification,priority,evidence:refs,recipientMode:target==='on_call'?'on_call':'specific',recipientIssuer:doctor?.issuer,recipientSub:doctor?.sub}});setCreated(r.id);
 }catch(e){setError(message(e));}finally{setBusy(false);}}}>
 <p>Unidade: {o.unit??'Não configurada'}</p>
 <label htmlFor="sam-recipient">Destinatário</label><select id="sam-recipient" value={target} onChange={e=>setTarget(e.target.value)}><option value="on_call">Médico do plantão da unidade (resolvido no envio)</option>{o.doctors.map(d=><option key={d.sub+'|'+d.issuer} value={d.sub+'|'+d.issuer}>{d.label}</option>)}</select>
 <label htmlFor="sam-priority">Prioridade</label><select id="sam-priority" value={priority} onChange={e=>setPriority(e.target.value)}>{Object.entries(PRIORITY).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
 <p>{o.priorities.find(p=>p.priority===priority)?.description??'Critério de prioridade não configurado; envio indisponível.'}</p><p>Critérios demonstrativos, não aprovados clinicamente. Não há encerramento ou escalonamento automático.</p>
 <EvidenceChoices options={o.evidence} selected={refs} onChange={setRefs}/>
 <label htmlFor="sam-justification">Justificativa para avaliação médica</label><textarea id="sam-justification" required minLength={10} maxLength={2000} rows={4} value={justification} onChange={e=>setJustification(e.target.value)}/>
 <button className="btn-primary" type="submit" disabled={busy||!o.unit||refs.length<1||refs.length>10}>{busy?'Salvando…':'Salvar rascunho'}</button>
 </form>}</div>;
}
export function MedicalRequestDetail({id}:{id:string}) {
 const [d,setD]=useState<Detail|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
 const [response,setResponse]=useState(''),[outcome,setOutcome]=useState(''),[reference,setReference]=useState(''),[edit,setEdit]=useState(false),[justification,setJustification]=useState(''),[priority,setPriority]=useState('routine');
 const load=useCallback(async()=>{const r=await work<Detail>(`medical-requests/${id}`);setD(r);setJustification(r.justification);setPriority(r.priority);setConfirmed(false);},[id]);
 useEffect(()=>{load().catch(e=>setError(message(e)));},[load]);
 const move=async(to:Status)=>{if(!d)return;setBusy(true);setError('');setNotice('');try{await work(`medical-requests/${id}/transition`,{method:'POST',body:{revision:d.revision,to,confirmed,response,outcome,officialReference:reference}});await load();setNotice('Decisão registrada. Nenhuma prescrição foi alterada.');}catch(e){setError(message(e));await load().catch(()=>{});}finally{setBusy(false);}};
 return <article className="cv-req" style={{overflowWrap:'anywhere',minWidth:0}}>
 {d&&<dl className="cv-pstrip">{([['Paciente',d.patient.name??'Sem nome registrado'],['Prontuário',d.patient.record??'Não informado'],['Unidade',d.unit],['Prioridade',PRIORITY[d.priority]]] as [string,string][]).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
 <nav aria-label="Navegação" className="vg-crumb"><Link href="/clinical/pacientes">Lista de pacientes</Link> · <Link href="/clinical/solicitacoes">Solicitações recebidas</Link> › {id.slice(0,8).toUpperCase()}</nav>
 <h1>Pedido de alteração ao médico</h1>
 <p className="cv-banner"><ClinTile name="scale" gold /><b>O ONCOPHARMA registra a solicitação e a resposta. O médico realiza qualquer alteração no sistema oficial.</b></p>
 <p>O médico só vê o pedido ao abrir “Solicitações recebidas”. Não há aviso nem acompanhamento de prazo. Em urgência, fale diretamente com o médico.</p>
 {error&&<p role="alert" className="clin-error">{error}<button type="button" className="btn-secondary" onClick={()=>{setError('');load().catch(e=>setError(message(e)));}}>Atualizar solicitação</button></p>}
 {notice&&<p role="status" className="clin-ok">{notice}</p>}
 {!d&&!error&&<p role="status">Carregando solicitação…</p>}
 {d&&<>
 {!d.actorProfileComplete&&<p role="alert" className="clin-error">Seu nome profissional não está cadastrado. Você pode consultar este pedido, e a leitura foi registrada com seu identificador autenticado. Solicite à equipe responsável a atualização do cadastro para realizar alterações.</p>}
 {d.mine&&!d.recipientActive&&['sent','in_review'].includes(d.status)&&<p role="alert" className="clin-error">Destinatário sem acesso ativo: o plantão terminou ou o vínculo foi encerrado. O pedido continua pendente, sem redirecionamento ou escalonamento automático. Fale diretamente com o médico e com a equipe responsável.</p>}
 <section className="cv-card cv-steps-card" aria-label="Status do pedido"><p className="cv-h"><ClinTile name="sync" />Status do pedido</p><Steps d={d}/></section>
 <div className="cv-req-grid"><div className="cv-req-main">
 <section className="clin-card" aria-labelledby="sam-status"><h2 id="sam-status">{LABEL[d.status]}</h2><p>{d.patient.name??'Sem nome registrado'} · Prontuário {d.patient.record??'Não informado'} · {d.unit}</p><p>{PRIORITY[d.priority]} · Criada em {when(d.created_at)}</p>
 <p>Destinatário: {d.recipient_mode==='on_call'?'Médico do plantão da unidade':'Médico vinculado selecionado'} · {d.recipientLabel}</p>
 <p>{d.criteria_snapshot?.description??'Critério validado no envio.'}{d.criteria_snapshot?.sla_minutes?` · Prazo de referência do serviço: ${d.criteria_snapshot.sla_minutes} minutos; sem escalonamento e sem acompanhamento automático do prazo.`:''}</p>
 <h3>Justificativa</h3><p>{d.justification}</p>
 {d.response&&<><h3>Resposta médica</h3><p>{d.response}</p></>}{d.outcome&&<><h3>Desfecho</h3><p>{d.outcome}</p><p>Referência no sistema oficial: {d.official_reference}</p></>}
 </section>
 <section className="clin-card cv-flag" aria-labelledby="sam-evidence"><h2 id="sam-evidence"><ClinTile name="flag" />Evidências vinculadas</h2><ul className="clin-list">{d.evidence.map(e=><li className="clin-card" key={refKey(e)}><strong>{TYPES[e.type]}</strong><p>{String(e.snapshot.analyte_label??e.snapshot.medication??e.snapshot.symptom_code??e.snapshot.code??'Registro')}: {String(e.snapshot.explanation??e.snapshot.description??e.snapshot.result_value??e.snapshot.status??'Sem detalhe textual')}</p><p>Origem: {e.source_reference} · {when(e.source_at)}</p></li>)}</ul></section>
 </div><div className="cv-req-side">
 {d.mine&&d.actorProfileComplete&&d.status==='draft'&&<>
 <button type="button" className="btn-secondary" aria-expanded={edit} onClick={()=>setEdit(!edit)}>Editar justificativa e prioridade</button>
 {edit&&<form className="workflow-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await work(`medical-requests/${id}/edit`,{method:'POST',body:{revision:d.revision,justification,priority,evidence:d.evidence.map(({id,type})=>({id,type}))}});await load();setEdit(false);setNotice('Rascunho atualizado.');}catch(e){setError(message(e));}finally{setBusy(false);}}}>
 <label htmlFor="sam-edit-justification">Justificativa revisada</label><textarea id="sam-edit-justification" required minLength={10} maxLength={2000} value={justification} onChange={e=>setJustification(e.target.value)}/>
 <label htmlFor="sam-edit-priority">Prioridade revisada</label><select id="sam-edit-priority" value={priority} onChange={e=>setPriority(e.target.value)}>{Object.entries(PRIORITY).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button type="submit" className="btn-primary" disabled={busy}>Salvar revisão</button></form>}
 <p>Para trocar destinatário ou evidências, descarte este rascunho e crie outro; o histórico permanece preservado.</p>
 <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Revisei as evidências, a justificativa e o destinatário e confirmo o envio.</label>
 <div className="clin-actions"><button type="button" className="btn-primary" disabled={busy||!confirmed||edit} onClick={()=>void move('sent')}>Enviar ao médico</button><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void move('discarded')}>Descartar rascunho</button></div>
 </>}
 {d.actions.includes('in_review')&&<button type="button" className="btn-primary" disabled={busy} onClick={()=>void move('in_review')}>Iniciar revisão médica</button>}
 {d.actions.includes('accepted')&&<form className="workflow-form" onSubmit={e=>e.preventDefault()}><label htmlFor="sam-response">Resposta médica obrigatória</label><textarea id="sam-response" required minLength={3} maxLength={2000} value={response} onChange={e=>setResponse(e.target.value)}/><div className="clin-actions">{(['accepted','adjusted','declined'] as Status[]).map(s=><button key={s} type="button" className="btn-primary" disabled={busy||response.trim().length<3} onClick={()=>void move(s)}>{LABEL[s]}</button>)}</div></form>}
 {d.actions.includes('completed')&&<form className="workflow-form" onSubmit={e=>{e.preventDefault();void move('completed');}}><label htmlFor="sam-outcome">Desfecho</label><textarea id="sam-outcome" required minLength={3} maxLength={2000} value={outcome} onChange={e=>setOutcome(e.target.value)}/><label htmlFor="sam-reference">Referência do registro no sistema oficial</label><input id="sam-reference" required minLength={3} maxLength={300} value={reference} onChange={e=>setReference(e.target.value)}/><button className="btn-primary" type="submit" disabled={busy}>Registrar conclusão</button></form>}
 <section className="clin-card" aria-labelledby="sam-history"><h2 id="sam-history"><ClinTile name="msg" />Histórico da solicitação</h2><ol className="timeline">{d.events.map((e,i)=><li key={i}><time dateTime={e.at}>{when(e.at)}</time> <strong>{({created:'Criada',edited:'Editada',read:'Leitura',...LABEL} as Record<string,string>)[e.action]??e.action}</strong> · {e.actor_name??`Nome pendente · identificação ${e.actor_reference}`}{e.actor_registration?` · ${e.actor_registration}`:''} · {({pharmacist:'Farmácia',physician:'Medicina',nurse:'Enfermagem'} as Record<string,string>)[e.actor_role]??'Profissional'} · {e.access_reason==='on_call'?'Acesso de plantão':'Acesso autorizado'}</li>)}</ol></section></div></div>
 </>}
 </article>;
}
// Etapas do mockup v3h, a partir do status real e dos eventos registrados (horário em BRT).
const STEPS:[string,Status[]][]=[['Rascunho',['draft']],['Enviada',['sent']],['Em revisão',['in_review']],['Respondida',['accepted','adjusted','declined']],['Concluída',['completed']]];
function Steps({d}:{d:Detail}){
 if(d.status==='discarded')return <p className="cv-step is-on">Descartada · {when(d.events.at(-1)?.at??d.created_at)}</p>;
 const cur=STEPS.findIndex(([,st])=>st.includes(d.status));
 return <ol className="cv-steps">{STEPS.map(([label,st],i)=>{const ev=[...d.events].reverse().find(e=>st.includes(e.action as Status)||(i===0&&e.action==='created'));
  return <li key={label} className={`cv-step${i<cur?' is-done':i===cur?' is-on':''}`} aria-current={i===cur?'step':undefined}><b>{i<cur?'✓ ':''}{i===3&&cur===3?LABEL[d.status]:label}</b><small>{ev&&i<=cur?when(ev.at):i===3?'aceita · recusada · ajustada':'—'}</small></li>;})}</ol>;
}
