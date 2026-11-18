'use strict';
const {normalizePage}=require('./extract');
const {originalPage}=require('../origin-provenance');
const {publisherOriginTags}=require('../catalog-origin');
const {generic}=require('./translation-identities');
function validateIdentityProofs(board,sources){
 const owners=new Map(board.nodes.flatMap(n=>n[13].map(p=>[p[1],n])));
 const record=url=>sources.get(normalizePage(url)?.id)?.record;
 const original=(url,metadata)=>{
  const r=record(url),credits=(r?.originalSources||[]).filter(x=>x.method==='credit_original_label');
  const raw=credits.length?credits:metadata?(r?.catalogIdentity?.originalSources||[]).filter(x=>x.method==='interwiki_original_metadata'):[];
  const urls=[...new Set(raw.map(x=>originalPage(x.url)?.url).filter(Boolean))];
  return urls.length===1?urls[0]:null;
 };
 for(const proof of board.workIdentityProofs||[]){
  if(['shared_explicit_original_credit','shared_verified_original_metadata'].includes(proof.method)){
   const metadata=proof.method==='shared_verified_original_metadata';
   const a=original(proof.source,metadata),b=original(proof.target,metadata);
   if(!a||a!==b)throw Error('Unproven shared original identity');
  }
  if(proof.method==='interwiki_original_metadata'){
   const r=record(proof.source);
   if(r?.originalSources?.length||original(proof.source,true)!==originalPage(proof.target)?.url)throw Error('Unproven interwiki original identity');
  }
  if(proof.method==='explicit_origin_and_translation_path'){
   const a=normalizePage(proof.source),b=normalizePage(proof.target);
   const origin=owners.get(proof.source)?.[8];
   if(!a||!b||a.slug!==b.slug||a.host===b.host||generic.test(a.slug)||!origin||origin==='other')throw Error('Unproven translated path identity');
   for(const url of [proof.source,proof.target]){
    const tags=publisherOriginTags(url,record(url));
    if(tags.origins.length!==1||tags.origins[0]!==origin||tags.conflicts.length||tags.unsupported.length)throw Error('Unproven translated origin identity');
   }
  }
 }
}
module.exports={validateIdentityProofs};
