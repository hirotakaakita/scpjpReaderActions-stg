'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadBoard}=require('../research-board/verification/audit');
const {readSources}=require('../research-board/source-store');
const {normalizePage}=require('../research-board/extract');
const {originalPage}=require('../origin-provenance');
const {originalPath,verifiedScpOriginal,nativeBranch}=require('../research-board/explicit-scp-origin');
const root=path.resolve(__dirname,'..');
function run(dir){
 const {board,manifest}=loadBoard();
 const sources=readSources(path.join(root,'local-data/research-board-sources'));
 const pageMap=new Map(),nodeMap=new Map();
 for(const node of board.nodes)for(const version of node[13]){
  const p=normalizePage(version[1]);
  if(!p)continue;
  const metadata={...p,siteBranch:version[0],branch:node[8],pageType:node[12],kindIndex:node[3]};
  pageMap.set(p.id,metadata);nodeMap.set(p.id,node);
 }
 const slugs=new Set(['scp-179','scp-es-026','scp-es-179','scp-cn-179']);
 const focus=[...pageMap.values()].filter(p=>slugs.has(p.slug)).sort((a,b)=>a.url.localeCompare(b.url));
 const rows=focus.map(p=>{
  const record=sources.get(p.id)?.record||null,node=nodeMap.get(p.id);
  const claim=(record?.originalSources||[]).map(c=>({
   url:c.url,method:c.method,normalized:originalPage(c.url)?.url||null,quote:c.quote||''
  }));
  const metadataClaim=(record?.catalogIdentity?.originalSources||[]).map(c=>({
   url:c.url,method:c.method,normalized:originalPage(c.url)?.url||null
  }));
  const path=originalPath(p,pageMap,sources),verified=verifiedScpOriginal(p,pageMap,sources);
  const claimedWorks=claim.filter(c=>c.method==='credit_original_label').map(c=>{
   const target=normalizePage(c.normalized)?.id;
   return {original:c.normalized,workId:nodeMap.get(target)?.[14][0]||null};
  });
  return {url:p.url,workId:node[14][0],title:node[5],siteBranch:p.siteBranch,
   originBranch:p.branch,pageType:p.pageType,native:nativeBranch(p),
   contentSha256:record?.contentSha256||null,checkedAt:record?.checkedAt||null,
   originalSources:claim,catalogOriginals:metadataClaim,claimedWorks,
   rawOriginalClaimCount:claim.length,
   originalPath:path?.chain.map(x=>x.url)||[],verifiedOriginal:verified?.url||null,
   parentNodePages:node[13].map(v=>v[1]),recordTitle:record?.title||null,
   catalogIdentity:record?.catalogIdentity||null,tagOriginals:record?.tags?.filter(t=>/original|es|cn|international/i.test(t))||[]
  };
 });
 const ref='https://scp-wiki.wikidot.com/scp-179';
 const refRow=rows.find(r=>r.url===ref);
 const candidates=rows.filter(r=>r.url.endsWith('/scp-179')&&r.workId!==refRow.workId);
 const result={revision:board.revision,manifestSha256:manifest.sha256,checked:rows.length,
  english179:refRow.workId,differentFromEnglish179:candidates.length,rows};
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'SCP179_EVIDENCE.json'),JSON.stringify(result,null,2)+'\n');
 const md=['# Post-merge SCP-179 work and original-credit evidence','',
  'Published board revision: '+board.revision,'',
  'English /scp-179 work: '+refRow.workId,
  'Other /scp-179 pages that are assigned to a different work: '+candidates.length,
  '','| Page | Work | Catalog origin branch | Credit / resolved original |',
  '| --- | --- | --- | --- |',
  ...rows.map(r=>'| '+r.url+' | '+r.workId+' | '+r.originBranch+' | '+
    (r.originalSources.map(x=>x.normalized).filter(Boolean).join(' / ')||'none')+' |'),
  '','A different work ID is a review target, not proof of a bad merge. Compare',
  'explicit credited-original URL, catalog-origin metadata and original publisher content first.'];
 fs.writeFileSync(path.join(dir,'SCP179_EVIDENCE.md'),md.join('\n')+'\n');
 console.log(JSON.stringify({revision:result.revision,count:result.checked,english179:result.english179,
  differentFromEnglish179:result.differentFromEnglish179,
  focus:rows.map(r=>({url:r.url,workId:r.workId,originBranch:r.originBranch,
   claims:r.originalSources.map(x=>({url:x.normalized,method:x.method})),
   verifiedOriginal:r.verifiedOriginal}))},null,2));
}
if(require.main===module)try{run(path.resolve(process.argv[2]||'postmerge-scp179'));}
catch(e){console.error(e);process.exitCode=1;}
module.exports={run};
