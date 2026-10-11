/** Gate of explanatory output; not a generative AI deployment. */
export function validateEvidenceDraft(draft,approvedRefs){
 if(!draft||draft.synthetic!==true)throw Error('Apenas caso sintético');
 if(!Array.isArray(draft.claims)||!draft.claims.length)throw Error('Nenhuma afirmação rastreável');
 if(draft.medicationOrder||draft.doseChange||draft.autoResolve||draft.automaticAdviceToPatient)throw Error('Ação clínica automática proibida');
 const refs=new Map(approvedRefs.filter(r=>r.approved===true&&r.version&&r.reviewedAt).map(r=>[r.id,r]));
 for(const claim of draft.claims){if(!claim.text||!claim.patientSource||!claim.observedAt||!claim.referenceId||!refs.has(claim.referenceId))throw Error('Afirmação sem proveniência ou referência aprovada');}
 return {status:'PENDING_CLINICIAN_REVIEW',claims:draft.claims.map(x=>({...x,referenceVersion:refs.get(x.referenceId).version})),clinicalDecision:false,approvedForPatient:false};
}
