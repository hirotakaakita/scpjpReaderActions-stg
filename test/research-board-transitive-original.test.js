'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildBoard}=require('../research-board/catalog');
const {makeRecord}=require('../research-board/extract');
const {verifiedTransitiveScpOriginal}=require('../research-board/explicit-scp-origin');
const {validateIdentityProofs}=require('../research-board/validate-identity-proofs');
const original='https://lafundacionscp.wikidot.com/scp-es-026',
  unrelated='https://lafundacionscp.wikidot.com/scp-es-179',
  english='https://scp-wiki.wikidot.com/scp-179',
  chinese='https://scp-zh-tr.wikidot.com/scp-179',
  chineseOriginal='https://scp-zh-tr.wikidot.com/scp-es-026',
  stamp='2026-11-22T00:00:00Z';
const row=(url,pageType,itemId)=>({urlJP:url,isTranslatedJP:true,pageType,
  itemId,contentType:'scp'});
const catalog=(language,data)=>({language,timestamp:stamp,totalCount:data.length,data});
function source(url,credit=[]){
 const r=makeRecord(url,'<title>Article</title><div id="page-content"><p>'+
  'SCP description and containment procedures. '.repeat(12)+'</p></div>','html',stamp);
 r.originalSources=credit.map(u=>({url:u,method:'credit_original_label',quote:'Original Article'}));
 return r;
}
const store=(rs)=>new Map(rs.map(r=>[r.pageId,{record:r,lastAttempt:{status:'success',at:stamp}}]));
function scenario({ambiguous=false,originalMissing=false,siteConflict=false}={}){
 const rows=[
  catalog('es',[row(original,'scp-series-es','scp-series-es-026'),
    row(unrelated,'scp-series-es','scp-series-es-179')]),
  catalog('en',[row(english,'scp-series-es','scp-series-es-179')]),
  catalog('zh-tr',[row(chinese,'scp-series','scp-series-179'),
    ...(siteConflict?[row(chineseOriginal,'scp-series-es','scp-series-es-026')]:[])])
 ];
 const enSource=source(english,originalMissing?[]:[original]);
 const zhCredit=ambiguous?[english,unrelated]:[english];
 const records=[source(original),source(unrelated),enSource,source(chinese,zhCredit),
   ...(siteConflict?[source(chineseOriginal)]:[])];
 return {rows,records,sources:store(records)};
}
const owner=(board,url)=>board.nodes.find(n=>n[13].some(v=>v[1]===url));
test('a ZH-TW SCP-179 explicitly credited to EN SCP-179 inherits the proven ES-026 original',()=>{
 const f=scenario(),b=buildBoard(f.rows,f.sources);
 assert.equal(owner(b,english)[14][0],owner(b,original)[14][0]);
 assert.equal(owner(b,chinese)[14][0],owner(b,original)[14][0]);
 assert.notEqual(owner(b,chinese)[14][0],owner(b,unrelated)[14][0]);
 assert(b.workIdentityProofs.some(p=>p.method==='explicit_transitive_scp_original_credit'&&
  p.source===chinese&&p.target===original));
 validateIdentityProofs(b,f.sources);
});
test('missing or ambiguous original credit does not authorize transitive equivalence',()=>{
 for(const config of [{ambiguous:true},{originalMissing:true}]){
  const f=scenario(config),b=buildBoard(f.rows,f.sources);
  assert.notEqual(owner(b,chinese)[14][0],owner(b,original)[14][0]);
  assert(!b.workIdentityProofs.some(p=>p.method==='explicit_transitive_scp_original_credit'&&
   p.source===chinese));
 }
});
test('a different same-site translation prevents an unsafe transitive merger',()=>{
 const f=scenario({siteConflict:true}),b=buildBoard(f.rows,f.sources);
 assert.notEqual(owner(b,chinese)[14][0],owner(b,original)[14][0]);
 assert.equal(owner(b,chineseOriginal)[14][0],owner(b,original)[14][0]);
 assert(b.identityReview.some(r=>r.url===chinese&&r.reason==='same_site_identity_collision'));
});
