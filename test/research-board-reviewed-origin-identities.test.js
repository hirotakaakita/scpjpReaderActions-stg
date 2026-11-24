'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizePage}=require('../research-board/extract');
const {reviewedSameSiteAlias,CASE}=require('../research-board/reviewed-origin-identities');
function fixture(sha=CASE.capturedSha,credit=CASE.publishedOriginal){
 const p={...normalizePage(CASE.source),siteBranch:'vn',branch:'es',pageType:'scp-series-es',kindIndex:0};
 const o={...normalizePage(CASE.publishedOriginal),siteBranch:'es',branch:'es',pageType:'scp-series-es',kindIndex:0};
 const v={...normalizePage(CASE.parallelVietnamese),siteBranch:'vn',branch:'es',pageType:'scp-series-es',kindIndex:0};
 const sources=new Map([[p.id,{record:{url:p.url,contentSha256:sha,originalSources:[{url:credit,method:'credit_original_label'}]},lastAttempt:{status:'success'}}]]);
 const args={source:p,target:o,left:[p],right:[o,v],byPage:new Map([[p.id,p],[o.id,o],[v.id,v]]),sources};
 return {args,p,o,v};
}
test('reviewed source allows exact second Vietnamese URL only when publisher original and capture agree',()=>{
 const f=fixture();
 assert.equal(reviewedSameSiteAlias(f.args),true);
});
test('reject a changed source capture instead of silently merging it',()=>{
 const f=fixture('b'.repeat(64));
 assert.throws(()=>reviewedSameSiteAlias(f.args),/Reviewed publisher source changed/);
});
test('reject alias if credited original is a different work',()=>{
 const f=fixture(CASE.capturedSha,'https://lafundacionscp.wikidot.com/scp-es-179');
 assert.equal(reviewedSameSiteAlias(f.args),false);
});
test('reject unrelated same-site source and a missing competing version',()=>{
 const f=fixture();
 assert.equal(reviewedSameSiteAlias({...f.args,left:[],source:f.o}),false);
 assert.equal(reviewedSameSiteAlias({...f.args,right:[f.o]}),false);
});
