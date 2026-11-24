'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizePage}=require('../research-board/extract');
const {applyReviewedOriginIdentities,RULES}=require('../research-board/reviewed-origin-identities');
const src=RULES[0].source,original=RULES[0].original;
function fixture(sha=RULES[0].sha,credited=original){
 const p={...normalizePage(src),siteBranch:'vn',branch:'en',pageType:'scp-series',kindIndex:0},
  o={...normalizePage(original),siteBranch:'es',branch:'es',pageType:'scp-series-es',kindIndex:0};
 const sources=new Map([
  [p.id,{record:{url:src,contentSha256:sha,originalSources:[{url:credited,method:'credit_original_label'}]},lastAttempt:{status:'success'}}],
  [o.id,{record:{url:original,contentSha256:'a'.repeat(64),originalSources:[]},lastAttempt:{status:'success'}}]
 ]);
 return {p,o,sources};
}
test('reviewed Vietnamese SCP-179 inherits native Spanish ES-026 original identity',()=>{
 const f=fixture();
 const edits=applyReviewedOriginIdentities([f.p,f.o],f.sources,{strict:true});
 assert.equal(edits.length,1);
 assert.equal(f.p.branch,'es');assert.equal(f.p.pageType,'scp-series-es');
 assert.equal(f.o.branch,'es');
});
test('mismatched source capture hash cannot authorize identity correction',()=>{
 const f=fixture('b'.repeat(64));
 assert.throws(()=>applyReviewedOriginIdentities([f.p,f.o],f.sources),/Unsafe reviewed original/);
});
test('credit to another original cannot authorize identity correction',()=>{
 const f=fixture(RULES[0].sha,'https://lafundacionscp.wikidot.com/scp-es-179');
 assert.throws(()=>applyReviewedOriginIdentities([f.p,f.o],f.sources),/Unsafe reviewed original/);
});
test('unrelated page pairs are not modified',()=>{
 const n={...normalizePage('https://scp-vn.wikidot.com/scp-0001'),branch:'en'};
 assert.deepEqual(applyReviewedOriginIdentities([n],new Map()),[]);
 assert.equal(n.branch,'en');
});
