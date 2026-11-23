'use strict';
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict');
function compare(before,after){
 const index=board=>({owners:new Map(board.nodes.flatMap(n=>n[13].map(p=>[p[1],n]))),
   aliases:new Set(board.nodes.flatMap(n=>n[14][2]))});
 const a=index(before),b=index(after);
 assert.deepEqual([...a.owners.keys()].sort(),[...b.owners.keys()].sort(),'Catalog member URLs changed');
 const lostAliases=[...a.aliases].filter(k=>!b.aliases.has(k));assert.equal(lostAliases.length,0,'Lost historical reading aliases');
 const remap=new Map();
 for(const n of before.nodes){
  const owners=new Set(n[13].map(p=>b.owners.get(p[1])[14][0]));
  assert.equal(owners.size,1,'Migration unexpectedly split an existing work');remap.set(n[14][0],[...owners][0]);
 }
 const key=(x,y,type)=>x+'\0'+type+'\0'+y;
 const expected=new Set(before.edges.flatMap(e=>{
  const x=remap.get(before.nodes[e[0]][14][0]),y=remap.get(before.nodes[e[1]][14][0]);
  return x===y?[]:[key(x,y,before.overview.types[e[2]])];
 }));
 const actual=new Set(after.edges.map(e=>key(after.nodes[e[0]][14][0],after.nodes[e[1]][14][0],after.overview.types[e[2]])));
 assert.deepEqual([...expected].sort(),[...actual].sort(),'Reference worksets changed beyond reviewed work merges');
 return {before:before.revision,after:after.revision,memberUrls:a.owners.size,lostAliases:0,
  movedPages:[...a.owners].filter(([url,n])=>b.owners.get(url)[14][0]!==n[14][0]).map(([url,n])=>({url,before:n[14][0],after:b.owners.get(url)[14][0],origin:b.owners.get(url)[8]})),
  nodesBefore:before.nodes.length,nodesAfter:after.nodes.length,edgesBefore:before.edges.length,edgesAfter:after.edges.length,referenceRemapVerified:true};
}
if(require.main===module){
 const read=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p)));
 const result=compare(read(process.argv[2]),read(process.argv[3]));
 if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
module.exports={compare};
