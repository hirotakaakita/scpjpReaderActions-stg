'use strict';
// Produce a frozen, fail-closed repair manifest from the audited publisher
// source bodies (2026-11-24, board revision d1382687...). Intended for the
// unreleased research board, not for mutation of publisher source documents.
const fs=require('node:fs'),path=require('node:path');
function build(audit,deep){
 if(audit.caseCount!==150||audit.revision!=='d1382687d7f5adaf7389'||
   audit.counts['誤分裂']!==73||audit.counts['誤統合']!==34||audit.counts['正常な別作品']!==43)
  throw Error('Published 150-case audit inputs do not match');
 if(deep.cases.length!==150||deep.currentRevision!==audit.revision)throw Error('Missing 150 publisher captures');
 const bySource=new Map(deep.cases.map(c=>[c.source,c]));
 const wrongOriginalCredits=[];
 const rules=[];
 for(const row of audit.rows.filter(r=>r.classification==='誤分裂')){
  if(row.creditedOriginal==='https://scp-wiki.wikidot.com/bright-works-message')continue;
  const source=new URL(row.source),publishedClaim=new URL(row.creditedOriginal);
  const wrong=['scp-cs.wikidot.com','scp-wiki-de.wikidot.com','scp-zh-tr.wikidot.com'].includes(source.hostname)&&
   publishedClaim.hostname==='scp-wiki.wikidot.com'&&
   /^\/scp-\d+$/.test(source.pathname)&&/^\/scp-\d+$/.test(publishedClaim.pathname)&&
   source.pathname!==publishedClaim.pathname;
  const target=wrong?'https://scp-wiki.wikidot.com'+source.pathname:row.creditedOriginal;
  const capture=bySource.get(row.source);
  if(!capture?.sourceNow?.ok||!capture.originalNow?.ok||
    (wrong&&(!capture.sameNumberEnglishNow?.ok||capture.sameNumberEnglishNow.url!==target))||
    !/^[a-f0-9]{64}$/.test(row.capturedSourceSha256)||
    !/^[a-f0-9]{64}$/.test(row.sourceBodySha256))
    throw Error('Missing independent primary-source evidence: '+row.source);
  rules.push({source:row.source,target,sourceSha256:row.capturedSourceSha256,
    publisherBodySha256:row.sourceBodySha256,creditedOriginal:row.creditedOriginal,
    method:wrong?'verified_wrong_original_credit':'reviewed_publisher_story_equivalence'});
  if(wrong)wrongOriginalCredits.push(row.source);
 }
 if(rules.length!==67||wrongOriginalCredits.length!==18||
   new Set(rules.map(r=>r.source)).size!==67)
  throw Error('Incomplete reviewed publisher work set '+rules.length+' / bad credits '+wrongOriginalCredits.length);
 return {schemaVersion:1,reviewedBoardRevision:audit.revision,
  provenance:'CI artifact 14885124475 from validated 150-case publisher audit (run 45316009381)',
  originalAuditCount:150,retiredNoticeSkipped:6,workIdentityCases:67,
  wrongPublisherCreditCases:18,
  rules:rules.sort((a,b)=>a.source.localeCompare(b.source,'en'))};
}
if(require.main===module)try{
 const out=process.argv[2]||'research-board/reviewed-original-67.json',dir=process.argv[3]||'original-150-artifact';
 const audit=JSON.parse(fs.readFileSync(path.join(dir,'FINAL-150.json'))),
  deep=JSON.parse(fs.readFileSync(path.join(dir,'deep-primary-source-excerpts.json')));
 const manifest=build(audit,deep);
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({rules:manifest.rules.length,wrongCreditCases:manifest.wrongPublisherCreditCases,
  ignoredRetirementNotices:manifest.retiredNoticeSkipped,output:out},null,2));
}catch(e){console.error(e);process.exitCode=1}
module.exports={build};
