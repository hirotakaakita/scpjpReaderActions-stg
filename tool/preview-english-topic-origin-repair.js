'use strict';
// Read-only two-scenario preview of the EN subject tag misclassification.
// Does not write catalog snapshots, source shards, or the published board.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {loadBoard}=require('../research-board/verification/audit');
const {loadCatalogs,buildBoard}=require('../research-board/catalog');
const {readSources}=require('../research-board/source-store');
const {normalizePage}=require('../research-board/extract');
const {validateBoard}=require('../research-board/validate');
const {publisherOriginTags}=require('../catalog-origin');
const input=path.resolve(__dirname,'../local-data');
function workMap(board){
 const result=new Map();
 for(const n of board.nodes)for(const v of n[13])result.set(v[1],n[14][0]);
 return result;
}
function edgeKeys(board){
 const keys=new Map();
 for(const e of board.edges){
  const k=board.nodes[e[0]][14][0]+' '+board.overview.types[e[2]]+' '+board.nodes[e[1]][14][0];
  keys.set(k,(keys.get(k)||0)+1);
 }
 return keys;
}
function run(out) {
 const {board:published,manifest}=loadBoard();
 const stored=readSources(path.join(input,'research-board-sources'));
 const catalogs=loadCatalogs(input);
 const oldMap=workMap(published);
 const affected=[];
 for(const [url,workId]of oldMap){
  if(!/^https:\/\/scp-wiki\.wikidot\.com\/scp-\d{3,5}$/.test(url)||!workId.startsWith('catalog:scp-series-pig:'))continue;
  const page=normalizePage(url),record=stored.get(page.id)?.record,tags=(record?.tags||[]).map(s=>s.toLowerCase());
  if(!tags.includes('pig')||tags.includes('_pig')||publisherOriginTags(url,record).origins.includes('pig'))continue;
  const rows=catalogs.flatMap(c=>c.data.filter(r=>
    normalizePage(r.isTranslatedJP!==false&&r.urlJP?r.urlJP:r.urlEN)?.url===url)
    .map(r=>({catalogLanguage:c.language,language:r.language,itemId:r.itemId,pageType:r.pageType})));
  affected.push({url,oldWork:workId,title:record?.title,tagEvidence:tags.join(' | '),
    sourceSha:record?.contentSha256,catalogRows:rows});
 }
 const save=(name,obj)=>fs.writeFileSync(path.join(out,name),JSON.stringify(obj,null,2)+'\n');
 fs.mkdirSync(out,{recursive:true});
 save('AFFECTED_23_CATALOG_ROWS.json',affected);
 if(affected.length!==23)console.warn('expected prior 23, found '+affected.length);
 const runScenario=(label,cat)=>{
  const result={scenario:label,oldRevision:published.revision};
  try{
   const after=buildBoard(cat,stored),a=workMap(after),b=edgeKeys(published),d=edgeKeys(after);
   result.newRevision=after.revision;
   result.oldNodes=published.nodes.length;result.newNodes=after.nodes.length;
   result.oldEdges=published.edges.length;result.newEdges=after.edges.length;
   result.oldPageCount=oldMap.size;result.newPageCount=a.size;
   result.lostPages=[...oldMap.keys()].filter(url=>!a.has(url)).slice(0,100);
   result.moved=[...oldMap].filter(([url,work])=>a.get(url)!==work)
     .map(([url,oldWork])=>({url,oldWork,newWork:a.get(url)||null}));
   result.removedEdges=[...b.keys()].filter(x=>!d.has(x));
   result.addedEdges=[...d.keys()].filter(x=>!b.has(x));
   result.pigStillIncorrect=affected.filter(r=>a.get(r.url)?.startsWith('catalog:scp-series-pig:')).map(r=>r.url);
   const oldAliases=new Set(published.nodes.flatMap(n=>n[14][2]));
   const newAliases=new Set(after.nodes.flatMap(n=>n[14][2]));
   result.lostAliases=[...oldAliases].filter(key=>!newAliases.has(key));
   try{result.validated=validateBoard(after,cat,stored,{rebuild:false}).verified;}
   catch(e){result.validated=false;result.validationFailure=String(e.message||e);}
  }catch(e){result.buildFailure=String(e.stack||e);}
  save(label+'.json',result);
  console.log(JSON.stringify({scenario:label,revision:result.newRevision,
    pages:result.newPageCount,movedPages:result.moved?.length,oldNodes:result.oldNodes,newNodes:result.newNodes,
    oldEdges:result.oldEdges,newEdges:result.newEdges,
    lostAliases:result.lostAliases?.length,pigStillIncorrect:result.pigStillIncorrect?.length,
    validated:result.validated,validationFailure:result.validationFailure,buildFailure:result.buildFailure}));
  return result;
 };
 const codeOnly=runScenario('code-only',catalogs);
 const revised=structuredClone(catalogs);
 const affectedUrls=new Set(affected.map(r=>r.url));
 const catalogEdits=[];
 for(const c of revised)for(const row of c.data){
  const url=normalizePage(row.isTranslatedJP!==false&&row.urlJP?row.urlJP:row.urlEN)?.url;
  if(!affectedUrls.has(url)||row.pageType!=='scp-series-pig')continue;
  catalogEdits.push({language:c.language,url,itemId:row.itemId,from:row.pageType,to:'scp-series'});
  row.pageType='scp-series';
 }
 save('CATALOG_DRYRUN_EDITS.json',catalogEdits);
 const combined=runScenario('code-plus-catalog-dryrun',revised);
 save('SUMMARY.json',{boardRevision:published.revision,manifestHash:manifest.sha256,
   affectedENOriginals:affected.length,dryRunCatalogRowsChanged:catalogEdits.length,
   codeOnly:{moved:codeOnly.moved?.length,stillPig:codeOnly.pigStillIncorrect?.length,
     validated:codeOnly.validated,error:codeOnly.validationFailure||codeOnly.buildFailure||null},
   codePlusCatalog:{moved:combined.moved?.length,stillPig:combined.pigStillIncorrect?.length,
     validated:combined.validated,lostAliases:combined.lostAliases?.length||0,
     error:combined.validationFailure||combined.buildFailure||null}});
}
if(require.main===module)try{run(path.resolve(process.argv[2]||'origin-pig-preview'));}
catch(e){console.error(e);process.exitCode=1;}
module.exports={run};
