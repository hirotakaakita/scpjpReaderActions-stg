'use strict';
// Compares two immutable published board revisions' publisher-credit
// provenance. Report-only: never silently merge pages by title/slug.
const fs=require('node:fs'),path=require('node:path');
const {loadBoard,buildIndex}=require('../research-board/verification/audit');
const {readSources}=require('../research-board/source-store');
const {normalizePage}=require('../research-board/extract');
const {originalPage}=require('../origin-provenance');
function derive(input,previous,index,sources){
  const oldReview=new Map(previous.cases.map(x=>[x.source,x]));
  const nextReview=new Map(input.cases.map(x=>[x.source,x]));
  const sourcesUnion=new Set([...oldReview.keys(),...nextReview.keys()]);
  const changes=[],stillOutstanding=[];
  const byUrl=new Map();
  for(const node of index.board.nodes)for(const version of node[13]){
    if(byUrl.has(version[1]))throw Error('Duplicate URL '+version[1]);
    byUrl.set(version[1],{node,version});
  }
  function report(old,newer,source){
    const owner=byUrl.get(source),target=newer&&byUrl.get(newer.ultimateOriginal);
    const state=sources.get(normalizePage(source)?.id),record=state?.record;
    const raw=(record?.originalSources||[]).filter(x=>x.method==='credit_original_label');
    const claims=[...new Set(raw.map(c=>originalPage(c.url)?.url).filter(Boolean))];
    return {
      source,
      statusBefore:old?.disposition||'same_work_or_not_recorded',
      statusAfter:newer?.disposition||'same_work_or_not_recorded',
      categoryBefore:old?.category||'same_work_or_not_recorded',
      categoryAfter:newer?.category||'same_work_or_not_recorded',
      previousSourceWork:old?.ownerWork||null,
      newSourceWork:owner?.node[14][0]||null,
      creditedOriginal:newer?.creditedOriginal||old?.creditedOriginal||claims.join(' | '),
      resolvedOriginal:newer?.ultimateOriginal||old?.ultimateOriginal||null,
      newTargetWork:target?.node[14][0]||null,
      sourceBranch:owner?.node[8]||null,
      sourcePageType:owner?.node[12]||null,
      sourceTitle:owner?.node[5]||null,
      targetTitle:target?.node[5]||null,
      sameSiteTargets:newer?.sameSiteTargets||[],
      sourceWorkMembers:owner?.node[13].map(v=>v[1])||[],
      targetWorkMembers:target?.node[13].map(v=>v[1])||[],
      claimText:raw.map(c=>c.quote||'').join(' | ').slice(0,300),
      sourceHash:record?.contentSha256||null,
      checkedAt:record?.checkedAt||null
    };
  }
  for(const source of sourcesUnion){
    const old=oldReview.get(source),now=nextReview.get(source);
    const r=report(old,now,source);
    if(r.statusBefore!==r.statusAfter||r.categoryBefore!==r.categoryAfter||
       r.previousSourceWork!==r.newSourceWork)changes.push(r);
    if(now)stillOutstanding.push(r);
  }
  const beforeCounts=previous.counts,afterCounts=input.counts;
  const keys=[...new Set([...Object.keys(beforeCounts),...Object.keys(afterCounts)])].sort();
  const states={};
  for(const key of keys)states[key]={before:beforeCounts[key]||0,after:afterCounts[key]||0};
  const priorities=stillOutstanding.filter(x=>
    /scp-wiki\.wikidot\.com\/scp-(?:1138|206|2195|1150-j)$/.test(x.source)||
    /scp-vn\.wikidot\.com\/(?:scp-179|scp-es-026)$/.test(x.source)||
    /scp-179$/.test(x.source)).sort((a,b)=>a.source.localeCompare(b.source));
  return {revisionBefore:previous.revision,revisionAfter:input.revision,
    prevOriginalClaims:previous.explicitSourceCount,newOriginalClaims:input.explicitSourceCount,
    beforeCounts,afterCounts,categoryChangeCount:changes.length,
    unresolvedCaseCount:stillOutstanding.length,ambiguousCount:input.ambiguous.length,
    categoryTransitions:states,changes,stillOutstanding,priorities};
}
function csv(rows,fields){
 const q=x=>'"'+String(Array.isArray(x)?x.join(' | '):x??'').replace(/"/g,'""')+'"';
 return [fields.map(q).join(','),...rows.map(x=>fields.map(f=>q(x[f])).join(','))].join('\n')+'\n';
}
function run(newPath,oldPath,out){
 const newer=JSON.parse(fs.readFileSync(newPath)),previous=JSON.parse(fs.readFileSync(oldPath));
 const index=buildIndex(loadBoard().board),board=loadBoard().board;
 index.board=board;
 if(board.revision!==newer.revision)throw Error('Current board is not the expected review revision');
 const sources=readSources('local-data/research-board-sources');
 const r=derive(newer,previous,index,sources);
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'SUMMARY.json'),JSON.stringify({
  revisionBefore:r.revisionBefore,revisionAfter:r.revisionAfter,
  oldClaims:r.prevOriginalClaims,newClaims:r.newOriginalClaims,
  classificationChanges:r.categoryChangeCount,
  unresolved:r.unresolvedCaseCount,ambiguous:r.ambiguousCount,
  counts:r.categoryTransitions,
  highPriority:r.priorities.map(x=>({source:x.source,category:x.categoryAfter,
    original:x.resolvedOriginal,work:x.newSourceWork,originalWork:x.newTargetWork}))
 },null,2)+'\n');
 const fields=['source','statusBefore','statusAfter','categoryBefore','categoryAfter',
  'previousSourceWork','newSourceWork','creditedOriginal','resolvedOriginal','newTargetWork',
  'sourceBranch','sourcePageType','sourceTitle','targetTitle','sameSiteTargets',
  'claimText','sourceHash','checkedAt','sourceWorkMembers','targetWorkMembers'];
 fs.writeFileSync(path.join(out,'PR6_IDENTITY_CHANGES.csv'),csv(r.changes,fields));
 fs.writeFileSync(path.join(out,'ALL_OUTSTANDING_ORIGINAL_CLAIMS.csv'),csv(r.stillOutstanding,fields));
 fs.writeFileSync(path.join(out,'HIGH_PRIORITY_ORIGINALS.json'),JSON.stringify(r.priorities,null,2)+'\n');
 fs.writeFileSync(path.join(out,'REVIEW.md'),[
  '# Original credit review after PR #6','',
  'Historical revision: '+r.revisionBefore,
  'New revision: '+r.revisionAfter,
  'Stored unique source-credit claims: '+r.prevOriginalClaims+' → '+r.newOriginalClaims,
  'Disposition/work-key changes: '+r.categoryChangeCount,
  'Outstanding cases: '+r.unresolvedCaseCount,
  'Multiple-original ambiguities: '+r.ambiguousCount,'',
  '| Classification | Prior | Current |','| --- | ---: | ---: |',
  ...Object.entries(r.categoryTransitions).map(([n,v])=>'| '+n+' | '+v.before+' | '+v.after+' |'),
  '','## Representative original-credit risk cases',
  ...r.priorities.map(x=>'- '+x.source+' — '+x.categoryAfter+'; native '+x.resolvedOriginal+
    '; source work '+x.newSourceWork+'; credited work '+x.newTargetWork),
  '','Evidence includes the exact saved original-credit source hash and quote.',
  'No uncertain source identity is automatically merged or newly cataloged.'
 ].join('\n')+'\n');
 console.log(JSON.stringify({before:r.revisionBefore,after:r.revisionAfter,
  oldClaims:r.prevOriginalClaims,newClaims:r.newOriginalClaims,
  changes:r.categoryChangeCount,unresolved:r.unresolvedCaseCount,
  counts:r.categoryTransitions,priorities:r.priorities.map(x=>({source:x.source,
    sourceWork:x.newSourceWork,originalWork:x.newTargetWork,category:x.categoryAfter}))},null,2));
 return r;
}
if(require.main===module)try{run(path.resolve(process.argv[2]),
  path.resolve(process.argv[3]),path.resolve(process.argv[4]||'postmerge-origin-comparison'));}
catch(e){console.error(e);process.exitCode=1;}
module.exports={derive,run};
