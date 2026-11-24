'use strict';
// Read-only 150-case publisher-source adjudication. Never auto-migrate works.
const fs=require('node:fs'),path=require('node:path');
const distinct=new Set(('fondationscp.wikidot.com/scp-1507 lafundacionscp.wikidot.com/scp-es-046 lafundacionscp.wikidot.com/scp-es-047 lafundacionscp.wikidot.com/scp-es-075 scp-cs.wikidot.com/continuous-integration scp-cs.wikidot.com/hod3-respite scp-cs.wikidot.com/pattern-breaker scp-cs.wikidot.com/scp-315-a scp-int.wikidot.com/scp-2002-ru-j scp-int.wikidot.com/scp-2784-jp scp-jp.wikidot.com/old:scp-8045 scp-wiki-cn.wikidot.com/049-x-minion-x-reader scp-wiki-cn.wikidot.com/scp-2002-ru-j scp-wiki-cn.wikidot.com/scp-cn-1867 scp-wiki.wikidot.com/scp-705-fr scp-zh-tr.wikidot.com/defence scp-zh-tr.wikidot.com/scp-8472-ex scp-zh-tr.wikidot.com/scp-999-jp-enneametric').split(' ').map(s=>'https://'+s));
const split=new Set(('scp-cs.wikidot.com/scp-2350 scp-cs.wikidot.com/scp-9044 scp-jp.wikidot.com/scp-173-but-it-s-the-admonition-hub scp-vn.wikidot.com/4x4x4-cell scp-vn.wikidot.com/scp-2195 scp-vn.wikidot.com/scp-2195-ru scp-vn.wikidot.com/scp-2470 scp-vn.wikidot.com/scp-5814 scp-vn.wikidot.com/scp-7166 scp-vn.wikidot.com/scp-7231 scp-wiki-cn.wikidot.com/cierpienia-noworoczne scp-wiki-cn.wikidot.com/scp-002-ir scp-wiki-de.wikidot.com/a-calculated-risk scp-wiki-de.wikidot.com/scp-1216 scp-wiki-de.wikidot.com/scp-1289 scp-wiki-de.wikidot.com/scp-1414 scp-wiki-de.wikidot.com/scp-1667 scp-wiki-de.wikidot.com/scp-1696 scp-wiki-de.wikidot.com/scp-1699 scp-wiki-de.wikidot.com/scp-1814 scp-wiki-de.wikidot.com/scp-1916 scp-wiki-de.wikidot.com/scp-1925 scp-wiki-de.wikidot.com/scp-4194 scp-wiki-de.wikidot.com/scp-490 scp-wiki-de.wikidot.com/scp-813 scp-wiki-de.wikidot.com/scp-9027 scp-wiki-de.wikidot.com/scp-eo-416 scp-wiki-de.wikidot.com/scp-pl-kot-j scp-wiki.wikidot.com/scp-2195 scp-wiki.wikidot.com/scp-5814 scp-zh-tr.wikidot.com/groups-of-interest-es scp-zh-tr.wikidot.com/i-am-the-organisation scp-zh-tr.wikidot.com/scp-807 scp-zh-tr.wikidot.com/scp-885 scpko.wikidot.com/scp-6470').split(' ').map(s=>'https://'+s));
const isolated=new Set('blinddate dr-bright-s-personnel-file heretherebe nothingtoseehere serrasbadday whatislove'.split(' '));
function adjudicate(all){
 const cases=all.cases||[];
 if(cases.length!==150||all.currentRevision!=='d1382687d7f5adaf7389')
  throw Error('Not the expected published 150-case graph');
 const notices=cases.filter(x=>x.structuralGroup==='publisher_retirement_notice');
 if(notices.length!==40||new Set(notices.map(x=>x.sourceNow?.bodyHash)).size!==1)
  throw Error('Forty Japanese retired pages no longer have identical current article bodies');
 const used=new Set(),rows=[];
 for(const c of cases){
  const u=c.source,s=c.sourceNow,o=c.originalNow,g=c.structuralGroup;
  if(!s?.ok||!o?.ok||!s.bodyHash||!o.bodyHash||!c.sourceContentSha256||!c.originalContentSha256)
   throw Error('Missing current primary-source corroboration: '+u);
  let label,reason;
  if(g==='publisher_retirement_notice'){
   if(s.title!=='ブライト関連作品に関するお知らせ'||o.title!=='Bright Works Message')throw Error('Publisher notice text changed '+u);
   const mixed=(c.sourceWorkTitles||[]).filter(t=>!['ブライト関連作品に関するお知らせ','Bright Works Message','STAFF PLACEHOLDER'].includes(t));
   if(isolated.has(new URL(u).pathname.slice(1))){
    if(mixed.length)throw Error('Isolated notice acquired historical title '+u);
    label='誤分裂';reason='All six isolated Japanese staff notices have the same published body as the other notice aliases and explicitly credit the English notice.';
   }else{
    if(!mixed.length)throw Error('Historical-title contamination disappeared '+u);
    label='誤統合';reason='The current staff retirement notice is assigned to a node still containing a distinct historical article.';
   }
  }else if(g==='archived_variant'){
   if(!/-arc(?:$|[-/])/.test(u)||/-arc(?:$|[-/])/.test(c.original))throw Error('ARC identity not preserved '+u);
   label='正常な別作品';reason='The publisher preserves the ARC publication as a separate archived edition from the current article.';
  }else if(g==='supplemental_log'){
   label='正常な別作品';reason='Publisher experiment/testing log is a separately published supplement, not its parent SCP article.';
  }else if(g==='unofficial_language_translation'){
   if(!u.startsWith('https://scp-int.wikidot.com/unofficial:'))throw Error('Not an unofficial language incubator article');
   if(u==='https://scp-int.wikidot.com/unofficial:isv:scp-963'){
    if(o.title!=='Bright Works Message')throw Error('Retired original no longer same staff notice');
    label='正常な別作品';reason='Historical SCP-963 translation and the current Bright retirement notice contain different works.';
   }else{
    label='誤分裂';reason='The publisher language-incubator page states its original credit and supplies an alternate language publication of the same work.';
   }
  }else if(distinct.has(u)){
   used.add(u);label='正常な別作品';reason='Manual comparison of the two original publisher article bodies establishes different stories, supplements or rewritten editions.';
  }else if(split.has(u)){
   used.add(u);label='誤分裂';reason='Manual publisher article comparison finds the same translated original, narrative, distinctive containment measures, images or a documented mistaken credit.';
  }else if(g.startsWith('verified_')){
   label=c.classification;reason=c.basis;
   if(!['誤分裂','正常な別作品'].includes(label))throw Error('Verified override lost '+u);
  }else throw Error('Unreviewed source missing an individual decision: '+u);
  rows.push({source:u,creditedOriginal:c.original,sourceWork:c.sourceWork,originalWork:c.originalWork,
   detectedIssue:c.detectedIssue,group:g,classification:label,reason,
   sourceTitle:s.title,originalTitle:o.title,sourceBodySha256:s.bodyHash,originalBodySha256:o.bodyHash,
   capturedSourceSha256:c.sourceContentSha256,capturedOriginalSha256:c.originalContentSha256,
   sourceWorkMembers:c.sourceWorkMemberUrls,originalWorkMembers:c.originalWorkMemberUrls,
   automaticGraphRewriteAllowed:false});
 }
 if(used.size!==distinct.size+split.size)throw Error('Incomplete 53 case-reviewed source coverage: '+used.size);
 if(new Set(rows.map(x=>x.source)).size!==150)throw Error('Duplicate source in adjudication');
 const counts={};for(const r of rows)counts[r.classification]=(counts[r.classification]||0)+1;
 if(counts['誤統合']!==34||counts['誤分裂']!==73||counts['正常な別作品']!==43)
  throw Error('Publisher evidence/dispositions changed: '+JSON.stringify(counts));
 return {revision:all.currentRevision,examinedPublisherUrls:all.captured,caseCount:150,counts,
  caveat:'Final source/content identity review, NOT a validated graph repair. Never rewrite original publisher claims based only on translated prose.',
  rows:rows.sort((a,b)=>a.source.localeCompare(b.source,'en'))};
}
function run(input,out){
 const report=adjudicate(JSON.parse(fs.readFileSync(input,'utf8')));
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'FINAL-150.json'),JSON.stringify(report,null,2)+'\n');
 const columns=['source','creditedOriginal','classification','reason','sourceWork','originalWork',
  'sourceTitle','originalTitle','sourceBodySha256','originalBodySha256','capturedSourceSha256','capturedOriginalSha256'];
 const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 fs.writeFileSync(path.join(out,'FINAL-150.csv'),[columns.map(q).join(','),
  ...report.rows.map(row=>columns.map(k=>q(row[k])).join(','))].join('\n')+'\n');
 fs.writeFileSync(path.join(out,'FINAL-150.md'),[
  '# 150 current publisher work-identity discrepancies: complete review','',
  'Board revision: '+report.revision,'Publisher URLs inspected: '+report.examinedPublisherUrls,
  'Final case coverage: 150 / 150','False merges: 34','False splits: 73',
  'Separate valid works/editions: 43','Unclassified: 0','',
  'This investigation is evidence-only. No board or catalog data is mutated.',
  'These source/content verdicts are distinct from graph repair CI; no legacy migration is needed before first release.'
 ].join('\n')+'\n');
 console.log(JSON.stringify({cases:report.caseCount,counts:report.counts,publisherUrls:report.examinedPublisherUrls}));
}
if(require.main===module)try{run(process.argv[2]||'original-claims-150/deep-primary-source-excerpts.json',
 process.argv[3]||'original-claims-150');}catch(e){console.error(e);process.exitCode=1}
module.exports={adjudicate,run};
