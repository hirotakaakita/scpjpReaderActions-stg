'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildBoard}=require('../research-board/catalog');
const {makeRecord,normalizePage}=require('../research-board/extract');
const {verifiedScpOriginal}=require('../research-board/explicit-scp-origin');
const en='https://scp-wiki.wikidot.com/',es='https://lafundacionscp.wikidot.com/';
const cn='https://scp-wiki-cn.wikidot.com/',jp='https://scp-jp.wikidot.com/';
const stamp='2026-11-22T00:00:00Z';
const page=(base,slug)=>base+slug;
const row=(url,kind,id)=>({urlJP:url,isTranslatedJP:true,itemId:id,
  pageType:kind,contentType:'scp',numericItemId:parseInt((/\d+/.exec(id)||['0'])[0],10)});
const catalog=(language,entries)=>({language,timestamp:stamp,data:entries,totalCount:entries.length});
const html=body=>'<title>Article</title><div id="page-content">'+
  '<p>'+('Detailed SCP description. '.repeat(12))+'</p>'+body+'</div>';
function record(url,body='',originals=[]) {
 const r=makeRecord(url,html(body),'html',stamp);
 r.originalSources=originals.map(target=>({url:target,method:'credit_original_label',quote:'Original Article'}));
 return r;
}
function index(...records) {
 return new Map(records.map(r=>[r.pageId,{record:r,lastAttempt:{status:'success',at:stamp}}]));
}
const find=(board,url)=>board.nodes.find(n=>n[13].some(v=>v[1]===url));
function esCase(){
 const original=page(es,'scp-es-026'),other=page(es,'scp-es-179'),
   translated=page(en,'scp-179'),zh=page('https://scp-zh-tr.wikidot.com/','scp-179');
 const catalogs=[
  catalog('es',[row(original,'scp-series-es','scp-series-es-026'),
    row(other,'scp-series-es','scp-series-es-179')]),
  // A historical catalog that reused the local ES-179 ID for its translated EN article.
  catalog('en',[row(translated,'scp-series-es','scp-series-es-179')]),
  catalog('zh-tr',[row(zh,'scp-series','scp-series-179')])
 ];
 const src=index(record(original),record(other,'<a href="'+translated+'">ref</a>'),
   record(translated,'<a href="'+other+'">the other article</a>',[original]),record(zh));
 return {original,other,translated,zh,catalogs,src};
}
test('the EN SCP-179 with verified original ES-026 never merges into native ES-179',()=>{
 const f=esCase(),board=buildBoard(f.catalogs,f.src);
 const translated=find(board,f.translated),orig=find(board,f.original),other=find(board,f.other);
 assert(translated&&orig&&other);
 assert.equal(translated[14][0],orig[14][0],'translated EN page belongs to ES-026 work');
 assert.notEqual(translated[14][0],other[14][0],'native ES-179 is independent');
 assert.equal(other[14][0],'catalog:scp-series-es:scp-series-es-179','native keeps original legacy ID');
 assert.equal(orig[14][0],'catalog:scp-series-es:scp-series-es-026','credited original keeps native ID');
 assert(board.workIdentityProofs.some(p=>p.method==='explicit_scp_original_credit'&&
    p.source===f.translated&&p.target===f.original));
 const types=board.overview.types;
 assert(board.edges.some(e=>types[e[2]]==='references'&&
    board.nodes[e[0]][14][0]===other[14][0]&&
    board.nodes[e[1]][14][0]===orig[14][0]),'references now correctly connect two different works');
 assert(!board.nodes.some(n=>n[13].length!==new Set(n[13].map(v=>v[1])).size));
});
test('EN SCP-179 has an exact cataloged native original, not an inferred numeric match',()=>{
 const f=esCase();
 const pages=new Map([
  [normalizePage(f.translated).id,{...normalizePage(f.translated),siteBranch:'en',branch:'es',pageType:'scp-series-es',kindIndex:0}],
  [normalizePage(f.original).id,{...normalizePage(f.original),siteBranch:'es',branch:'es',pageType:'scp-series-es',kindIndex:0}],
  [normalizePage(f.other).id,{...normalizePage(f.other),siteBranch:'es',branch:'es',pageType:'scp-series-es',kindIndex:0}]
 ]);
 assert.equal(verifiedScpOriginal(pages.get(normalizePage(f.translated).id),pages,f.src)?.url,f.original);
 const missing=index(record(f.translated,'',[page(es,'scp-es-999')]));
 assert.equal(verifiedScpOriginal(pages.get(normalizePage(f.translated).id),pages,missing),null);
});
test('a different credited number is general: ES-004 from EN-2104, CN-2469 from EN-6470',()=>{
 for(const scenario of [
   {lang:'es',host:es,foreign:'scp-es-004',nativeOther:'scp-es-2104',delivery:'scp-2104',type:'scp-series-es'},
   {lang:'cn',host:cn,foreign:'scp-cn-2469',nativeOther:'scp-cn-6470',delivery:'scp-6470',type:'scp-series-cn'}
 ]) {
  const original=page(scenario.host,scenario.foreign),other=page(scenario.host,scenario.nativeOther),
    translated=page(en,scenario.delivery);
  const board=buildBoard([
    catalog(scenario.lang,[row(original,scenario.type,scenario.type+'-'+scenario.foreign.split('-').at(-1)),
      row(other,scenario.type,scenario.type+'-'+scenario.nativeOther.split('-').at(-1))]),
    catalog('en',[row(translated,scenario.type,scenario.type+'-'+scenario.nativeOther.split('-').at(-1))])
  ],index(record(original),record(other),record(translated,'',[original])));
  assert.equal(find(board,translated)?.[14][0],find(board,original)?.[14][0],
    scenario.delivery+' must follow original '+scenario.foreign);
  assert.notEqual(find(board,other)?.[14][0],find(board,original)?.[14][0]);
 }
});
test('ordinary same-number translated SCPs remain grouped without new exceptions',()=>{
 const original=page(en,'scp-005'),translated=page(jp,'scp-005');
 const board=buildBoard([
  catalog('en',[row(original,'scp-series','scp-series-005')]),
  catalog('jp',[row(translated,'scp-series','scp-series-005')])
 ],index(record(original),record(translated)));
 assert.equal(find(board,original)[14][0],find(board,translated)[14][0]);
});
test('missing target, cross-branch credit and non-native target are not auto trusted',()=>{
 const f=esCase();
 const src=index(record(f.translated,'',[f.original]));
 const pageEN={...normalizePage(f.translated),branch:'es',pageType:'scp-series-es',siteBranch:'en',kindIndex:0};
 const native={...normalizePage(f.original),branch:'es',pageType:'scp-series-es',siteBranch:'es',kindIndex:0};
 const bad={...native,siteBranch:'cn'};
 const map=new Map([[native.id,bad],[pageEN.id,pageEN]]);
 assert.equal(verifiedScpOriginal(pageEN,map,src),null);
 native.pageType='scp-series';map.set(native.id,native);
 assert.equal(verifiedScpOriginal(pageEN,map,src),null);
});
