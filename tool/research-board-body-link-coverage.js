'use strict';
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {loadCatalogs}=require('../research-board/catalog');
const {readSources,importDirectory}=require('../research-board/source-store');
const {normalizePage}=require('../research-board/extract');
const {normalize:publisherPage}=require('../related-documents');
const {checked}=require('../research-board/refresh-links');
function audit(root=path.join(__dirname,'..')){
  const input=path.join(root,'local-data'),sources=readSources(path.join(input,'research-board-sources'));
  importDirectory(sources,path.join(root,'partial-data/related-documents/research-board'));
  const pages=new Map();
  for(const catalog of loadCatalogs(input))for(const row of catalog.data){
    const p=normalizePage(row.isTranslatedJP!==false&&row.urlJP?row.urlJP:row.urlEN);
    if(p)pages.set(p.id,p);
  }
  const groups=new Map(),sites={},unresolved=[];
  for(const p of pages.values()){
    const language=publisherPage(p.url)?.language||p.branch,s=sources.get(p.id);
    const site=sites[language]??={total:0,checked:0,pending:0,unavailable:0,failed:0};site.total++;
    const group=groups.get(p.host)||{id:p.host.replace(/\./g,'-'),languages:new Set(),eligible:0};
    group.languages.add(language);groups.set(p.host,group);
    if(checked(s)){site.checked++;continue;}
    site.pending++;
    const status=s?.lastAttempt?.status;
    const reason=['unavailable','not_found','not_article'].includes(status)?'unavailable':status&&!['success','not_modified'].includes(status)?'fetch_error':'not_extracted';
    if(reason==='unavailable')site.unavailable++;if(reason==='fetch_error')site.failed++;
    const retryAfter=s?.lastAttempt?.retryAfter||null;
    if(!retryAfter||Date.parse(retryAfter)<=Date.now())group.eligible++;
    unresolved.push({url:p.url,language,reason,retryAfter});
  }
  const checkedPages=Object.values(sites).reduce((sum,s)=>sum+s.checked,0);
  return {totalPages:pages.size,checkedPages,pendingPages:pages.size-checkedPages,sites,
    groups:[...groups.values()].map(g=>({...g,languages:[...g.languages].sort().join(',')})).sort((a,b)=>a.id.localeCompare(b.id)),
    unresolved:unresolved.sort((a,b)=>a.url.localeCompare(b.url))};
}
if(require.main===module){
  const result=audit(),args=process.argv.slice(2),output=args.includes('--output')?args[args.indexOf('--output')+1]:null;
  if(output){const data=JSON.stringify(result)+'\n';fs.writeFileSync(output,output.endsWith('.gz')?z.gzipSync(data):data);}
  if(args.includes('--matrix')){
    const groups=process.env.BOARD_LINK_FULL_REFRESH==='1'?result.groups:result.groups.filter(g=>g.eligible>0);
    const matrix={include:groups.length?groups:[{id:'none',languages:'all'}]};
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify(matrix)}\nhas_work=${groups.length>0}\n`);
  }
  const {unresolved,groups,...summary}=result;console.log(JSON.stringify(summary,null,2));
}
module.exports={audit};
