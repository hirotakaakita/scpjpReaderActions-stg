'use strict';
// Refresh only already-published unknown-origin article URLs. Never follow links.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {readState,writeState}=require('../catalog-indexes');
const {fetchRecord}=require('../related-documents');
const {VERSION}=require('../origin-provenance');
async function refresh({root=path.join(__dirname,'..'),maxRequests=300,maxDurationMs=240000,intervalMs=500,request=fetchRecord,languages=null}={}){
  if(!Number.isInteger(maxRequests)||maxRequests<0||maxRequests>2000||maxDurationMs<=0||intervalMs<0)throw Error('Invalid refresh limits');
  const catalog=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'local-data/related-documents/catalog.json.gz'))));
  const files=new Map(),states=new Map();
  const rows=catalog.data.filter(r=>r.pageType==='related-document-unclassified'&&(!languages||languages.includes(r.language)));
  for(const language of new Set(rows.map(r=>r.language))){
    const file=path.join(root,'local-data/catalog-indexes',language+'.json.gz');
    if(fs.existsSync(file)){files.set(language,file);states.set(language,readState(file));}
  }
  const queue=rows.filter(r=>states.get(r.language)?.records[r.url]&&(states.get(r.language).records[r.url].originProvenanceVersion||0)<VERSION)
    .sort((a,b)=>Number(b.language==='cs')-Number(a.language==='cs')||a.url.localeCompare(b.url));
  const started=Date.now(),report={eligible:queue.length,attempted:0,updated:0,withOriginalSource:0,failures:[],complete:false};
  function flush(language){
    writeState(files.get(language),states.get(language));
    // Existing local checkpoints must not shadow refreshed published metadata.
    const incoming=path.join(root,'partial-data/catalog-indexes',language+'.json.gz');
    if(fs.existsSync(incoming)){
      const partial=readState(incoming),fresh=states.get(language);
      for(const [url,r]of Object.entries(fresh.records))if(partial.records[url]&&r.originProvenanceVersion>=VERSION&&Date.parse(r.checkedAt)>=Date.parse(partial.records[url].checkedAt))partial.records[url]=r;
      writeState(incoming,partial);
    }
  }
  const dirty=new Set();
  try{for(const row of queue){
    if(report.attempted>=maxRequests||Date.now()-started>=maxDurationMs)break;
    if(report.attempted)await new Promise(r=>setTimeout(r,intervalMs));
    report.attempted++;
    try{const record=await request(row.url);
      if(record.url!==row.url||record.originProvenanceVersion!==VERSION)throw Error('Unexpected refreshed record');
      states.get(row.language).records[row.url]={...record,links:[]};dirty.add(row.language);report.updated++;
      if(record.originalSources?.length)report.withOriginalSource++;
    }catch(e){report.failures.push({url:row.url,reason:e.message});}
    if(report.attempted%25===0){for(const l of dirty)flush(l);dirty.clear();console.log(JSON.stringify(report));}
  }}finally{for(const l of dirty)flush(l);}
  report.complete=report.attempted>=queue.length;console.log(JSON.stringify(report));return report;
}
if(require.main===module)refresh({maxRequests:Number(process.env.PROVENANCE_MAX_REQUESTS||300),maxDurationMs:Number(process.env.PROVENANCE_MAX_DURATION_MS||240000),languages:process.env.PROVENANCE_LANGUAGES?.split(',')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={refresh};
