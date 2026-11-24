'use strict';
// Package a verified publisher-review graph preview without losing any of the
// 125,100 reader catalog pages or any original catalog ID / reading alias.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict');
const {digest}=require('../research-board/extract');
const {loadPublished,ownership}=require('./preview-research-board-origin-fix');
const plan=require('../research-board/reviewed-original-67.json');
function validate(old,next,review){
 const a=ownership(old),b=ownership(next);
 assert.equal(a.owners.size,125100);assert.equal(b.owners.size,125100);
 assert.equal(next.overview.sourcePageCount,125100);
 assert.equal(next.overview.publisherReviewedIdentityCount,67);
 assert(next.overview.publisherReviewedWorkMerges>=55);
 assert.equal(next.nodes.length,old.nodes.length-next.overview.publisherReviewedWorkMerges);
 for(const u of a.owners.keys())assert(b.owners.has(u),'Lost official reader page: '+u);
 const oldAliases=old.nodes.flatMap(n=>n[14][2]).sort();
 const newAliases=next.nodes.flatMap(n=>n[14][2]).sort();
 assert.deepEqual(newAliases,oldAliases,'Any catalog alias was deleted or duplicated');
 const seenProofs=new Set(old.proofs.map(p=>JSON.stringify(p)));
 for(const proof of next.proofs)assert(seenProofs.has(JSON.stringify(proof)),'Newly fabricated link proof');
 for(const rule of plan.rules){
  const x=b.owners.get(rule.source),y=b.owners.get(rule.target);
  assert(x&&y&&x===y,'Uncorrected reviewed translation: '+rule.source);
  if(rule.method==='verified_wrong_original_credit')
   assert.notEqual(x,b.owners.get(rule.creditedOriginal),'Bad publisher credit incorrectly merged: '+rule.source);
 }
 assert.equal(review.pairs.length,43);
 for(const [source,original] of review.pairs){
  assert(b.owners.has(source)&&b.owners.has(original),'A distinct article was lost');
  assert.notEqual(b.owners.get(source),b.owners.get(original),
    'Independent edition or separate work was merged: '+source);
 }
 assert.equal(next.hiddenRetiredPageUrls.length,45);
 assert.equal(next.overview.hiddenRetiredPageCount,45);
 assert.equal(next.overview.hiddenRetiredWorkCount,next.hiddenRetiredNodeIds.length);
 assert.equal(next.overview.originalAbsentVisibilityPolicy,
  'hide_work_from_visualization_keep_catalog_v1');
 assert.equal(next.overview.retiredArticleVisibilityPolicy,
  'hide_publisher_withdrawn_pages_preserve_live_versions_v1');
 assert.equal(next.overview.hiddenOriginalUnavailableWorkCount,next.hiddenOriginalUnavailableNodeIds.length);
 return {reviewed:67,merged:next.overview.publisherReviewedWorkMerges,
  oldNodes:old.nodes.length,newNodes:next.nodes.length,
  oldEdges:old.edges.length,newEdges:next.edges.length};
}
function run(preview,reviewFile){
 const file=path.join(preview,'preview-board.json.gz');
 const next=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
 const old=loadPublished('local-data').board;
 const review=JSON.parse(fs.readFileSync(reviewFile));
 const summary=validate(old,next,review);
 const raw=Buffer.from(JSON.stringify(next)),compressed=zlib.gzipSync(raw,{level:9}),
  sha=digest(compressed),name='board-'+sha+'.json.gz';
 assert(raw.length<160*1024*1024&&compressed.length<32*1024*1024);
 const directory='local-data/mobile-v3/research-board';
 const manifest={schemaVersion:3,revision:next.revision,timestamp:next.overview.generatedAt,
  fileName:name,bytes:compressed.length,decodedBytes:raw.length,sha256:sha,
  nodeCount:next.nodes.length,edgeCount:next.edges.length};
 fs.writeFileSync(path.join(directory,name),compressed);
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest)+'\n');
 console.log(JSON.stringify({manifest,summary},null,2));
}
if(require.main===module)try{
 run(process.argv[2]||'preview-all-67-reviewed',
  process.argv[3]||'research-board/reviewed-distinct-43.json');
}catch(e){console.error(e);process.exitCode=1}
module.exports={run,validate};
