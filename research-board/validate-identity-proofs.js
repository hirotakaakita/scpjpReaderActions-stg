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
  if(proof.method==='explicit_scp_original_credit'){
   const source=normalizePage(proof.source),target=normalizePage(proof.target);
   const r=source&&sources.get(source.id)?.record;
   const credits=(r?.originalSources||[]).filter(x=>x.method==='credit_original_label');
   const urls=[...new Set(credits.map(x=>originalPage(x.url)?.url).filter(Boolean))];
   const src=owners.get(proof.source),dst=owners.get(proof.target);
   if(!source||!target||credits.length===0||urls.length!==1||urls[0]!==target.url||
      credits.some(x=>!originalPage(x.url))||!src||!dst||src!==dst||
      ![0,8,9].includes(src[3])||src[3]!==dst[3]||
      proof.source===proof.target){
     throw Error('Unproven exact original SCP credit');
   }
  }
  if(proof.method==='explicit_transitive_scp_original_credit'){
    const a=normalizePage(proof.source),b=normalizePage(proof.target);
    const src=record(proof.source);
    const first=(src?.originalSources||[]).filter(x=>x.method==='credit_original_label');
    const firstUrls=[...new Set(first.map(x=>originalPage(x.url)?.url).filter(Boolean))];
    if(!a||!b||!first.length||firstUrls.length!==1||first.some(x=>!originalPage(x.url)))
      throw Error('Ambiguous first-hop SCP original');
    const via=normalizePage(firstUrls[0]),intermediate=via&&record(via.url);
    const second=(intermediate?.originalSources||[]).filter(x=>x.method==='credit_original_label');
    const secondUrls=[...new Set(second.map(x=>originalPage(x.url)?.url).filter(Boolean))];
    if(!via||via.slug!==a.slug||via.host===a.host||via.host===b.host||
       !second.length||secondUrls.length!==1||secondUrls[0]!==b.url||
       second.some(x=>!originalPage(x.url))||
       owners.get(proof.source)!==owners.get(via.url)||owners.get(via.url)!==owners.get(proof.target))
      throw Error('Unproven two-hop original SCP credit');
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
