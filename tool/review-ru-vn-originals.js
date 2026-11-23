'use strict';
// Read-only language/original-credit identity diagnostics. Keep both the
// publisher's explicit original link and the actual catalog rows visible.
const fs=require('node:fs'),path=require('node:path');
const {loadBoard}=require('../research-board/verification/audit');
const {readSources}=require('../research-board/source-store');
const {loadCatalogs}=require('../research-board/catalog');
const {normalizePage}=require('../research-board/extract');
const {originalPage}=require('../origin-provenance');
const {originalPath,nativeBranch}=require('../research-board/explicit-scp-origin');
const focus=[
 'https://scp-wiki.wikidot.com/scp-1138',
 'https://scpfoundation.net/scp-1138',
 'https://scpfoundation.net/scp-1138-ru',
 'https://scp-wiki.wikidot.com/scp-206',
 'https://scpfoundation.net/scp-206',
 'https://scpfoundation.net/scp-206-ru',
 'https://scp-wiki.wikidot.com/scp-2195',
 'https://scpfoundation.net/scp-2195',
 'https://scpfoundation.net/scp-2195-ru',
 'https://scp-wiki.wikidot.com/scp-1150-j',
 'https://scpfoundation.net/scp-1150-j',
 'https://scp-vn.wikidot.com/scp-179',
 'https://scp-vn.wikidot.com/scp-es-026',
 'https://scp-wiki.wikidot.com/scp-179',
 'https://lafundacionscp.wikidot.com/scp-es-026'
];
function run(dir){
 const {board}=loadBoard();
 const stores=readSources('local-data/research-board-sources');
 const catalogs=loadCatalogs('local-data');
 const members=new Map();
 for(const n of board.nodes)for(const v of n[13]){
  if(members.has(v[1]))throw Error('Duplicated article '+v[1]);
  members.set(v[1],{node:n,version:v});
 }
 const byId=new Map();
 for(const [url,{node,version}]of members){
  const p=normalizePage(url);
  byId.set(p.id,{...p,siteBranch:version[0],branch:node[8],pageType:node[12],kindIndex:node[3]});
 }
 const byUrlCatalog=new Map();
 for(const c of catalogs)for(const r of c.data){
  const p=normalizePage(r.isTranslatedJP!==false&&r.urlJP?r.urlJP:r.urlEN);
  if(!p)continue;
  if(!byUrlCatalog.has(p.url))byUrlCatalog.set(p.url,[]);
  byUrlCatalog.get(p.url).push({language:c.language,itemId:r.itemId,
    pageType:r.pageType,contentType:r.contentType,title:r.titleJP||r.titleEN||''});
 }
 const rows=focus.map(url=>{
  const p=normalizePage(url),meta=byId.get(p?.id),holder=members.get(url),
  state=stores.get(p?.id),record=state?.record,trace=meta&&originalPath(meta,byId,stores);
  return {url,knownInBoard:!!holder,workId:holder?.node[14][0]||null,
    title:holder?.node[5]||null,origin:holder?.node[8]||null,
    pageType:holder?.node[12]||null,siteBranch:meta?.siteBranch||null,
    consideredNative:meta?nativeBranch(meta):null,
    allWorkVersions:holder?.node[13].map(v=>v[1])||[],
    allWorkVersionEvidence:(holder?.node[13]||[]).map(v=>{
      const vp=normalizePage(v[1]),sr=stores.get(vp?.id)?.record;
      return {url:v[1],title:sr?.title||v[3],
        tags:sr?.tags||[],
        originalCredits:(sr?.originalSources||[])
          .filter(x=>x.method==='credit_original_label')
          .map(x=>originalPage(x.url)?.url||x.url),
        checkedAt:sr?.checkedAt||null,sourceHash:sr?.contentSha256||null};
    }),
    allWorkKeys:holder?.node[14][2]||[],
    sourceHash:record?.contentSha256||null,
    checkedAt:record?.checkedAt||null,
    tags:record?.tags||[],
    sourceTitle:record?.title||null,
    originalLinks:(record?.originalSources||[]).map(x=>({
      url:originalPage(x.url)?.url||x.url,method:x.method,quote:x.quote||null})),
    catalogRows:byUrlCatalog.get(url)||[],
    tracedOriginal:trace?.original.url||null,
    proofLinks:(board.workIdentityProofs||[]).filter(x=>x.source===url||x.target===url)
  };
 });
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'CREDITED_RU_AND_VN_WORKS.json'),JSON.stringify({revision:board.revision,
   checked:rows.length,rows},null,2)+'\n');
 const md=['# High-priority Russian origin and Vietnamese duplicate-publication review','',
  'Board revision: '+board.revision,'','| URL | Work ID | Claimed original | Site origin | Native |',
  '| --- | --- | --- | --- | --- |',...rows.map(r=>'| '+r.url+' | '+r.workId+
  ' | '+r.originalLinks.filter(x=>x.method==='credit_original_label').map(x=>x.url).join('; ')+
  ' | '+r.origin+' | '+r.consideredNative+' |'),
  '','Manual publisher provenance still required before combining distinct versions.',
  'All catalog IDs and original work versions are preserved in JSON.'
 ];
 fs.writeFileSync(path.join(dir,'CREDITED_RU_AND_VN_WORKS.md'),md.join('\n')+'\n');
 console.log(JSON.stringify({revision:board.revision,rows:rows.map(x=>({url:x.url,
  workId:x.workId,title:x.title,origin:x.origin,siteBranch:x.siteBranch,
  native:x.consideredNative,credit:x.originalLinks.filter(y=>y.method==='credit_original_label').map(y=>y.url),
  versions:x.allWorkVersions,catalogRows:x.catalogRows.map(c=>({itemId:c.itemId,pageType:c.pageType,language:c.language}))}))},null,2));
}
if(require.main===module)try{run(path.resolve(process.argv[2]||'postmerge-ru-vn-origins'));}
catch(e){console.error(e);process.exitCode=1;}
module.exports={run};
