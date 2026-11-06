'use strict';
// Durable local bootstrap. Each child uses the same entry point as weekly CI.
// Outputs are local partials; this process never commits, pushes or publishes.
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {LANGUAGES}=require('../languages');
const {readState}=require('../catalog-indexes');
const root=path.resolve(__dirname,'..'),output=path.join(root,'relations/index-bootstrap');
fs.mkdirSync(output,{recursive:true});
const status={pid:process.pid,startedAt:new Date().toISOString(),state:'running',pass:0,jobs:{}};
const save=()=>{fs.writeFileSync(path.join(output,'progress.json.tmp'),JSON.stringify(status,null,2),{flush:true});fs.renameSync(path.join(output,'progress.json.tmp'),path.join(output,'progress.json'));
  const rows=['# 公式索引カタログ取得の進捗','',`状態: ${status.state} / 巡回 ${status.pass} / 更新 ${new Date().toISOString()}`,'',
    '一覧URL数と、アプリで表示する作品数は一致しない場合があります。既存の通常記事は二重に取得せず、追加記事の本文を順に確認しています。','',
    '|言語|状態|索引に掲載されたURL|取得済み・既存記事|今回の記事取得|残りの索引|','|---|---|---:|---:|---:|---:|'];
  for(const [l,j]of Object.entries(status.jobs)){const s=j.statistics||{};rows.push(`|${l}|${j.state}|${s.members??''}|${s.available??''}|${s.fetchedArticles??''}|${s.pendingIndexes??''}|`);}
  fs.writeFileSync(path.join(output,'progress.md'),rows.join('\n')+'\n',{flush:true});};
async function job(language,pass){
  const log=fs.openSync(path.join(output,`${language}-pass${pass}.log`),'a');
  status.jobs[language]={state:'running',pass,startedAt:new Date().toISOString()};save();
  return new Promise(resolve=>{
    const child=spawn(process.execPath,['--max-old-space-size=1024','catalog-indexes.js',language],{cwd:root,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,
      INDEX_MAX_REQUESTS:process.env.BOOTSTRAP_REQUESTS||'100',INDEX_MAX_DURATION_MS:'300000',CRAWL_REQUEST_INTERVAL_MS:'500'}});
    child.on('error',e=>{status.jobs[language].error=e.message;});
    child.on('close',code=>{fs.closeSync(log);let statistics;
      try{statistics=readState(path.join(root,'partial-data/catalog-indexes',language+'.json.gz')).statistics;}catch{}
      status.jobs[language]={...status.jobs[language],state:code===0?'completed':'failed',code,statistics,finishedAt:new Date().toISOString()};save();resolve(code);});
  });
}
async function main(){
  const languages=Object.keys(LANGUAGES),passes=Number(process.env.BOOTSTRAP_PASSES||'50');
  for(let pass=1;pass<=passes;pass++){
    status.pass=pass;let next=0;
    await Promise.all(Array.from({length:3},async()=>{while(next<languages.length)await job(languages[next++],pass);}));
    status.completedPass=pass;save();
    const totals={fetchedIndexes:0,fetchedArticles:0,members:0,available:0,pendingIndexes:0,pendingDiscoveredIndexes:0};
    for(const language of languages){const file=path.join(root,'partial-data/catalog-indexes',language+'.json.gz');if(!fs.existsSync(file))continue;
      const state=readState(file);for(const key of Object.keys(totals))totals[key]+=state.statistics?.[key]||0;}
    status.totals=totals;save();
    if(totals.fetchedIndexes+totals.fetchedArticles+totals.pendingDiscoveredIndexes===0)break;
  }
  status.state=Object.values(status.jobs).some(j=>j.state==='failed')?'completed_with_errors':'completed';status.finishedAt=new Date().toISOString();save();
}
main().catch(e=>{status.state='failed';status.error=e.message;save();process.exitCode=1;});
