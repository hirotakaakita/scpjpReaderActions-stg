'use strict';
// Convert fully validated, isolated preview into a STG publication candidate.
// This branch-only action leaves master and production untouched until reviewed.
// Does not mutate source captures or article catalogs. Publication is explicit.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict');
const {loadPublished,ownership,edges}=require('./preview-research-board-origin-fix');
function run(dir){
 const old=loadPublished('local-data').board;
 const file=path.resolve(dir,'preview-board.json.gz');
 const next=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
 const oldOwner=ownership(old),newOwner=ownership(next);
 const hidden=next.hiddenOriginalUnavailableNodeIds||[];
 assert.equal(oldOwner.owners.size,125100);
 assert.equal(newOwner.owners.size,oldOwner.owners.size);
 assert.equal(newOwner.nodes.size,oldOwner.nodes.size,'Work count changed');
 assert.equal(new Set(hidden).size,hidden.length,'Duplicate hidden node index');
 assert(hidden.length>0,'Missing visibility exclusions');
 assert(hidden.every(id=>Number.isInteger(id)&&id>=0&&id<next.nodes.length));
 for(const [url,id]of oldOwner.owners)assert.equal(newOwner.owners.get(url),id,'Reassigned catalog URL: '+url);
 const oldAliases=new Set(old.nodes.flatMap(n=>n[14][2]));
 const newAliases=new Set(next.nodes.flatMap(n=>n[14][2]));
 assert.deepEqual([...newAliases].sort(),[...oldAliases].sort(),'Lost a legacy alias');
 const a=edges(old),b=edges(next);
 assert.deepEqual([...b.keys()].sort(),[...a.keys()].sort(),'Graph relations changed');
 assert.equal(old.edges.length,next.edges.length);
 assert.equal(next.overview.hiddenOriginalUnavailableWorkCount,hidden.length);
 assert.equal(next.overview.sourcePageCount,125100);
 assert.equal(next.overview.originalAbsentVisibilityPolicy,
  'hide_work_from_visualization_keep_catalog_v1');
 const manifest=require('../research-board/runtime-delivery').writeDelivery(next,'local-data','local-data/mobile-v3');
 console.log(JSON.stringify({previousRevision:old.revision,newRevision:next.revision,
   hiddenWorks:hidden.length,sourcePages:oldOwner.owners.size,
   nodeCount:next.nodes.length,edgeCount:next.edges.length,sha256:manifest.sha256},null,2));
 return manifest;
}
if(require.main===module)try{run(process.argv[2]||'preview-missing-original-visibility');}
catch(e){console.error(e);process.exitCode=1;}
module.exports={run};