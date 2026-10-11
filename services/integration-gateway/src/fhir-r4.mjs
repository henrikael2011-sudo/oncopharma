/** FHIR R4 demonstration adapter: synthetic-only, no live hospital connection. */
export const ADAPTER_VERSION='fhir-r4-synthetic-0.1';
const resources=new Set(['Patient','Encounter','Observation','Condition','MedicationRequest','MedicationAdministration','AllergyIntolerance','Provenance']);
const iso=x=>typeof x==='string'&&!Number.isNaN(Date.parse(x));
export function validateSyntheticBundle(bundle){
 if(!bundle||bundle.resourceType!=='Bundle'||bundle.type!=='collection'||!Array.isArray(bundle.entry))throw Error('FHIR Bundle inválido');
 if(bundle.entry.length>200)throw Error('Limite de registros excedido');
 const seen=new Set();const normalized=[];
 for(const entry of bundle.entry){const r=entry?.resource;if(!r||!resources.has(r.resourceType)||typeof r.id!=='string'||!/^syn-[a-z0-9-]{1,60}$/.test(r.id))throw Error('Recurso não permitido ou identificador não sintético');
 const key=r.resourceType+'/'+r.id;if(seen.has(key))throw Error('Recurso duplicado: '+key);seen.add(key);
 if(r.meta?.lastUpdated&&!iso(r.meta.lastUpdated))throw Error('Data inválida');
 if(r.resourceType==='Observation'&&r.valueQuantity&&(!Number.isFinite(r.valueQuantity.value)||!r.valueQuantity.unit))throw Error('Unidade/valor inválido');
 normalized.push({resourceType:r.resourceType,id:r.id,source:'FHIR_R4_SYNTHETIC',lastUpdated:r.meta?.lastUpdated||null,raw:r});
 }
 return {adapterVersion:ADAPTER_VERSION,syntheticOnly:true,count:normalized.length,records:normalized};
}
export function reconcileSynthetic(previous,bundle){const current=validateSyntheticBundle(bundle);const map=new Map(previous.map(x=>[x.resourceType+'/'+x.id,x]));let inserted=0,updated=0;for(const r of current.records){const key=r.resourceType+'/'+r.id;if(!map.has(key))inserted++;else if(JSON.stringify(map.get(key).raw)!==JSON.stringify(r.raw))updated++;map.set(key,r)}return {inserted,updated,total:map.size,records:[...map.values()],clinicalWrites:false};}
