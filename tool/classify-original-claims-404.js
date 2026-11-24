'use strict';
// Read-only forensic inventory. Never merge solely on URLs, titles or numbers.
const fs=require('node:fs');
const path=require('node:path');
const {loadBoard,buildIndex}=require('../research-board/verification/audit');
const {readSources}=require('../research-board/source-store');
const {originalPage}=require('../origin-provenance');
const {normalizePage}=require('../research-board/extract');
const provenance=require('../research-board/verification/identity-provenance');

function candidateReview(board,raw) {
 const index=buildIndex(board);
 const records=new Map();
 for(const state of raw.values())if(state?.record?.url)records.set(state.record.url,state.record);
 const pointers=new Map(),ambiguous=[];
 for(const [url,record] of records) {
  if(!index.workByUrl.has(url))continue;
  const rawCredits=(record.originalSources||[]).filter(x=>x.method==='credit_original_label');
  const targets=[...new Set(rawCredits.map(x=>originalPage(x.url)?.url||x.url).filter(Boolean))];
  if(targets.length>1)ambiguous.push({source:url,targets});
  if(targets.length===1&&targets[0]!==url)pointers.set(url,targets[0]);
 }
 const categorized=provenance.classify(index,pointers,records);
 const byUrl=new Map();
 for(const node of board.nodes)for(const version of node[13])byUrl.set(version[1],{node,version});
 const cases=categorized.review.map(item=>{
  const source=byUrl.get(item.source),target=byUrl.get(item.ultimateOriginal);
  const sourceRecord=records.get(item.source),targetRecord=records.get(item.ultimateOriginal);
  const sourceMembers=(source?.node[13]||[]).map(v=>v[1]);
  const targetMembers=(target?.node[13]||[]).map(v=>v[1]);
  const rootHostname=(()=>{try{return new URL(item.ultimateOriginal).hostname}catch{return null}})();
  const competing=sourceMembers.filter(url=>{try{return new URL(url).hostname===rootHostname&&url!==item.ultimateOriginal}catch{return false}});
  const sourceClaims=(sourceRecord?.originalSources||[]).filter(x=>x.method==='credit_original_label');
  const targetClaims=(targetRecord?.originalSources||[]).filter(x=>x.method==='credit_original_label');
  const sourceTitles=[...new Set(sourceMembers.map(u=>records.get(u)?.title).filter(Boolean))];
  const targetTitles=[...new Set(targetMembers.map(u=>records.get(u)?.title).filter(Boolean))];
  const notes=[];
  let classification='証拠不足';
  let recommendedAction='保留。出版社の一次資料を照合';
  if(item.category==='explicit_original_work_split') {
   notes.push('明示された原作と現在の作品IDが分裂');
   recommendedAction='原作・翻訳両方の出典と作品内容を確認してから統合を検討';
  } else if(item.category==='explicit_original_vs_native_work_collision') {
   notes.push('原作サイトの別記事が現在の翻訳側ノードに所属');
   recommendedAction='同番号の独立作品を識別し、誤統合を先に検証';
  } else if(item.category==='credited_original_absent_from_catalog') {
   notes.push('原作URLの公式カタログ登録がない');
   recommendedAction='旧版・退役・移転・404/403・API取得を確認。欠番から統合しない';
  } else notes.push('原作クレジットの循環または深さ制限');
  // Existing evidence is suggestive, not conclusive; do not upgrade automatically.
  if(sourceClaims.length>1)notes.push('複数の原作クレジット断片');
  if(!targetRecord)notes.push('原作の収集済み本文証拠なし');
  if(competing.length)notes.push('原作ドメインの競合作品URLあり');
  return {source:item.source,creditedOriginal:item.creditedOriginal,resolvedOriginal:item.ultimateOriginal,
   detectedIssue:item.category,classification,sourceWork:item.ownerWork,originalWork:item.originalWork,
   sourceTitle:sourceRecord?.title||null,originalTitle:targetRecord?.title||null,
   sourceContentSha:sourceRecord?.contentSha256||null,originalContentSha:targetRecord?.contentSha256||null,
   sourceCheckedAt:sourceRecord?.checkedAt||null,originalCheckedAt:targetRecord?.checkedAt||null,
   sourceClaimQuotes:sourceClaims.map(x=>x.quote||''),originalClaimQuotes:targetClaims.map(x=>x.quote||''),
   sourceWorkMembers:sourceMembers,targetWorkMembers:targetMembers,
   sourceWorkTitles:sourceTitles,targetWorkTitles:targetTitles,
   competingNativeUrls:competing,chain:item.chain,
   notes,recommendedAction};
 });
 const counts={};for(const row of cases)counts[row.detectedIssue]=(counts[row.detectedIssue]||0)+1;
 const expected=107+43+254;
 return {revision:board.revision,allPages:index.pages.length,explicitPointers:pointers.size,
  count:cases.length,expectedHistorical:expected,historicalCountMayDiffer:true,
  detectedCounts:counts,ambiguous,classes:{'誤統合':0,'誤分裂':0,'正常な別作品':0,'証拠不足':cases.length},cases};
}
function csv(rows,fields){
 const q=value=>'"'+String(Array.isArray(value)?JSON.stringify(value):value??'').replace(/"/g,'""')+'"';
 return [fields.map(q).join(','),...rows.map(row=>fields.map(field=>q(row[field])).join(','))].join('\n')+'\n';
}
function run(out='original-claims-404'){
 const {board}=loadBoard(),raw=readSources(path.resolve('local-data/research-board-sources'));
 const report=candidateReview(board,raw);fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'all-cases.json'),JSON.stringify(report,null,2)+'\n');
 const fields=['source','creditedOriginal','resolvedOriginal','detectedIssue','classification',
  'sourceWork','originalWork','sourceTitle','originalTitle','sourceContentSha','originalContentSha',
  'sourceCheckedAt','originalCheckedAt','competingNativeUrls','sourceWorkMembers',
  'targetWorkMembers','sourceClaimQuotes','originalClaimQuotes','notes','recommendedAction'];
 fs.writeFileSync(path.join(out,'all-cases.csv'),csv(report.cases,fields));
 const summary=[
  '# Original-credit discrepancies: forensic inventory','',
  'Revision: '+report.revision,'Source articles: '+report.allPages,
  'Explicit original pointers: '+report.explicitPointers,'Unresolved credit records: '+report.count,
  'Historical expected: 404 (107 split, 43 collision, 254 absent); independently recomputed below.',
  '','| Mechanically detected category | Count |','| --- | ---: |',
  ...Object.entries(report.detectedCounts).map(([name,n])=>'| '+name+' | '+n+' |'),
  '','No candidate has been automatically promoted to confirmed false merge, false split, or independently valid work.',
  'A different catalog work ID alone is not proof of incorrect identity. A missing catalog entry is not a deleted source.',
  'Russian sources must be checked against the publisher API/FTML rather than assumed HTML.',
  'See all-cases.json for exact work members, direct original credits, titles and saved source hashes.',
  '','## Focus', ...report.cases.filter(x=>/scp-(?:206|2195|1150-j|179)(?:$|\b)/i.test(x.source)).map(x=>
   '- '+x.source+' => '+x.resolvedOriginal+' ('+x.detectedIssue+')')
 ];
 fs.writeFileSync(path.join(out,'REVIEW.md'),summary.join('\n')+'\n');
 // 404 is the historical inventory, not a limit on future catalog updates.
 console.log(JSON.stringify({revision:report.revision,unresolved:report.count,categories:report.detectedCounts,
  classifications:report.classes,ambiguous:report.ambiguous.length},null,2));
}
if(require.main===module)try{run(process.argv[2]||'original-claims-404');}catch(e){console.error(e);process.exitCode=1;}
module.exports={candidateReview,run};
