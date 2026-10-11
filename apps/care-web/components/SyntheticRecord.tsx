'use client';
import {useState} from 'react';
type Observation={id:string;category:string;title:string;value_text:string;observed_at:string;source_type:string;source_reference:string};
type Cycle={id:string;cycle_number:number;planned_on:string|null;status:string;protocol_code:string;protocol_label:string;revision:string;approved:boolean};
type StructuredItem=Record<string,string|number|null>;
type RecordData={structured?:Record<string,StructuredItem[]>;patient:{id:string;external_reference:string};cycles:Cycle[];observations:Observation[]};
export function SyntheticRecord({patients}:{patients:{id:string;external_reference:string}[]}){
 const [record,setRecord]=useState<RecordData|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 async function open(id:string){setLoading(true);setError('');setRecord(null);try{const r=await fetch(`/api/clinical/patients/${encodeURIComponent(id)}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Falha na consulta');setRecord(j);}catch(e){setError(e instanceof Error?e.message:'Erro inesperado');}finally{setLoading(false)}}
 return <section className="next-step"><h2>Prontuários sintéticos</h2><p>Somente desenvolvimento. Nenhuma recomendação clínica, prescrição ou classificação de risco automática.</p><div className="clinical-grid">{patients.map(p=><button type="button" key={p.id} onClick={()=>open(p.id)} disabled={loading}>{p.external_reference}</button>)}</div>
 {loading&&<p role="status">Consultando prontuário...</p>}{error&&<p role="alert">{error}</p>}{record&&<div><h3>{record.patient.external_reference}</h3><h4>Ciclos e protocolos</h4>{record.cycles.map(c=><article key={c.id} className="module"><strong>{c.protocol_code} · ciclo {c.cycle_number}</strong><p>{c.status} • previsto {c.planned_on||'sem data'} • versão {c.revision}</p><small>{c.approved?'Aprovado':'Protocolo fictício não aprovado'}</small></article>)}<h4>Dados clínicos estruturados</h4><p>Prescrição não comprova administração. Valores e intervalos abaixo são apenas sintéticos e não devem orientar condutas.</p>{([
 ['allergies','Alergias','substance','reaction','recorded_at'],
 ['measurements','Antropometria e sinais vitais','kind','value','measured_at'],
 ['labs','Exames laboratoriais','analyte_label','result_value','collected_at'],
 ['medicationOrders','Medicamentos prescritos','medication','status','ordered_at'],
 ['medicationAdministrations','Medicamentos administrados','medication','status','administered_at'],
 ['pharmacyAssessments','Avaliações farmacêuticas','title','summary','authored_at']
 ] as const).map(([key,label,title,value,date])=><section key={key}><h5>{label}</h5>{(record.structured?.[key]||[]).length===0?<p>Sem registros nesta seção.</p>:(record.structured?.[key]||[]).map(item=><article key={String(item.id)} className="module"><strong>{String(item[title]??'—')}</strong><p>{String(item[value]??'—')} {item.unit?String(item.unit):''}</p><small>{new Date(String(item[date])).toLocaleString('pt-BR')} · Fonte: {String(item.source_reference??'Não informada')}</small></article>)}</section>)}<h4>Linha do tempo multiprofissional</h4>{record.observations.map(o=><article key={o.id} className="module"><strong>{o.title} · {o.category}</strong><p>{o.value_text}</p><small>{new Date(o.observed_at).toLocaleString('pt-BR')} • Fonte: {o.source_type} / {o.source_reference}</small></article>)}</div>}
 </section>;
}
