'use strict';
const reviewed=require('./reviewed-work-aliases.json');

// Historical board work keys are reading-state identities. Reviewed metadata
// repairs may merge a work, but must retain each previously published key.
function applyLegacyWorkAliases(nodes,entries=reviewed.entries){
 const byUrl=new Map(nodes.flatMap(n=>n.versions.map(v=>[v[1],n])));
 const owners=new Map(nodes.flatMap(n=>n.workKeys.map(k=>[k,n])));
 for(const {alias,url} of entries){
  if(typeof alias!=='string'||!alias.startsWith('catalog:')||typeof url!=='string')throw Error('Invalid reviewed work alias');
  const node=byUrl.get(url);if(!node)continue; // A withdrawn catalog page is not resurrected.
  const owner=owners.get(alias);
  if(owner&&owner!==node)throw Error('Historical work alias has conflicting owners: '+alias);
  if(!owner){node.workKeys.push(alias);node.workKeys.sort();owners.set(alias,node);}
 }
 return nodes;
}
module.exports={applyLegacyWorkAliases};
