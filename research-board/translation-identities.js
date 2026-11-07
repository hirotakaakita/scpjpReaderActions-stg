'use strict';
const {normalizePage}=require('./extract');
const site=code=>code==='zh-tr'?'zh':code;
const native=p=>site(p.siteBranch)===p.branch||(p.siteBranch==='cs'&&p.branch==='sk');
const generic=/^(?:main|index|home|start|about|groups-of-interest|foundation-tales|canon-hub|series-archive|personnel-and-character-dossier|task-forces|secure-facilities-locations|goi-formats)(?:-[a-z]{2})?$/;
const authorIds=r=>new Set((r?.authors||[]).map(a=>/wikidot\.com\/user:info\/([^/?#]+)/i.exec(a.url||'')?.[1]?.toLowerCase()).filter(Boolean));
function translationIdentities(pages,sources){
 const byId=new Map(pages.map(p=>[p.id,p])), originals=new Map(), candidates=[],review=[];
 for(const p of pages)if(p.pageType?.startsWith('related-document-')&&p.branch!=='other'&&native(p)){
   const key=p.branch+'\0'+p.slug;if(!originals.has(key))originals.set(key,[]);originals.get(key).push(p);
 }
 for(const p of pages){
   const state=sources.get(p.id),r=state?.record;
   if(!r||['not_found','not_article','unavailable'].includes(state.lastAttempt?.status))continue;
   const creditTargets=[];
   if(new Set((r.originalSources||[]).filter(s=>s.method==='credit_original_label').map(s=>s.url)).size>1){review.push({url:p.url,reason:'conflicting_original_credits'});continue;}
   for(const proof of r.originalSources||[]){
     const target=normalizePage(proof.url),q=target&&byId.get(target.id);
     if(q&&q.id!==p.id&&proof.method==='credit_original_label')creditTargets.push({source:p.id,target:q.id,type:'translation_assertion',proof:[r.url,proof.quote||'','original_credit',r.contentSha256,'','credit_original_label',r.checkedAt]});
   }
   if(new Set(creditTargets.map(e=>e.target)).size>1){review.push({url:p.url,reason:'conflicting_original_credits'});continue;}
   candidates.push(...creditTargets);
   if(r.originalSources?.length)continue; // Even an uncollected explicit original overrides path conventions.
   if(!p.pageType?.startsWith('related-document-')||p.branch==='other'||native(p))continue;
   const possible=originals.get(p.branch+'\0'+p.slug)||[];
   if(!possible.length)continue; // A translation-only catalog node is valid.
   if(possible.length!==1){review.push({url:p.url,reason:'ambiguous_original'});continue;}
   const q=possible[0],qr=sources.get(q.id)?.record,meta=r.catalogIdentity;
   if(p.kindIndex!==q.kindIndex||generic.test(p.slug)){review.push({url:p.url,original:q.url,reason:'category_or_generic_path'});continue;}
   const a=authorIds(r),b=authorIds(qr),shared=[...a].filter(id=>b.has(id));
   if(a.size&&b.size&&!shared.length){review.push({url:p.url,original:q.url,reason:'author_conflict'});continue;}
   const originProof=meta?.originBranch===p.branch&&['publisher_origin_tag','official_index_section','publisher_default_origin','native_official_collection','explicit_original_credit','explicit_translation_metadata','catalog_page_type'].includes(meta.basis);
   // A slug alone, a title, or an unverified origin is never enough.
   if(!originProof||(!shared.length&&p.kindIndex===2)){
     review.push({url:p.url,original:q.url,reason:'missing_identity_evidence'});continue;
   }
   candidates.push({source:p.id,target:q.id,type:'translation_assertion',proof:[p.url,q.url,'original_catalog_identity',r.contentSha256,'',shared.length?'origin_path_and_author':'origin_and_original_catalog_path',r.checkedAt]});
 }
 return {candidates,review};
}
module.exports={translationIdentities,native};
