'use strict';
// Only a unique publisher-explicit original article credit, pointing to a
// known catalog page natively hosted by its origin branch, can override a
// numbered SCP identity. Never use bare matching numbers or ordinary links.
const {normalizePage}=require('./extract');
const {originalPage}=require('../origin-provenance');

function nativeBranch(page) {
  return (page.siteBranch==='zh-tr'?'zh':page.siteBranch)===page.branch||
    (page.siteBranch==='cs'&&page.branch==='sk');
}
function verifiedScpOriginal(page, pagesById, sources) {
  if(!page||![0,8,9].includes(page.kindIndex)||!page.pageType||!page.id)return null;
  const state=sources?.get(page.id),record=state?.record;
  if(!record || ['unavailable','not_found','not_article'].includes(state?.lastAttempt?.status))return null;
  const claims=(record.originalSources||[]).filter(x=>x.method==='credit_original_label');
  const urls=[...new Set(claims.map(x=>originalPage(x.url)?.url).filter(Boolean))];
  // Ambiguous original credits must never turn into work-equivalence proofs.
  if(!claims.length||urls.length!==1||claims.some(x=>!originalPage(x.url)))return null;
  const target=normalizePage(urls[0]),original=target&&pagesById.get(target.id);
  if(!original||original.id===page.id || !nativeBranch(original) ||
     original.siteBranch===page.siteBranch ||
     original.branch!==page.branch || original.pageType!==page.pageType ||
     original.kindIndex!==page.kindIndex) return null;
  return original;
}
module.exports={nativeBranch,verifiedScpOriginal};
