'use strict';
// Evidence-based PRIORITY suggestions, not final publisher certification.
// Never use this report to automatically reassign a work ID.
const fs=require('node:fs'),path=require('node:path');
const NOTICE='https://scp-wiki.wikidot.com/bright-works-message';
const OTHER_TITLES=new Set(['ブライト関連作品に関するお知らせ','Bright Works Message','STAFF PLACEHOLDER']);
function evaluate(x){
 let proposed='証拠不足',basis='Publisher and content identity not yet independently confirmed';
 if(x.resolvedOriginal===NOTICE&&x.sourceTitle==='ブライト関連作品に関するお知らせ'){
  const distinct=x.sourceWorkTitles.filter(t=>!OTHER_TITLES.has(t));
  if(distinct.length){proposed='誤統合';basis='Retirement/notice page currently shares a work with distinct historical article titles';}
  else{proposed='誤分裂';basis='Publisher-credited Japanese notice is isolated from the original notice work';}
 }else if(x.detectedIssue==='explicit_original_work_split'&&
          x.source.startsWith('https://scp-int.wikidot.com/unofficial:')&&
          x.originalWork&&!x.competingNativeUrls.length){
  proposed='誤分裂';basis='Unofficial-language translation explicitly credits a catalogued original with no same-site rival';
 }else if(x.detectedIssue==='explicit_original_work_split'&&
          /-arc(?:$|\b)/i.test(x.source)&&!/-arc(?:$|\b)/i.test(x.resolvedOriginal)){
  proposed='正常な別作品';basis='Archived ARC variant has its own URL and title, distinct from current numbered article';
 }else if(x.detectedIssue==='explicit_original_vs_native_work_collision'&&
          /(?:experiment-log|testing-log)/i.test(x.source)){
  proposed='正常な別作品';basis='Supplemental experiment/testing-log document points to its parent SCP but is not the same article';
 }
 return {...x,proposedClassification:proposed,reviewBasis:basis,
   verifiedByPublisher:false,automaticGraphCorrectionAllowed:false,
   remainingChecks:proposed==='証拠不足'?
     'Read the credited original, source article and any competing native work':
     'Confirm article body/provenance against publisher and verify all versions before data migration'};
}
function csv(rows,fields){
 const q=v=>'"'+String(Array.isArray(v)?JSON.stringify(v):v??'').replace(/"/g,'""')+'"';
 return [fields.map(q).join(','),...rows.map(x=>fields.map(f=>q(x[f])).join(','))].join('\n')+'\n';
}
function run(input,out){
 const r=JSON.parse(fs.readFileSync(input,'utf8'));
 // Display-only metadata can change the graph revision without changing
 // these source-credit cases. Validate the inventory, not its old revision.
 if(!Number.isInteger(r.count)||!Array.isArray(r.cases)||r.cases.length!==r.count)
   throw Error('Unexpected candidate count');
 const rows=r.cases.map(evaluate),counts={};
 for(const c of rows)counts[c.proposedClassification]=(counts[c.proposedClassification]||0)+1;
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'triage.json'),JSON.stringify({revision:r.revision,
  caveat:'Provisional evidence-based triage, not a validated correction list',
  count:rows.length,counts,rows},null,2)+'\n');
 fs.writeFileSync(path.join(out,'triage.csv'),csv(rows,['source','creditedOriginal','resolvedOriginal',
  'detectedIssue','proposedClassification','reviewBasis','verifiedByPublisher','sourceWork',
  'originalWork','sourceTitle','originalTitle','sourceWorkMembers','targetWorkMembers',
  'sourceContentSha','originalContentSha','competingNativeUrls','remainingChecks']));
 fs.writeFileSync(path.join(out,'SUMMARY.md'),[
  '# '+r.count+' original-credit cases: provisional four-way triage','',
  'Revision: '+r.revision,'Total: '+rows.length,
  '','| Provisional classification | Cases |','| --- | ---: |',
  ...Object.entries(counts).map(([k,v])=>'| '+k+' | '+v+' |'),
  '','**None of these labels authorizes automatic work-ID migration.**',
  'Direct original credits can point from supplemental documents to main articles.',
  'Retired Bright material and unofficial translations require publisher-body checking.',
  'Russian publisher evidence requires API/FTML handling, not an HTML assumption.',
  'Existing catalog IDs, reading aliases and relation proofs were not changed.'
 ].join('\n')+'\n');
 console.log(JSON.stringify({count:rows.length,counts},null,2));
}
if(require.main===module)try{run(process.argv[2]||'original-claims-404/all-cases.json',
 process.argv[3]||'original-claims-404');}catch(e){console.error(e);process.exitCode=1;}
module.exports={evaluate,run};
