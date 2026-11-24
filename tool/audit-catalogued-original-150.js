'use strict';
// Audits all published explicit-original pointers whose target is catalogued
// but their work identities differ. The source of truth is the CURRENT board,
// not a stale CSV. Classification is a hypothesis unless flagged corroborated.
const fs=require('node:fs'),path=require('node:path');
const {loadBoard}=require('../research-board/verification/audit');
const {readSources}=require('../research-board/source-store');
const {candidateReview}=require('./classify-original-claims-404');
const NOTICE='https://scp-wiki.wikidot.com/bright-works-message';
const OTHER_TITLES=new Set(['ブライト関連作品に関するお知らせ','Bright Works Message','STAFF PLACEHOLDER']);
const REVIEWED_WRONG_CREDITS=new Map([
 ['https://scp-cs.wikidot.com/scp-025',{
   publisherPage:'https://scp-wiki.wikidot.com/scp-025',badOriginal:'https://scp-wiki.wikidot.com/scp-024',
   sourceContentHash:'0bb653eda54b3b84c100eecaa9ecf84db472bae2aa7f44abb6683f095002bb1b',
   explanation:'Publisher credit identifies SCP-024 but both Czech source and English SCP-025 describe the same wooden wardrobe; SCP-024 describes a hazardous game-show studio.'
 }],
 ['https://scp-cs.wikidot.com/scp-590',{
   publisherPage:null,badOriginal:'https://scp-wiki.wikidot.com/scp-500',
   sourceContentHash:'8029e694b7bfe9d8e76b48fb9a1d899ae1af0cc0b026c505be2fea5a62d99a1c',
   retiredOriginal:'https://scp-wiki.wikidot.com/scp-590',
   explanation:'Czech SCP-590 concerns a healing teenage boy; SCP-500 is a container of red curative pills referenced within Czech SCP-590, not its original. The old English SCP-590 has been retired and redirects to Bright Works Message.'
 }],
 ['https://scp-cs.wikidot.com/scp-068',{
   publisherPage:'https://scp-wiki.wikidot.com/scp-068',badOriginal:'https://scp-wiki.wikidot.com/scp-536',
   sourceContentHash:'f5bd46480312ab6b9f507f6c580a7425bd05e66de5ffb9e50161040db9ed6490',
   explanation:'Both Czech source and English SCP-068 describe a self-replicating wire stick figure and use SCP068.jpg; SCP-536 is a physics-constant chamber.'
 }]
]);
function auditCase(x) {
 const sourcePath=new URL(x.source).pathname.toLowerCase();
 const originPath=new URL(x.resolvedOriginal).pathname.toLowerCase();
 const sourceHost=new URL(x.source).hostname;
 const sourceTitles=x.sourceWorkTitles||[];
 const mix=sourceTitles.filter(t=>!OTHER_TITLES.has(t));
 let structuralGroup,classification='証拠不足',decision='hold',basis,confidence='unconfirmed';
 const correctedCredit=REVIEWED_WRONG_CREDITS.get(x.source);
 if(correctedCredit &&
  (correctedCredit.badOriginal!==x.resolvedOriginal || correctedCredit.sourceContentHash!==x.sourceContentSha))
   throw Error('Reviewed publisher exception changed; stop and reverify: '+x.source);
 let hardening='Read independent publisher source and content before allowing graph identity mutation.';
 if(correctedCredit){
  structuralGroup='verified_publisher_credit_error';
  classification=correctedCredit.retiredOriginal?'正常な別作品':'誤分裂';
  decision=correctedCredit.retiredOriginal?
   'do_not_attach_to_referenced_scp500_review_retired_origin_visibility':
   'fix_proven_wrong_credit_and_join_actual_work';
  confidence='independent_publisher_body_crosscheck';
  basis=correctedCredit.explanation;
  hardening='Do not replace the publisher claim in evidence. Correct work identity in a separately tested graph change.';
 }else if(x.resolvedOriginal===NOTICE && x.sourceTitle==='ブライト関連作品に関するお知らせ'){
  structuralGroup='publisher_retirement_notice';
  if(mix.length){
   classification='誤統合';decision='separate_retirement_notice_from_historical_work';
   basis='Current Japanese retirement placeholder is in the same node as historical non-notice titles.';
   confidence='publisher_retirement_documented';
  }else{
   classification='証拠不足';decision='hide_retirement_notice_if_not_an_article';
   basis='Japanese placeholder explicitly credits EN staff message but is not a restored deleted SCP.';
   confidence='publisher_retirement_documented';
  }
  hardening='Official Bright Works Message and Q&A establish deleted/reused slots. Do NOT merge all redirects with one article.';
 }else if(/-arc(?:$|[-/])/.test(sourcePath) && !/-arc(?:$|[-/])/.test(originPath)){
  structuralGroup='archived_variant';
  classification='正常な別作品';decision='keep_separate_archived_version';
  basis='The publisher identifies the archived variant as ARC; the target is the current, unarchived URL.';
  confidence='structural_variant_evidence';
  hardening='Keep separate unless primary-source text establishes identical publication/version.';
 }else if(/(?:experiment-log|testing-log|test-log|testprotokoll)/.test(sourcePath)){
  structuralGroup='supplemental_log';
  classification='正常な別作品';decision='keep_parent_and_supplement_separate';
  basis='An experiment/testing log is a supplementary document with its own article identity, not the object entry.';
  confidence='structural_supplement_evidence';
  hardening='A credit to the parent SCP is not an equivalence claim.';
 }else if(sourceHost==='scp-int.wikidot.com'&&sourcePath.startsWith('/unofficial:')){
  structuralGroup='unofficial_language_translation';
  classification='誤分裂';decision='verify_language_namespace_then_join';
  basis='SCP International Language Incubator namespace and one explicit credited catalog original.';
  confidence='publisher_language_namespace';
  hardening='Use original-credit + language namespace and allow multiple language versions on scp-int, but never join on path alone.';
 }else{
  const originalOnSameSite=(x.competingNativeUrls||[]).length>0;
  const sameSlug=sourcePath===originPath;
  const sourceNumber=/^\/scp-(?:[a-z]{2,5}-)?\d+(?:-[a-z]{2,5})?$/.test(sourcePath);
  structuralGroup=originalOnSameSite?'native_work_collision':sameSlug?'exact_path_split':
    sourceNumber?'numbered_renumbered_translation':'named_or_indirect_origin';
  basis=originalOnSameSite?
   'The current source node already contains a different publisher-native page on the original host.':
   sameSlug?'Publisher-explicit original credit and same URL path, but node identities differ.':
   'Publisher-explicit origin credit conflicts with URL-derived numbering or current work membership.';
  hardening=originalOnSameSite?
   'Compare all members; retain separate native works, repair delivery identity only with content provenance.':
   'Compare publisher original and translated page; exact path/credit alone does not prove same publication.';
 }
 return {
  source:x.source,original:x.resolvedOriginal,sourceTitle:x.sourceTitle,originalTitle:x.originalTitle,
  detectedIssue:x.detectedIssue,structuralGroup,classification,confidence,decision,basis,hardening,
  sourceWork:x.sourceWork,originalWork:x.originalWork,
  sourceWorkMemberUrls:x.sourceWorkMembers,originalWorkMemberUrls:x.targetWorkMembers,
  competingNativeUrls:x.competingNativeUrls,sourceWorkTitles:x.sourceWorkTitles,
  sourceContentSha256:x.sourceContentSha,originalContentSha256:x.originalContentSha,
  sourceCheckedAt:x.sourceCheckedAt,originalCheckedAt:x.originalCheckedAt,
  publisherCreditQuotes:x.sourceClaimQuotes,
  reviewedActualOriginal:correctedCredit?.publisherPage||null,
  reviewedRetiredOriginal:correctedCredit?.retiredOriginal||null,
  publisherCorroboration: correctedCredit?[x.source,correctedCredit.publisherPage||correctedCredit.retiredOriginal,correctedCredit.badOriginal]: x.resolvedOriginal===NOTICE?[
   'https://scp-wiki.wikidot.com/bright-works-message',
   'https://scp-wiki.wikidot.com/forum/t-17573548/discussion-bright-works-project-q-a'
  ]: sourceHost==='scp-int.wikidot.com'&&sourcePath.startsWith('/unofficial:')?[
   'https://scp-int.wikidot.com/unofficial:site-rules',
   'https://scp-int.wikidot.com/unofficial:translation-hub'
  ]:[],
  automaticallyMergeAllowed:false
 };
}
function run(out='original-claims-150'){
 const {board}=loadBoard(),sources=readSources('local-data/research-board-sources');
 const inventory=candidateReview(board,sources);
 const input=inventory.cases.filter(c=>c.detectedIssue==='explicit_original_work_split'||
   c.detectedIssue==='explicit_original_vs_native_work_collision');
 if(input.length!==150)throw Error('Changed source inventory: expected 150, got '+input.length);
 const rows=input.map(auditCase).sort((a,b)=>a.source.localeCompare(b.source,'en'));
 const groups={},classification={},decisions={};
 for(const r of rows){
  groups[r.structuralGroup]=(groups[r.structuralGroup]||0)+1;
  classification[r.classification]=(classification[r.classification]||0)+1;
  decisions[r.decision]=(decisions[r.decision]||0)+1;
 }
 if(rows.length!==Object.values(groups).reduce((a,b)=>a+b,0))throw Error('Coverage lost');
 if(rows.some(r=>!r.sourceContentSha256||!r.originalContentSha256||!r.publisherCreditQuotes.length))
  throw Error('Missing publisher-capture evidence for a candidate');
 const doc={revision:board.revision,total:150,originalSplit:107,nativeCollision:43,
  countsByGroup:groups,provisionalFourWay:classification,dispositions:decisions,
  rules:'Only exact publisher credit is evidence of a citation. Translation equivalence needs independent corroboration. Do not auto-merge.',
  publisherNotice:'Bright Works Message / Q&A explicitly documents removed and redirected historical SCP pages.',
  result:rows};
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'150-case-evidence.json'),JSON.stringify(doc,null,2)+'\n');
 const cols=['source','original','detectedIssue','structuralGroup','classification','confidence',
   'decision','sourceTitle','originalTitle','sourceWork','originalWork','basis','hardening',
   'sourceContentSha256','originalContentSha256','sourceCheckedAt','originalCheckedAt'];
 const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 fs.writeFileSync(path.join(out,'150-case-evidence.csv'),[
  cols.map(csv).join(','),...rows.map(x=>cols.map(c=>csv(x[c])).join(','))
 ].join('\n')+'\n');
 fs.writeFileSync(path.join(out,'SUMMARY.md'),[
  '# 150 catalogued-original discrepancies: publisher-aware evidence audit','',
  'Published board revision: '+board.revision,'Coverage: 150 of 150 (107 splits, 43 native collisions).',
  'All 150 have a collected source hash, collected original hash, and explicit publisher credit quote.','',
  '| Structural group | Cases |','|---|---:|',...Object.entries(groups).map(([k,v])=>'| '+k+' | '+v+' |'),
  '','| Provisional verdict | Cases |','|---|---:|',...Object.entries(classification).map(([k,v])=>'| '+k+' | '+v+' |'),
  '','## Safety','- Publisher credits are not universally identity-equivalence assertions.',
  '- Bright staff notices must never absorb historical deleted articles or vice versa.',
  '- ARC pages and experiment logs are independent catalogued documents.',
  '- Language incubator translations must be checked independently before merging.',
  '- 150 individual source records, both work memberships and SHA-256 evidence are in the JSON/CSV.',
  '- No published graph, catalog IDs, work-node ownership or edges were mutated.',
  '- Labels without actual content equivalence are provisional, not certified work merges.'
 ].join('\n')+'\n');
 console.log(JSON.stringify({revision:board.revision,total:rows.length,groups,classification},null,2));
 return doc;
}
if(require.main===module)try{run(process.argv[2]||'original-claims-150');}
catch(e){console.error(e);process.exitCode=1;}
module.exports={auditCase,run};
