'use strict';
const {normalizePage}=require('./extract');
const site=code=>code==='zh-tr'?'zh':code;
const native=p=>site(p.siteBranch)===p.branch||(p.siteBranch==='cs'&&p.branch==='sk');
const generic=/^(?:main|index|home|start|about|groups-of-interest|foundation-tales|canon-hub|series-archive|personnel-and-character-dossier|task-forces|secure-facilities-locations|goi-formats)(?:-[a-z]{2})?$/;
const authorIds=r=>new Set((r?.authors||[]).map(a=>/wikidot\.com\/user:info\/([^/?#]+)/i.exec(a.url||'')?.[1]?.toLowerCase()).filter(Boolean));
const originEvidence=(p,r)=>r?.catalogIdentity?.originBranch===p.branch&&
 ['publisher_origin_tag','official_index_section','publisher_default_origin','native_official_collection','explicit_original_credit','explicit_translation_metadata','catalog_page_type'].includes(r.catalogIdentity.basis);
function scpIdentityKey(p){
 const m=/^scp-(?:([a-z]{2,5})-)?(\d+)(.*)$/.exec(p.slug);
 let identifier=p.slug;
 if(m&&(!m[1]||m[1]===p.branch)){
   let suffix=m[3];
   if(suffix===`-${p.branch}`||suffix.startsWith(`-${p.branch}-`))suffix=suffix.slice(p.branch.length+1);
   identifier='scp-'+m[2]+suffix;
 }
 return p.branch+'\0'+p.pageType+'\0'+identifier;
}
function translationIdentities(pages,sources){
 const byId=new Map(pages.map(p=>[p.id,p])), originals=new Map(), versions=new Map(),candidates=[],review=[];
 for(const p of pages){const key=p.branch+'\0'+p.slug;if(!versions.has(key))versions.set(key,[]);versions.get(key).push(p);}
 const scpGroups=new Map();
 for(const p of pages)if([0,8,9].includes(p.kindIndex)&&p.branch!=='other'&&/^(?:scp-series(?:-[a-z-]+)?|joke-scps(?:-[a-z-]+)?|scp-(?:[a-z-]+-)?ex)$/.test(p.pageType||'')){
   // Full identifier, including proposal/variant suffixes, never number alone.
   const key=scpIdentityKey(p);
   if(!scpGroups.has(key))scpGroups.set(key,[]);scpGroups.get(key).push(p);
 }
 for(const group of scpGroups.values())if(group.length>1){
   group.sort((a,b)=>Number(native(b))-Number(native(a))||a.url.localeCompare(b.url));
   for(const p of group.slice(1))candidates.push({source:p.id,target:group[0].id,type:'translation_assertion',proof:[p.url,group[0].url,'full_scp_identifier','','','catalog_scp_identifier','']});
 }
 for(const p of pages)if(p.pageType&&p.branch!=='other'&&native(p)){
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
   if(!p.pageType||p.branch==='other'||native(p))continue;
   const possible=originals.get(p.branch+'\0'+p.slug)||[];
   if(!possible.length){
     // A missing native catalog page does not prevent two proven translated
     // versions from sharing one existing node. Require independent provenance
     // and a shared credited author, not just matching slugs.
     if(!p.pageType.startsWith('related-document-')||generic.test(p.slug)||!originEvidence(p,r))continue;
     const a=authorIds(r);
     const matches=(versions.get(p.branch+'\0'+p.slug)||[]).filter(q=>q.id!==p.id&&q.pageType?.startsWith('related-document-')&&q.siteBranch!==p.siteBranch)
       .filter(q=>{const state=sources.get(q.id),qr=state?.record;return qr&&!['not_found','not_article','unavailable'].includes(state.lastAttempt?.status)&&!qr.originalSources?.length&&originEvidence(q,qr)&&[...authorIds(qr)].some(id=>a.has(id));});
     for(const q of matches)if(p.id<q.id)candidates.push({source:p.id,target:q.id,type:'translation_assertion',proof:[p.url,q.url,'translated_catalog_identity',r.contentSha256,'','translation_path_shared_author',r.checkedAt]});
     continue;
   }
   if(possible.length!==1){review.push({url:p.url,reason:'ambiguous_original'});continue;}
   const q=possible[0],qr=sources.get(q.id)?.record,meta=r.catalogIdentity;
   if(generic.test(p.slug)){review.push({url:p.url,original:q.url,reason:'generic_original_path'});continue;}
   const a=authorIds(r),b=authorIds(qr),shared=[...a].filter(id=>b.has(id));
   if(a.size&&b.size&&!shared.length){review.push({url:p.url,original:q.url,reason:'author_conflict'});continue;}
   const numberedPath=/^scp-(?:[a-z]{2,5}-)?\d+(?:-[\p{L}\p{N}_-]+)?$/u.test(p.slug);
   const originProof=originEvidence(p,r)||(numberedPath&&meta?.originBranch===p.branch&&meta.basis==='scp_identifier');
   const explicitOrigin=originProof&&meta.basis==='publisher_origin_tag';
   // A category is presentation metadata, not work identity. Explicit origin
   // and an exact original path still identify a work when local tags differ.
   // A slug alone, a title, or an unverified origin is never enough.
   if(!(originProof||numberedPath)||(!shared.length&&p.kindIndex===2&&!explicitOrigin&&!numberedPath)){
     review.push({url:p.url,original:q.url,reason:'missing_identity_evidence'});continue;
   }
   candidates.push({source:p.id,target:q.id,type:'translation_assertion',proof:[p.url,q.url,'original_catalog_identity',r.contentSha256,'',shared.length?'origin_path_and_author':numberedPath?'full_numbered_original_catalog_path':'origin_and_original_catalog_path',r.checkedAt]});
 }
 return {candidates,review};
}
module.exports={translationIdentities,native,scpIdentityKey};
