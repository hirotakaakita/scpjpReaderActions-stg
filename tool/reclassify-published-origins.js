'use strict';
// Reclassify existing delivered documents, preserving article IDs and membership.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {loadCatalogs,generateResearchBoard}=require('../research-board/catalog');
const {readState,originHint}=require('../catalog-indexes');
const {normalize,classify}=require('../related-documents');
const {resolveOrigin}=require('../catalog-origin');
const {generateMobileV3Catalogs}=require('../mobile-catalog');
function reclassify(root=path.join(__dirname,'..')){
 const input=path.join(root,'local-data'),before=loadCatalogs(input),records=new Map(),seeds=new Map();
 for(const f of fs.readdirSync(path.join(input,'catalog-indexes')).filter(f=>/^[a-z-]+\.json\.gz$/.test(f)))
  for(const [url,r]of Object.entries(readState(path.join(input,'catalog-indexes',f)).records))records.set(url,r);
 for(const c of before)for(const row of c.data){const p=normalize(row.isTranslatedJP!==false&&row.urlJP?row.urlJP:row.urlEN);if(!p)continue;
  if(!seeds.has(p.url))seeds.set(p.url,[]);seeds.get(p.url).push(row);}
 const file=path.join(input,'related-documents/catalog.json.gz'),catalog=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
 const changed=[];
 for(const row of catalog.data){if(row.pageType!=='related-document-unclassified')continue;
  const url=normalize(row.url)?.url;if(!url)continue;
  const result=resolveOrigin(records.get(url)||{tags:[]},row.indexEvidence||[],classify(url,records,seeds),originHint);
  if(!result.branch)continue;
  changed.push({url,itemId:row.itemId,branch:result.branch,basis:result.basis});
  row.pageType='related-document-'+result.branch;row.originBranch=result.branch;row.classification=result;
 }
 if(!changed.length)throw Error('No published origins changed');
 catalog.timestamp=new Date().toISOString();
 fs.writeFileSync(file+'.tmp',zlib.gzipSync(JSON.stringify(catalog),{level:9}));fs.renameSync(file+'.tmp',file);
 fs.writeFileSync(path.join(input,'related-documents/catalog.json'),JSON.stringify(catalog));
 generateMobileV3Catalogs(input);
 const after=loadCatalogs(input);
 const identities=c=>c.data.map(r=>r.itemId+'\0'+normalize(r.isTranslatedJP!==false&&r.urlJP?r.urlJP:r.urlEN)?.url).sort();
 for(const c of before){const next=after.find(a=>a.language===c.language);assert(next,'Lost delivery language');
  assert.deepEqual(identities(next),identities(c),'Changed article membership / IDs: '+c.language);}
 const manifest=generateResearchBoard(input,path.join(input,'mobile-v3'));
 const board=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(input,'mobile-v3/research-board',manifest.fileName))));
 const summary={changedPages:changed.length,unclassified:board.nodes.filter(n=>n[8]==='other').length,
   catalogPages:board.overview.sourcePageCount,manifest};
 fs.mkdirSync(path.join(root,'partial-data/origin-publication'),{recursive:true});
 fs.writeFileSync(path.join(root,'partial-data/origin-publication/report.json'),JSON.stringify({summary,changed},null,2));
 console.log(JSON.stringify(summary,null,2));return summary;
}
if(require.main===module)reclassify();
module.exports={reclassify};
