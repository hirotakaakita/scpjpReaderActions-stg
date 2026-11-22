'use strict';
// Exhaustively exercise the exact URL-first lookup API against the same catalog
// and dry-run graph used by the identity fix. Read-only, no Flutter writes.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {buildArticleWorkResolver}=require('../research-board/resolve-article-work');
const {loadCatalogs}=require('../research-board/catalog');
const {normalizePage}=require('../research-board/extract');
const {csvRead}=require('./review-research-board-origin-diff');
function run(dir,out){
 const board=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'preview-board.json.gz'))));
 const catalogs=loadCatalogs(path.resolve(__dirname,'../local-data'));
 const resolver=buildArticleWorkResolver(board,{catalogs});
 const expected=new Map(board.nodes.flatMap(n=>n[13].map(p=>[p[1],n[14][0]])));
 const allIds=new Map();
 let pageCount=0,matches=0;
 const errors=[];
 for(const c of catalogs)for(const row of c.data){
  const url=normalizePage(row.isTranslatedJP!==false&&row.urlJP?row.urlJP:row.urlEN)?.url;
  if(!url||!expected.has(url))continue;
  pageCount++;
  const found=resolver.resolve({articleUrl:url,itemId:row.itemId});
  if(found.status==='matched_source_url'&&found.workId===expected.get(url))matches++;
  else errors.push({language:c.language,url,itemId:row.itemId,expected:expected.get(url),
    found:found.workId,reason:found.status});
  if(row.itemId){
   if(!allIds.has(row.itemId))allIds.set(row.itemId,new Set());
   allIds.get(row.itemId).add(expected.get(url));
  }
 }
 assert.equal(matches,pageCount,'Mismatch in URL-first source resolution');
 let ambiguous=0,unique=0;
 for(const [id,works] of allIds){
  const result=resolver.resolve({itemId:id});
  if(works.size>1){
   ambiguous++;
   assert.equal(result.status,'ambiguous_item_id','Unsafe raw-id match '+id);
   assert.equal(result.workId,null);
  }else{
   unique++;
   assert.equal(result.workId,[...works][0],'Raw ID should be unambiguous '+id);
  }
 }
 const moved=csvRead(fs.readFileSync(path.join(dir,'moved-page-owners.csv'),'utf8'));
 for(const change of moved)assert.equal(resolver.resolve({articleUrl:change.url}).workId,change.nextWork);
 const report={revision:board.revision,catalogRowsChecked:pageCount,
  exactUrlMatches:matches,urlErrors:errors.length,
  sourceUrlCount:resolver.sourceUrlCount,
  ambiguousItemIdsFailClosed:ambiguous,uniqueItemIdsResolved:unique,
  changedPagesWithCorrectUrlLookup:moved.length};
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'FULL_RESOLVER_AUDIT.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(out,'FULL_RESOLVER_AUDIT.md'),[
  '# URL-scoped Board work identity resolver full-catalog acceptance','',
  '| Metric | Value |','| --- | ---: |',
  ...Object.entries(report).map(([k,v])=>'| '+k+' | '+v+' |'),
  '','No raw-itemId-only ambiguity silently resolves to the wrong work.',
  'All changed pages resolve by normalized source URL to their corrected work.',
  'No mobile catalog itemIds, bookmark states, or shipped boards are modified.',
 ].join('\n')+'\n');
 console.log(JSON.stringify(report,null,2));return report;
}
if(require.main===module)try{run(path.resolve(process.argv[2]),path.resolve(process.argv[3]));}
catch(e){console.error(e);process.exitCode=1;}
module.exports={run};
