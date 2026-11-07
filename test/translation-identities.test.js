'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildBoard}=require('../research-board/catalog');
const {normalizePage}=require('../research-board/extract');
const stamp='2026-11-08T00:00:00Z';
const hosts={jp:'scp-jp.wikidot.com',cn:'scp-wiki-cn.wikidot.com',es:'lafundacionscp.wikidot.com',int:'scp-int.wikidot.com'};
function fixture(site,slug='aeliana',origin='jp',extra={}){
 const url=`https://${hosts[site]}/${slug}`,p=normalizePage(url);
 const row={itemId:`document-${site}--${slug}`,pageType:`related-document-${origin}`,contentType:'goi',urlJP:url,isTranslatedJP:true,titleJP:site+':'+slug,...extra};
 return {row,catalog:{language:site,timestamp:stamp,data:[row]},id:p.id,state:{record:{url,pageId:p.id,title:row.titleJP,tags:[origin],authors:site==='es'?[]:[{url:'https://www.wikidot.com/user:info/amamiel'}],catalogIdentity:{originBranch:origin,basis:'publisher_origin_tag'},limitations:['legacy_unchecked_links'],contentSha256:'a'.repeat(64),checkedAt:stamp},lastAttempt:{status:'success',at:stamp}}};
}
const board=items=>buildBoard(items.map(x=>x.catalog),new Map(items.map(x=>[x.id,x.state])));
test('AELIANA original and three translations form one JP work with all old identities',()=>{
 const b=board(['jp','cn','es','int'].map(s=>fixture(s)));assert.equal(b.nodes.length,1);
 const n=b.nodes[0];assert.equal(n[8],'jp');assert.equal(n[11],'jp');assert.equal(n[13].length,4);assert.equal(n[14][2].length,4);
 assert.equal(n[14][0],'catalog:related-document-jp:document-jp--aeliana');assert.equal(b.edges.length,0);assert.equal(b.workIdentityProofs.length,3);
});
test('same slug without confirmed origin, incompatible author or original branch is not merged',()=>{
 for(const mode of ['unknown','author','branch','kind']){
   const jp=fixture('jp'),cn=fixture('cn');
   if(mode==='unknown')delete cn.state.record.catalogIdentity;
   if(mode==='author')cn.state.record.authors=[{url:'https://www.wikidot.com/user:info/another-author'}];
   if(mode==='branch')cn.row.pageType='related-document-cn';
   if(mode==='kind')cn.row.contentType='record';
   assert.equal(board([jp,cn]).nodes.length,2,mode);
 }
});
test('generic hubs, different proposal paths and translation-only catalogs remain separate',()=>{
 assert.equal(board([fixture('jp','groups-of-interest'),fixture('cn','groups-of-interest')]).nodes.length,2);
 assert.equal(board([fixture('jp','scp-001-proposal-a'),fixture('cn','scp-001-proposal-b')]).nodes.length,2);
 assert.equal(board([fixture('cn'),fixture('es')]).nodes.length,2);
});
test('explicit original credit handles changed translation URLs but never creates uncataloged nodes',()=>{
 const jp=fixture('jp'),cn=fixture('cn','translated-name');cn.state.record.originalSources=[{url:jp.row.urlJP,method:'credit_original_label',quote:'原文:'}];
 assert.equal(board([jp,cn]).nodes.length,1);assert.equal(board([cn]).nodes.length,1);
});
test('conflicting original credits cannot join two originals transitively',()=>{
 const a=fixture('jp','a'),b=fixture('jp','b'),cn=fixture('cn','translation');cn.state.record.originalSources=[a,b].map(x=>({url:x.row.urlJP,method:'credit_original_label'}));
 assert.equal(board([a,b,cn]).nodes.length,3);
});
test('temporary fetch errors retain established identity while semantic relations remain excluded',()=>{
 const jp=fixture('jp'),cn=fixture('cn');cn.state.lastAttempt={status:'failed',at:stamp};assert.equal(board([jp,cn]).nodes.length,1);
});
test('an explicit original wins over a same-path native page, including an uncollected original',()=>{
 const original=fixture('jp'),samePath=fixture('jp','translated-name'),cn=fixture('cn','translated-name');
 cn.state.record.originalSources=[{url:original.row.urlJP,method:'credit_original_label'}];
 const b=board([original,samePath,cn]);assert.equal(b.nodes.length,2);assert.equal(b.nodes.find(n=>n[13].some(p=>p[0]==='cn'))[4],'aeliana');
 assert.equal(board([samePath,cn]).nodes.length,2);
});
test('multiple original sources cannot turn a compilation into one constituent work',()=>{
 const jp=fixture('jp'),cn=fixture('cn');cn.state.record.originalSources=[jp.row.urlJP,'https://scp-jp.wikidot.com/not-collected'].map(url=>({url,method:'credit_original_label'}));
 assert.equal(board([jp,cn]).nodes.length,2);
});
test('traditional Chinese native page is the representative rather than its CN translation',()=>{
 hosts['zh-tr']='scp-zh-tr.wikidot.com';
 const original=fixture('zh-tr','example','zh'),cn=fixture('cn','example','zh');
 const b=board([original,cn]);assert.equal(b.nodes.length,1);assert.equal(b.nodes[0][11],'zh-tr');
});
