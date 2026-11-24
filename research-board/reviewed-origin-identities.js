'use strict';
// First-release evidence-based translation identity corrections. Only sources
// whose current capture exactly matches a reviewed publisher article are
// eligible. Do not generalize to same-number articles or retired redirects.
const {normalizePage}=require('./extract');
const {originalPage}=require('../origin-provenance');
const RULES=Object.freeze([
 {source:'https://scp-vn.wikidot.com/scp-179',
  original:'https://lafundacionscp.wikidot.com/scp-es-026',
  sha:'b8fbe118112edd1341289a9134fa1f8b7951efafb22351d889c3a2467efd8b5b',
  basis:'reviewed_es026_vietnamese_scp179_translation'}
]);
function applyReviewedOriginIdentities(pages,sources,{strict=false}={}){
 const byUrl=new Map(pages.map(p=>[p.url,p])),changes=[];
 for(const rule of RULES){
  const page=byUrl.get(rule.source),original=byUrl.get(rule.original);
  if(!page&&!original)continue; // Lightweight unit fixtures without reviewed articles.
  if(!page||!original){if(strict)throw Error('Missing reviewed source or native original '+rule.source);continue;}
  const state=sources?.get(page.id),record=state?.record;
  const targetRecord=sources?.get(original.id)?.record;
  const credits=(record?.originalSources||[]).filter(c=>c.method==='credit_original_label');
  const targets=[...new Set(credits.map(c=>originalPage(c.url)?.url).filter(Boolean))];
  if(!record||record.contentSha256!==rule.sha||!targetRecord||
    credits.length<1||targets.length!==1||targets[0]!==rule.original||
    credits.some(c=>!originalPage(c.url))||
    original.siteBranch!=='es'||original.branch!=='es'||
    original.pageType!=='scp-series-es'||original.kindIndex!==0||
    page.kindIndex!==0||page.siteBranch!=='vn'||
    state?.lastAttempt?.status==='not_found'||
    state?.lastAttempt?.status==='unavailable') {
    throw Error('Unsafe reviewed original correction (publisher evidence changed): '+rule.source);
  }
  page.branch=original.branch;
  page.pageType=original.pageType;
  page.classificationBasis=rule.basis;
  changes.push({source:rule.source,original:rule.original,basis:rule.basis});
 }
 return changes;
}
module.exports={RULES,applyReviewedOriginIdentities};
