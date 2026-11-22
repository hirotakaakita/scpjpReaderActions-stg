'use strict';
// Isolated preview only. NEVER call generateResearchBoard(), saveSources(),
// publish, git add/commit, or mutate local-data. All output goes under --out.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict');
const {buildBoard,loadCatalogs}=require('../research-board/catalog');
const {readSources}=require('../research-board/source-store');
const {importCatalogSources}=require('../research-board/catalog-sources');
const {validateIdentityProofs}=require('../research-board/validate-identity-proofs');
const {originalPage}=require('../origin-provenance');
const {normalizePage}=require('../research-board/extract');

const root=path.resolve(__dirname,'..');
function loadPublished(input) {
 const d=path.join(input,'mobile-v3/research-board');
 const manifest=JSON.parse(fs.readFileSync(path.join(d,'manifest.json')));
 return {board:JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(d,manifest.fileName)))),manifest};
}
function ownership(board){
 const owners=new Map(),versions=new Map(),nodes=new Map();
 for(const node of board.nodes){
  const work=node[14][0];
  if(nodes.has(work))throw Error('Duplicate work ID '+work);
  nodes.set(work,node);versions.set(work,node[13]);
  for(const v of node[13]){
   if(owners.has(v[1]))throw Error('Duplicate URL '+v[1]);
   owners.set(v[1],work);
  }
 }
 return {owners,versions,nodes};
}
function claimPointers(records){
 const pointers=new Map(),ambiguous=[];
 for(const state of records.values()){
  const record=state.record;if(!record?.url)continue;
  const raw=(record.originalSources||[]).filter(s=>s.method==='credit_original_label');
  const urls=[...new Set(raw.map(s=>originalPage(s.url)?.url).filter(Boolean))];
  if(urls.length>1)ambiguous.push({url:record.url,urls});
  if(raw.length&&urls.length===1&&raw.every(x=>originalPage(x.url))&&urls[0]!==record.url)
   pointers.set(record.url,urls[0]);
 }
 return {pointers,ambiguous};
}
function resolve(source,pointers,maxDepth=32){
 const path=[source],seen=new Set();
 for(let n=0;n<maxDepth;n++){
  if(seen.has(source))return {root:source,reason:'cycle',path};
  seen.add(source);
  const target=pointers.get(source);
  if(!target)return {root:source,reason:'terminal',path};
  source=target;path.push(source);
 }
 return {root:source,reason:'depth_limit',path};
}
function classify(pointer,source,graph,pointers){
 const r=resolve(source,pointers),owner=graph.owners.get(source),target=graph.owners.get(r.root);
 if(r.reason!=='terminal')return {category:r.reason,...r,owner,target};
 if(!target)return {category:'original_not_cataloged',...r,owner,target:null};
 if(owner===target)return {category:'same_work',...r,owner,target};
 const rootSite=new URL(r.root).hostname;
 const sameSiteConflicts=(graph.versions.get(owner)||[]).filter(v=>
  new URL(v[1]).hostname===rootSite && v[1]!==r.root).map(v=>v[1]);
 return {category:sameSiteConflicts.length?'conflicting_native_work':'split_work',
  ...r,owner,target,sameSiteConflicts};
}
function reviewCredits(before,after,records){
 const {pointers,ambiguous}=claimPointers(records),old=ownership(before),newer=ownership(after);
 const results=[],countsBefore={},countsAfter={};
 for(const [source,creditedOriginal] of pointers){
  if(!old.owners.has(source))continue;
  const a=classify(creditedOriginal,source,old,pointers);
  const b=classify(creditedOriginal,source,newer,pointers);
  countsBefore[a.category]=(countsBefore[a.category]||0)+1;
  countsAfter[b.category]=(countsAfter[b.category]||0)+1;
  if(a.category!=='same_work'||b.category!=='same_work')
   results.push({source,creditedOriginal,resolvedOriginal:a.root,path:a.path.join(' > '),
    before:a.category,after:b.category,oldWork:a.owner,newWork:b.owner,
    originalOldWork:a.target,originalNewWork:b.target,
    conflictingNativeBefore:(a.sameSiteConflicts||[]).join(' | '),
    conflictingNativeAfter:(b.sameSiteConflicts||[]).join(' | ')});
 }
 return {totalPointers:pointers.size,ambiguous,countsBefore,countsAfter,results};
}
function edges(board){
 const set=new Map();
 for(const e of board.edges) {
  const src=board.nodes[e[0]][14][0],dst=board.nodes[e[1]][14][0];
  const key=src+'\0'+board.overview.types[e[2]]+'\0'+dst;
  if(set.has(key))throw Error('Duplicate aggregated graph edge');
  set.set(key,{source:src,type:board.overview.types[e[2]],target:dst,
    proofUrls:[...new Set((e[4]||[]).map(i=>board.proofs[i]?.[0]).filter(Boolean))].slice(0,8)});
 }
 return set;
}
function csv(file,rows,fields){
 const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 fs.writeFileSync(file,[fields.map(q).join(','),...rows.map(x=>fields.map(f=>q(x[f])).join(','))].join('\n')+'\n');
}
function checkBoard(before,after,sources){
 const a=ownership(before),b=ownership(after);
 assert.equal(a.owners.size,b.owners.size,'No new/lost official catalog member URLs');
 for(const url of a.owners.keys())assert(b.owners.has(url),'Missing official catalog member '+url);
 for(const board of [after]){
  const aliases=new Set(),ids=new Set();
  for(const n of board.nodes){
   assert(n[14][2]?.length>=1,'Missing work identity alias');
   for(const key of n[14][2]){
    assert(!aliases.has(key),'Alias assigned to 2 works: '+key);aliases.add(key);
   }
   assert(!ids.has(n[14][0]),'Duplicate work');ids.add(n[14][0]);
  }
  const oldAliases=new Set(before.nodes.flatMap(n=>n[14][2]));
  const missing=[...oldAliases].filter(k=>!aliases.has(k));
  assert.equal(missing.length,0,'Lost catalog reading aliases: '+missing.slice(0,5).join(','));
  const owners=b.owners;
  for(const proof of board.workIdentityProofs||[])
   assert.equal(owners.get(proof.source),owners.get(proof.target),'Broken work identity proof '+proof.source);
  validateIdentityProofs(board,sources);
  for(const e of board.edges){
   if(board.overview.types[e[2]]!=='references')continue;
   const targetUrls=new Set(board.nodes[e[1]][13].map(v=>v[1]));
   for(const id of e[4]){
    const proof=board.proofs[id],source=normalizePage(proof[0]),r=sources.get(source?.id)?.record;
    assert(r&&r.contentSha256===proof[3],'Reference proof lost stored source hash');
    assert.equal(owners.get(proof[0]),board.nodes[e[0]][14][0],
      'Reference proof source has wrong work');
    assert((r.links||[]).some(link=>link.method==='body_hyperlink_v6'&&
      targetUrls.has(normalizePage(link.target)?.url)),'Unproven reference edge');
   }
  }
 }
 function owner(url,graph){return ownership(graph).owners.get(url);}
 const en='https://scp-wiki.wikidot.com/scp-179';
 const es26='https://lafundacionscp.wikidot.com/scp-es-026';
 const es179='https://lafundacionscp.wikidot.com/scp-es-179';
 assert.equal(owner(en,after),owner(es26,after),'EN SCP-179 must follow original ES-026');
 assert.notEqual(owner(en,after),owner(es179,after),'Native ES-179 must remain separate');
 assert.equal(owner(es26,after),'catalog:scp-series-es:scp-series-es-026','Keep ES-026 reading ID');
 assert.equal(owner(es179,after),'catalog:scp-series-es:scp-series-es-179','Keep ES-179 reading ID');
}
function run(output){
 const input=path.join(root,'local-data');
 const {board:before,manifest}=loadPublished(input);
 const catalogs=loadCatalogs(input);
 // Raw records are the frozen basis for prior 318-provenance candidate counts.
 const raw=readSources(path.join(input,'research-board-sources'));
 const sources=readSources(path.join(input,'research-board-sources'));
 importCatalogSources(sources,input,catalogs);
 const after=buildBoard(catalogs,sources);
 fs.mkdirSync(output,{recursive:true});
 const aa=ownership(before),bb=ownership(after);
 const moved=[...aa.owners].filter(([url,work])=>bb.owners.get(url)!==work)
   .map(([url,work])=>({url,previousWork:work,nextWork:bb.owners.get(url)}));
 const oldEdges=edges(before),newEdges=edges(after);
 const removed=[...oldEdges].filter(([k])=>!newEdges.has(k)).map(([,e])=>({direction:'removed',...e}));
 const added=[...newEdges].filter(([k])=>!oldEdges.has(k)).map(([,e])=>({direction:'added',...e}));
 const creditReview=reviewCredits(before,after,raw);
 const summary={revisionBefore:before.revision,revisionAfter:after.revision,
  originalManifest:manifest.sha256,pageCountBefore:aa.owners.size,pageCountAfter:bb.owners.size,
  nodesBefore:before.nodes.length,nodesAfter:after.nodes.length,
  edgesBefore:before.edges.length,edgesAfter:after.edges.length,
  movedPages:moved.length,removedEdges:removed.length,addedEdges:added.length,
  candidateCreditReview:{total:creditReview.totalPointers,
   countsBefore:creditReview.countsBefore,countsAfter:creditReview.countsAfter,
   flaggedBefore:creditReview.results.filter(x=>x.before==='split_work'||x.before==='conflicting_native_work').length,
   flaggedAfter:creditReview.results.filter(x=>x.after==='split_work'||x.after==='conflicting_native_work').length,
   ambiguousCredits:creditReview.ambiguous.length},
  focus:{
   en179:bb.owners.get('https://scp-wiki.wikidot.com/scp-179'),
   es026:bb.owners.get('https://lafundacionscp.wikidot.com/scp-es-026'),
   es179:bb.owners.get('https://lafundacionscp.wikidot.com/scp-es-179'),
   zh179:bb.owners.get('https://scp-zh-tr.wikidot.com/scp-179')
  }};
 const emitJson=(name,data)=>fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+'\n');
 const csvRows=(name,rows,fields)=>csv(path.join(output,name),rows,fields);
 emitJson('SUMMARY.json',summary);
 emitJson('original-credit-review.json',creditReview);
 csvRows('moved-page-owners.csv',moved,['url','previousWork','nextWork']);
 csvRows('rewired-edges.csv',[...removed,...added].map(x=>({...x,proofUrls:x.proofUrls.join(' | ')})),
  ['direction','source','type','target','proofUrls']);
 csvRows('original-credit-review.csv',creditReview.results,
  ['source','creditedOriginal','resolvedOriginal','before','after','oldWork','newWork',
   'originalOldWork','originalNewWork','path','conflictingNativeBefore','conflictingNativeAfter']);
 const md=['# Research board original identity fix — dry run','',
 'Original revision: '+before.revision,
 'Preview revision: '+after.revision,
 'Catalog member URLs: '+aa.owners.size+' -> '+bb.owners.size,
 'Work nodes: '+before.nodes.length+' -> '+after.nodes.length,
 'Directed edges: '+before.edges.length+' -> '+after.edges.length,
 'Pages reassigned to another work: '+moved.length,
 'Removed aggregated edges: '+removed.length,
 'Added aggregated edges: '+added.length,
 '', '## Recursive publisher original-credit audit',
 '| Category | Old | Preview |','| --- | ---: | ---: |',
 ...[...new Set([...Object.keys(creditReview.countsBefore),...Object.keys(creditReview.countsAfter)])].sort()
  .map(k=>'| '+k+' | '+(creditReview.countsBefore[k]||0)+' | '+(creditReview.countsAfter[k]||0)+' |'),
 '', '## SCP-179 work ownership', '',
 ...Object.entries(summary.focus).map(([k,v])=>'- '+k+': '+v),
 '', '## Safety', '',
 'All official catalog member URLs, previously published catalog aliases and reference proof hashes',
 'must be conserved. In-memory proof integrity validation and the SCP-179 owner test are run.',
 'No source shards or STG are rewritten; artifacts are preview-only.',
 'A credit discrepancy is a review candidate, not automatically a confirmed defect.',
 ''];
 fs.writeFileSync(path.join(output,'REVIEW.md'),md.join('\n'));
 try {
  checkBoard(before,after,sources);
  summary.validated=true;emitJson('SUMMARY.json',summary);
 } catch(e){
  summary.validated=false;summary.validationFailure=e.message;emitJson('SUMMARY.json',summary);
  throw e;
 }
 fs.writeFileSync(path.join(output,'preview-board.json.gz'),zlib.gzipSync(JSON.stringify(after),{level:6}));
 console.log(JSON.stringify(summary,null,2));
 return summary;
}
if(require.main===module)try{run(path.resolve(process.argv[2]||'research-board-origin-preview'));}
catch(e){console.error(e);process.exitCode=1;}
module.exports={loadPublished,ownership,claimPointers,resolve,classify,reviewCredits,edges,checkBoard,run};
