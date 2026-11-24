'use strict';
// Narrow exception to the same-site identity collision guard. Vietnamese
// SCP-179 and Vietnamese SCP-ES-026 are two publisher URLs for the Spanish
// SCP-ES-026 translation; do not allow generic same-site work merging.
const {normalizePage}=require('./extract');
const {originalPath}=require('./explicit-scp-origin');
const CASE=Object.freeze({
 source:'https://scp-vn.wikidot.com/scp-179',
 publishedOriginal:'https://lafundacionscp.wikidot.com/scp-es-026',
 parallelVietnamese:'https://scp-vn.wikidot.com/scp-es-026',
 capturedSha:'b8fbe118112edd1341289a9134fa1f8b7951efafb22351d889c3a2467efd8b5b'
});
function reviewedSameSiteAlias({source,target,left,right,byPage,sources}){
 if(source?.url!==CASE.source||target?.url!==CASE.publishedOriginal)return false;
 const record=sources?.get(source.id)?.record;
 if(record?.contentSha256!==CASE.capturedSha)throw Error('Reviewed publisher source changed: '+CASE.source);
 const versions=[...left,...right];
 const vn=versions.filter(p=>p.siteBranch==='vn').map(p=>p.url).sort();
 if(vn.length!==2||vn[0]!==[CASE.source,CASE.parallelVietnamese].sort()[0]||
    vn[1]!==[CASE.source,CASE.parallelVietnamese].sort()[1])return false;
 const published=byPage.get(normalizePage(CASE.publishedOriginal).id);
 const duplicate=byPage.get(normalizePage(CASE.parallelVietnamese).id);
 if(!published||!duplicate||!versions.some(p=>p.id===published.id)||
   !versions.some(p=>p.id===duplicate.id)||
   duplicate.branch!=='es'||duplicate.pageType!=='scp-series-es'||
   source.branch!=='es'||source.pageType!=='scp-series-es'||
   target.branch!=='es'||target.pageType!=='scp-series-es')return false;
 const chain=originalPath(source,byPage,sources);
 if(chain?.original?.id!==published.id)return false;
 return true;
}
module.exports={CASE,reviewedSameSiteAlias};
