'use strict';
// Bounded backfill of already-published catalog pages. Never follow a link.
const fs=require('node:fs'),path=require('node:path');
const {loadCatalogs}=require('./catalog');
const {readSources,importDirectory,merge,captureFailure}=require('./source-store');
const {normalizePage,digest,EXTRACTOR_VERSION}=require('./extract');
const {fetchRecord}=require('../related-documents');
async function refresh({root=path.join(__dirname,'..'),language,maxRequests=600,maxDurationMs=300000,
  intervalMs=500,now=new Date().toISOString(),request}={}){
  if(!language||!Number.isInteger(maxRequests)||maxRequests<0||maxRequests>10000||maxDurationMs<=0||intervalMs<0)throw Error('Invalid refresh limits');
  const input=path.join(root,'local-data'),incoming=path.join(root,'partial-data/related-documents/research-board');
  const sources=readSources(path.join(input,'research-board-sources'));importDirectory(sources,incoming);
  const pages=new Map();
  for(const c of loadCatalogs(input))for(const row of c.data){
    const p=normalizePage(row.isTranslatedJP!==false&&row.urlJP?row.urlJP:row.urlEN);
    // Each hosting site is fetched only by its language job, even if another
    // delivery catalog contains an original-language fallback URL.
    if(p?.branch===language)pages.set(p.id,p);
  }
  const cutoff=Date.parse(now)-28*86400000,retry=Date.parse(now)-86400000;
  const queue=[...pages.values()].filter(p=>{
    const s=sources.get(p.id),r=s?.record;
    if(s?.lastAttempt&&!['success','not_modified'].includes(s.lastAttempt.status)&&Date.parse(s.lastAttempt.at)>retry)return false;
    return !(r?.linkExtractionVersion>=EXTRACTOR_VERSION) || Date.parse(r.checkedAt)<cutoff;
  }).sort((a,b)=>{
    const ra=sources.get(a.id)?.record,rb=sources.get(b.id)?.record;
    return Number(ra?.linkExtractionVersion>=EXTRACTOR_VERSION)-Number(rb?.linkExtractionVersion>=EXTRACTOR_VERSION)||
      (ra?.checkedAt||'').localeCompare(rb?.checkedAt||'')||a.id.localeCompare(b.id,'en');
  });
  const fetch=request|| (async url=>{
    const current=await fetchRecord(url,incoming);
    const p=normalizePage(url),file=path.join(incoming,digest(p.id)+'.json');
    if(!fs.existsSync(file))throw Error('Missing current body-link capture');
    const record=JSON.parse(fs.readFileSync(file)).record;
    if(record?.contentSha256!==current.contentSha256)throw Error('Stale body-link capture');
    return record;
  });
  const report={language,totalCatalogPages:pages.size,pendingBefore:queue.length,attempted:0,updated:0,failed:0};
  const started=Date.now();
  for(const p of queue){
    if(report.attempted>=maxRequests||Date.now()-started>=maxDurationMs)break;
    if(report.attempted)await new Promise(resolve=>setTimeout(resolve,intervalMs));
    report.attempted++;
    try{
      const record=await fetch(p.url);
      if(record?.pageId!==p.id||!(record.linkExtractionVersion>=EXTRACTOR_VERSION)||!Array.isArray(record.links))throw Error('Invalid current body-link capture');
      const state={record,lastAttempt:{status:'success',at:record.checkedAt}};
      merge(sources,state);fs.mkdirSync(incoming,{recursive:true});
      const file=path.join(incoming,digest(p.id)+'.json');
      fs.writeFileSync(file+'.tmp',JSON.stringify(state));fs.renameSync(file+'.tmp',file);report.updated++;
    }catch(error){
      const status=[404,410].includes(error.response?.status)||error.articleUnavailable?'unavailable':'fetch_error';
      captureFailure(p.url,status,incoming);report.failed++;
      console.warn(`Body-link refresh failed: ${p.url}: ${error.message}`);
    }
    if(report.attempted%25===0)console.log(JSON.stringify(report));
  }
  report.remaining=queue.length-report.updated;console.log(JSON.stringify(report));return report;
}
if(require.main===module)refresh({language:process.argv[2],maxRequests:Number(process.env.BOARD_LINK_MAX_REQUESTS||600),
  maxDurationMs:Number(process.env.BOARD_LINK_MAX_DURATION_MS||300000),intervalMs:Number(process.env.CRAWL_REQUEST_INTERVAL_MS||500)})
  .catch(error=>{console.error(error);process.exitCode=1;});
module.exports={refresh};
