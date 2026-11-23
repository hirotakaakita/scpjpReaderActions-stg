'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict');
const {loadPublished,ownership,edges}=require('./preview-research-board-origin-fix');
function run(dir){
 const base=path.resolve(dir);
 const before=loadPublished('local-data').board;
 const after=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(base,'preview-board.json.gz'))));
 const a=ownership(before),b=ownership(after);
 const root='https://scpfoundation.net/scp-1138',
       unrelated='https://scpfoundation.net/scp-1138-ru',
       bookId='catalog:scp-series:scp-series-1138',
       otherId='catalog:scp-series-ru:scp-series-1138-ru';
 const expected=[
  'https://scp-wiki.wikidot.com/scp-1138',
  'https://scp-wiki-cn.wikidot.com/scp-1138',
  'https://scp-vn.wikidot.com/scp-1138',
  'https://scp-pt-br.wikidot.com/scp-1138'
 ];
 // After publication this workflow also verifies a deterministic no-op
 // rebuild. Only the already-correct published membership permits zero moves.
 const publishedBook=a.versions.get(bookId)?.map(v=>v[1])||[];
 const alreadyPublished=expected.every(url=>a.owners.get(url)===bookId)&&
   publishedBook.length===11&&a.versions.get(otherId)?.length===1&&
   a.owners.get(unrelated)===otherId;
 const move=[];
 for(const [url,old] of a.owners)if(b.owners.get(url)!==old)
   move.push({url,before:old,after:b.owners.get(url)||null});
 const oldEdges=edges(before),newEdges=edges(after);
 const removed=[...oldEdges].filter(([key])=>!newEdges.has(key)).map(([,v])=>v);
 const added=[...newEdges].filter(([key])=>!oldEdges.has(key)).map(([,v])=>v);
 const inspected=new Set([bookId,otherId]);
 const unrelatedEdges=[...removed,...added].filter(x=>!inspected.has(x.source)&&!inspected.has(x.target));
 const report={from:before.revision,to:after.revision,pagesOld:a.owners.size,pagesNew:b.owners.size,
   nodesOld:before.nodes.length,nodesNew:after.nodes.length,
   edgesOld:before.edges.length,edgesNew:after.edges.length,
   moved:move,edgeRemoved:removed.length,edgeAdded:added.length,
   unrelatedEdgeChanges:unrelatedEdges,
   rootWork:b.owners.get(root),nativeOtherWork:b.owners.get(unrelated),
   bookPages:b.versions.get(bookId)?.map(v=>v[1])||[],
   unrelatedPages:b.versions.get(otherId)?.map(v=>v[1])||[],
   formerIdsUnchanged:[bookId,otherId].every(id=>a.nodes.has(id)&&b.nodes.has(id))
 };
 fs.writeFileSync(path.join(base,'RUSSIAN_1138_ACCEPTANCE.json'),JSON.stringify(report,null,2)+'\n');
 assert.equal(report.pagesNew,report.pagesOld,'Official catalog URLs changed');
 assert.equal(report.rootWork,bookId);
 assert.equal(report.nativeOtherWork,otherId);
 assert(report.formerIdsUnchanged,'Old catalog work IDs missing');
 assert.deepEqual(move.map(x=>x.url).sort(),alreadyPublished?[]:expected.slice().sort(),
   'Unexpected article reassignment beyond verified Book of Letters translations');
 if(alreadyPublished){
   assert.equal(after.revision,before.revision,'Published rebuild changed revision');
   assert.equal(removed.length+added.length,0,'Published rebuild changed edges');
 }
 assert(move.every(x=>x.before===otherId&&x.after===bookId),'Incorrect source-work move');
 assert.deepEqual(report.bookPages.slice().sort(),[
   root,'https://fondationscp.wikidot.com/scp-1138','https://lafundacionscp.wikidot.com/scp-1138',
   'https://scp-jp.wikidot.com/scp-1138','https://scp-pl.wikidot.com/scp-1138',
   'https://scp-wiki-de.wikidot.com/scp-1138','https://scpko.wikidot.com/scp-1138',
   ...expected].sort(),'Unverified Book of Letters members');
 assert.deepEqual(report.unrelatedPages,[unrelated],'Native RU Live Broadcast must remain an isolated original');
 assert.equal(unrelatedEdges.length,0,'Unrelated graph edge changes');
 console.log(JSON.stringify(report,null,2));
}
if(require.main===module)try{run(process.argv[2]||'russian-scp1138-preview');}
catch(e){console.error(e);process.exitCode=1;}
module.exports={run};
