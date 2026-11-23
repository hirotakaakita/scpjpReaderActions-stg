'use strict';
// Read-only publisher-target HTTP evidence for all 323 unresolved claims.
// HTTP status or a title similarity NEVER proves that two article bodies are identical.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {candidateReview}=require('./classify-original-claims-404');
const {loadBoard}=require('../research-board/verification/audit');
const {readSources}=require('../research-board/source-store');
const {evaluate}=require('./triage-original-claims-404');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const strip=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')
 .replace(/&(?:nbsp|amp|quot|lt|gt);/g,' ').replace(/\s+/g,' ').trim();
async function request(url){
 const u=new URL(url),russian=u.hostname==='scpfoundation.net';
 const endpoint=russian?'https://scpfoundation.net/api/articles/'+encodeURIComponent(u.pathname.slice(1)):url;
 try{
  const res=await fetch(endpoint,{signal:AbortSignal.timeout(18000),redirect:'follow',
   headers:{'User-Agent':'SCPReader-OriginEvidenceAudit/1.0','Accept':russian?'application/json':'text/html'}});
  const type=res.headers.get('content-type')||'';
  const body=(await res.text()).slice(0,900000);
  let text=body, title=null,format=russian?'ftml-api':'html';
  if(russian&&res.ok){
   try{const obj=JSON.parse(body);title=obj.title||null;text=String(obj.source||'');}
   catch(_){format='invalid-api-payload';}
  }else if(!russian){
   const m=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
   title=m?strip(m[1]):null;
  }
  const plain=strip(text);
  return {requestedUrl:url,endpoint,httpStatus:res.status,finalUrl:res.url,redirected:res.url!==endpoint,
   contentType:type,format,title,contentHash:sha(text),contentLength:text.length,
   possibleBrightNotice:/bright works message|ブライト関連作品に関するお知らせ/i.test(plain.slice(0,6000)),
   possibleWikidotMissingPage:/the page you are looking for does not exist|this page does not exist|page does not exist/i.test(plain.slice(0,7000)),
   outcome:res.ok?'http_success':'http_failure'};
 }catch(e){return {requestedUrl:url,endpoint,outcome:'fetch_error',error:String(e.message||e).slice(0,200)};}
}
async function run(out){
 const {board}=loadBoard(),sources=readSources('local-data/research-board-sources');
 const report=candidateReview(board,sources);
 const pending=report.cases.map(evaluate).filter(x=>x.proposedClassification==='証拠不足');
 if(pending.length!==323)throw Error('Expected 323 pending, found '+pending.length);
 const urls=[...new Set(pending.map(x=>x.resolvedOriginal))].sort();
 const evidence=new Map();const queues=new Map();
 for(const url of urls){
  const host=new URL(url).hostname;
  if(!queues.has(host))queues.set(host,[]);
  queues.get(host).push(url);
 }
 const workers=[...queues].map(async ([host,hostUrls])=>{
  for(const [i,url] of hostUrls.entries()){
   evidence.set(url,await request(url));
   if(i+1<hostUrls.length)await new Promise(resolve=>setTimeout(resolve,800));
  }
 });
 await Promise.all(workers);
 const cases=pending.map(x=>{
  const remote=evidence.get(x.resolvedOriginal);
  const matchingTitle=remote?.title&&x.originalTitle?
    remote.title.toLowerCase().includes(x.originalTitle.toLowerCase()):null;
  const missing=remote?.httpStatus===404||remote?.possibleWikidotMissingPage===true;
  const notice=remote?.possibleBrightNotice===true;
  // No change of four-way semantic decision without article/body proof.
  const nextStep=missing?'Confirm archived original and publisher migration before classifying':
   notice?'Assess deletion/retirement notice and historical translation independently':
   remote?.outcome==='http_success'?'Publisher URL reachable; compare content and attribution manually':
   'Target inaccessible; seek archived official publisher evidence';
  return {source:x.source,sourceWork:x.sourceWork,original:x.resolvedOriginal,
   originalWork:x.originalWork,detectedIssue:x.detectedIssue,originalTitle:x.originalTitle,
   sourceTitle:x.sourceTitle,publisher:remote,matchingTitle,nextStep,
   finalClassification:'証拠不足',finalClassificationConfirmed:false};
 });
 const outcomes={};for(const x of evidence.values()){
  const key=String(x.httpStatus||x.outcome)+(x.possibleBrightNotice?':bright-notice':'');
  outcomes[key]=(outcomes[key]||0)+1;
 }
 const result={revision:board.revision,unresolvedCases:cases.length,uniqueTargets:urls.length,
  checkedTargets:evidence.size,outcomes,method:'Read-only live request, RU via publisher JSON API',
  limitation:'HTTP and titles cannot prove semantic equivalence or distinguish retired/deleted versions',
  cases};
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'live-target-evidence.json'),JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(path.join(out,'LIVE-EVIDENCE.md'),[
  '# Current publisher target availability for all 323 outstanding candidates','',
  'Current graph revision: '+result.revision,'Unresolved cases inspected: '+cases.length,
  'Unique original publisher targets: '+urls.length,'Attempted: '+evidence.size,
  '','| Outcome | Unique targets |','| --- | ---: |',
  ...Object.entries(outcomes).map(([k,v])=>'| '+k+' | '+v+' |'),
  '','A successful HTTP result does NOT establish article identity. Failed HTTP does NOT prove article deletion.',
  'Russian targets were queried through the scpfoundation.net JSON API, not HTML.',
  'No source records, published graph IDs, catalog entries, or user-state aliases were modified.'
 ].join('\n')+'\n');
 console.log(JSON.stringify({revision:result.revision,cases:cases.length,targets:evidence.size,outcomes},null,2));
}
if(require.main===module)run(process.argv[2]||'original-claims-404').catch(e=>{console.error(e);process.exitCode=1;});
module.exports={request,run};
