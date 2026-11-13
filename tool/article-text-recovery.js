'use strict';
const fs=require('node:fs'),path=require('node:path');
const {normalize}=require('../related-documents');
const {VERSION,repairStoredExcerpt,titleNeedsRepair}=require('../article-excerpts');
// Recovery observations are scoped to one already-running workflow. They do not
// waive failures and cannot become a permanent exemption from weekly fetching.
function recoverReport(root,report,{runId=process.env.GITHUB_RUN_ID,repository=process.env.GITHUB_REPOSITORY}={}){
 const records=new Map(),file=path.join(root,'local-data/article-text-recovery.json');
 if(!runId||!fs.existsSync(file))return {records,changed:false};
 const recovery=JSON.parse(fs.readFileSync(file,'utf8'));
 if(recovery.schemaVersion!==1||recovery.runId!==String(runId)||recovery.repository!==repository)return {records,changed:false};
 for(const observation of recovery.observations||[]){
  const r=observation.record,page=normalize(r?.url);if(page?.language!==report.language)continue;
  const emptyVerified=r.descriptionStatus==='redirect_only'&&r.redirectTarget;
  if(!page||page.url!==r.url||r.descriptionVersion!==VERSION||!r.availabilityVersion||titleNeedsRepair(r.title)||typeof r.descriptionExcerpt!=='string'||(!r.descriptionExcerpt&&!emptyVerified)||repairStoredExcerpt(r.descriptionExcerpt).needsFetch||!/^[a-f0-9]{64}$/.test(r.contentSha256||'')||!(Date.parse(r.checkedAt)>Date.parse(report.at)))throw Error('Invalid article recovery observation: '+r?.url);
  records.set(page.url,{record:r,reason:observation.expectedFailureReason});
 }
 const recovered=(report.failed||[]).filter(f=>records.get(normalize(f.url)?.url)?.reason===f.reason);
 if(!recovered.length)return {records:new Map(),changed:false};
 const allowed=new Set(recovered.map(f=>normalize(f.url).url));
 for(const url of records.keys())if(!allowed.has(url))records.delete(url);
 report.failed=report.failed.filter(f=>!recovered.includes(f));
 report.recoveredFailures=[...(report.recoveredFailures||[]),...recovered];
 report.recoveredArticles=[...records.values()].map(({record:r})=>({url:r.url,title:r.title,descriptionExcerpt:r.descriptionExcerpt,descriptionStatus:r.descriptionStatus,contentSha256:r.contentSha256,checkedAt:r.checkedAt}));
 return {records,changed:true};
}
module.exports={recoverReport};
