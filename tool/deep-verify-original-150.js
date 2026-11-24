'use strict';
// Independent primary-source semantic excerpts for unresolved original-credit cases.
// Read-only, bounded publisher fetches. No automatic graph fix from text similarity.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const stripFtml=s=>String(s||'').replace(/\[\[(?:include|module|image|div|span|code|html|collapsible)[^\]]*\]\]/gi,' ')
 .replace(/\[\[\/[^\]]+\]\]/g,' ').replace(/\[+\[?https?:\/\/[^\]\n]+/gi,' ')
 .replace(/[\[\]*#_]/g,' ').replace(/\s+/g,' ').trim();
const unique=a=>[...new Set(a.filter(Boolean))];
const numbered=url=>{
 const p=new URL(url),slug=p.pathname.slice(1);
 if(p.hostname==='scp-wiki.wikidot.com')return null;
 return /^scp-\d+(?:-[a-z]{2,5})?$/i.test(slug)?
  'https://scp-wiki.wikidot.com/'+slug :null;
};
async function capture(url){
 const u=new URL(url),ru=u.hostname==='scpfoundation.net';
 const endpoint=ru?'https://scpfoundation.net/api/articles/'+encodeURIComponent(u.pathname.slice(1)):url;
 try{
  const res=await fetch(endpoint,{signal:AbortSignal.timeout(18000),redirect:'follow',
   headers:{'User-Agent':'SCPReaderSourceVerification/1.0','Accept':ru?'application/json':'text/html'}});
  let raw=(await res.text()).slice(0,1200000),title='',paragraphs=[],assets=[],links=[],credits=[];
  if(ru){
   const data=JSON.parse(raw),body=String(data.source||'');
   title=data.title||'';
   paragraphs=body.split(/\n\s*\n/).map(stripFtml).filter(x=>x.length>35);
   assets=unique([...body.matchAll(/\b[\w-]{3,100}\.(?:png|jpg|jpeg|gif|webp)\b/gi)].map(x=>x[0].toLowerCase()));
   links=unique([...body.matchAll(/https?:\/\/[^\s\]|)<>]+/gi)].map(x=>x[0]));
  }else{
   const dom=new JSDOM(raw,{url}),doc=dom.window.document,main=doc.querySelector('#page-content');
   title=norm(doc.querySelector('#page-title')?.textContent||doc.title);
   if(main){
    for(const node of main.querySelectorAll('script,style,nav,.page-tags,.licensebox,.license-area,.interwiki-wrapper,.creditRate,.credit-box,.collapsible-block-folded'))node.remove();
    const block=[...main.querySelectorAll('p,li,h2,h3,h4,blockquote,td')]
      .map(n=>norm(n.textContent)).filter(x=>x.length>35);
    paragraphs=block.slice(0,200);
    assets=unique([...main.querySelectorAll('img[src]')].map(x=>new URL(x.getAttribute('src'),url).pathname.split('/').at(-1)?.toLowerCase()));
    links=unique([...main.querySelectorAll('a[href]')].map(x=>{try{return new URL(x.getAttribute('href'),url).href}catch{return null}}));
    credits=block.filter(x=>/original|元記事|初訳|übersetz|originale|原文|autor|author|original article|title:|artículo/i.test(x)).slice(0,12);
   }
   dom.window.close();
  }
  const long=paragraphs.filter(x=>x.length>80);
  const bodytext=paragraphs.join('\n');
  return {url,endpoint,finalUrl:res.url,status:res.status,ok:res.ok,
    title,bodyHash:hash(bodytext),bodyLength:bodytext.length,
    paragraphs:long.slice(0,10).map(s=>s.slice(0,420)),
    tail:long.slice(-3).map(s=>s.slice(0,250)),assets:assets.slice(0,40),
    relevantLinks:links.filter(x=>/scp|foundation|wikidot|scpfoundation/.test(x)).slice(0,40),
    credits};
 }catch(e){return {url,endpoint,ok:false,error:String(e.message||e).slice(0,180)}}
}
async function run(inputFile,outDir){
 const source=JSON.parse(fs.readFileSync(inputFile,'utf8'));
 const unresolved=source.result.filter(x=>x.classification==='証拠不足');
 const cases=source.result; // Every one of the 150, including the 40 staff notices and 25 unofficial translations
 const urls=unique(cases.flatMap(x=>[
  x.source,x.original,...(x.competingNativeUrls||[]), numbered(x.source)
 ]));
 const byHost=new Map(),results=new Map();
 for(const url of urls){const host=new URL(url).hostname;
  if(!byHost.has(host))byHost.set(host,[]);byHost.get(host).push(url);}
 await Promise.all([...byHost].map(async ([,list])=>{
  for(const url of list){results.set(url,await capture(url));await new Promise(r=>setTimeout(r,1100));}
 }));
 const out={currentRevision:source.revision,unresolvedCount:unresolved.length,
  complexCases:cases.length,uniquePublisherUrls:urls.length,captured:results.size,
  cases:cases.map(x=>({...x,
   sourceNow:results.get(x.source),originalNow:results.get(x.original),
   sameNumberEnglishNow:results.get(numbered(x.source))||null,
   competitorsNow:(x.competingNativeUrls||[]).map(url=>results.get(url))}))};
 fs.mkdirSync(outDir,{recursive:true});
 fs.writeFileSync(path.join(outDir,'deep-primary-source-excerpts.json'),JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({complexCases:out.complexCases,urls:urls.length,ok:[...results.values()].filter(x=>x.ok).length,
  missing:[...results.values()].filter(x=>!x.ok).map(x=>x.url)},null,2));
}
if(require.main===module)run(process.argv[2]||'original-claims-150/150-case-evidence.json',
process.argv[3]||'original-claims-150').catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,capture};
