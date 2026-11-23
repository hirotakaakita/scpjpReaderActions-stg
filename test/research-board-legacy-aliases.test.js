'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {applyLegacyWorkAliases}=require('../research-board/legacy-work-aliases');
test('reviewed origin repairs retain historical keys without changing the current work',()=>{
 const url='https://scp-wiki.wikidot.com/scp-509';
 const node={id:'catalog:scp-series:scp-series-509',versions:[['en',url]],workKeys:['catalog:scp-series:scp-series-509']};
 const migration={alias:'catalog:scp-series-pig:scp-series-509',url};
 applyLegacyWorkAliases([node],[migration,migration]);
 assert.equal(node.id,'catalog:scp-series:scp-series-509');
 assert.deepEqual(node.workKeys,['catalog:scp-series-pig:scp-series-509','catalog:scp-series:scp-series-509']);
 const other={id:'other',versions:[['en','https://scp-wiki.wikidot.com/scp-510']],workKeys:[migration.alias]};
 assert.throws(()=>applyLegacyWorkAliases([node,other],[migration]),/conflicting owners/);
 assert.doesNotThrow(()=>applyLegacyWorkAliases([],[migration]));
});
