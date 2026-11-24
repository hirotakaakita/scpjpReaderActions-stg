'use strict';
// Read-only 2026 publisher checks for the 62 URL/number cases that cannot
// be decided by the presence of a staff redirect or a structural namespace.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const textHash=s=>crypto.createHash('sha256').update(s).digest('hex');
const slim=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
 .replace(/&(?:nbsp|amp|quot|lt|gt);/g,' ').replace(/\s+/g,' ').trim();
async function check(url){
 const parsed=new URL(url);const ru=parsed.hostname==='scpfoundation.net';
 const endpoint=ru?'https://scpfoundation.net/api/articles/'+encodeURIComponent(parsed.pathname.slice(1)):url;
 try{
  const res=await fetch(endpoint,{headers:{'User-Agent':'SCPReaderOriginalAudit/1.0','Accept':ru?'application/json':'text/html'},
   signal:AbortSignal.timeout(16000),redirect:'follow'});
  const data=(await res.text()).slice(0,1000000);
  let title=null,body=data,format=ru?'publisher_api_ftml':'wikidot_html';
  if(ru){
   try{
    const obj=JSON.parse(data);
    title=obj.title||obj.pageTitle||null;
    body=String(obj.source||'');
    if(!obj.source)format='unrecognized_publisher_api';
   }catch(e){format='api_parse_failure'}
  }else{
   const match=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(data);
   title=match?slim(match[1]):null;
  }
  const text=slim(body);
  return {requestedUrl:url,endpoint,format,status:res.status,finalUrl:res.url,
   redirected:res.url!==endpoint,title,textHash:textHash(text),textCharacters:text.length,
   notice:/ブライト関連作品に関するお知らせ|Bright Works Message/i.test(text.slice(0,3000)),
   missingPage:/the page you are looking for does not exist|this page does not exist|page not found/i.test(text.slice(0,3000)),
   outcome:res.ok?'publisher_accessible':'publisher_http_error'};
 }catch(e){return {requestedUrl:url,endpoint,outcome:'network_error',error:String(e.message||e).slice(0,240)};}
}
async function run(inFile,outDir){
 const input=JSON.parse(fs.readFileSync(inFile,'utf8'));
 const focus=input.result.filter(x=>['native_work_collision','exact_path_split',
  'numbered_renumbered_translation','named_or_indirect_origin'].includes(x.structuralGroup));
 if(focus.length!==62)throw Error('Expected 62 source/credit mismatches, got '+focus.length);
 const urls=[...new Set(focus.flatMap(x=>[x.source,x.original,...x.competingNativeUrls]))];
 const grouped=new Map();
 for(const url of urls){
  const host=new URL(url).hostname;
  if(!grouped.has(host))grouped.set(host,[]);
  grouped.get(host).push(url);
 }
 const results=new Map();
 await Promise.all([...grouped].map(async ([host,hostUrls])=>{
  for(const url of hostUrls){
   results.set(url,await check(url));
   await new Promise(resolve=>setTimeout(resolve,1050));
  }
 }));
 const cases=focus.map(c=>{
  const source=results.get(c.source),original=results.get(c.original);
  const sameHtmlTitle=source?.title&&original?.title&&source.title===original.title;
  const sameRawText=source?.outcome==='publisher_accessible'&&
   original?.outcome==='publisher_accessible'&&source.textHash===original.textHash;
  const nativeCompeting=(c.competingNativeUrls||[]).map(url=>results.get(url));
  const isPublisherAlias=nativeCompeting.some(n=>n?.outcome==='publisher_accessible'&&
   original?.outcome==='publisher_accessible'&&
   n.finalUrl===original.finalUrl&&n.textHash===original.textHash&&
   !n.finalUrl.includes('/api/articles/'));
  return {sourceUrl:c.source,originalUrl:c.original,detectedIssue:c.detectedIssue,
   competingNativePublisherPages:nativeCompeting,canonicalPublisherAliasConfirmed:isPublisherAlias,
   sourceWork:c.sourceWork,originalWork:c.originalWork,sourceTitle:c.sourceTitle,
   originalTitle:c.originalTitle,sourceNow:source,originalNow:original,
   samePublisherResponseText:!!sameRawText,identicalPageTitle:!!sameHtmlTitle,
   nextAction:source?.outcome!=='publisher_accessible'||original?.outcome!=='publisher_accessible'?
    'Publisher inaccessible; archived source or official index needed':
    'Publisher pages retrievable; verify translation credit, article identity and native-site collisions',
   outcome:'publisher_endpoint_rechecked_identity_not_automatically_joined'};
 });
 const status={};for(const o of results.values()){
  status[o.outcome]=(status[o.outcome]||0)+1;
 }
 const doc={revision:input.revision,focusCount:focus.length,uniqueTargets:urls.length,
  checkedTargets:results.size,checkOutcomes:status,
  publisherCanonicalAliasCases:cases.filter(x=>x.canonicalPublisherAliasConfirmed).map(x=>x.sourceUrl),method:'Wikidot current HTML; RU current official article API in FTML',
  limitation:'HTTP, titles, and differing content hashes cannot prove translation equivalence.',
  cases};
 fs.mkdirSync(outDir,{recursive:true});
 fs.writeFileSync(path.join(outDir,'62-live-publisher-checks.json'),JSON.stringify(doc,null,2)+'\n');
 fs.writeFileSync(path.join(outDir,'LIVE-SUMMARY.md'),[
  '# Current publisher recheck: 62 complex numbered/named identity cases','',
  'Source cases: '+cases.length, 'Publisher endpoints requested: '+urls.length,
  'Responses: '+results.size,'','| Outcome | URL count |','|---|---:|',
  ...Object.entries(status).map(([k,v])=>'| '+k+' | '+v+' |'),
  '','Russian sources used the publisher JSON FTML endpoint, never HTML.',
  'Text body is not redistributed in this evidence report. Only status/title/hash are recorded.',
  'No visual/graph/canonical work changes were applied without publisher-confirmed identity.'
 ].join('\n')+'\n');
 console.log(JSON.stringify({focus:cases.length,checked:results.size,status},null,2));
}
if(require.main===module)run(process.argv[2]||'original-claims-150/150-case-evidence.json',
 process.argv[3]||'original-claims-150').catch(e=>{console.error(e);process.exitCode=1;});
module.exports={check,run};
