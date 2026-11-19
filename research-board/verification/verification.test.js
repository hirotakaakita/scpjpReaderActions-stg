'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizedUrl,fromHtml,fromFtml}=require('./reference');
const {compare,samplePages,allocate,csv}=require('./audit');

const en='https://scp-wiki.wikidot.com/';
const jp='https://scp-jp.wikidot.com/';
function index(){
  const workByUrl=new Map([[en+'scp-001','work:one'],[jp+'scp-001','work:one'],
    [en+'scp-002','work:two'],[jp+'scp-002','work:two'],
    [en+'scp-003','work:three']]);
  return {workByUrl,supportedHosts:new Set(['scp-wiki.wikidot.com','scp-jp.wikidot.com'])};
}
test('normalization strips fragment / allowed tracking, but blocks query operations and external ports',()=>{
  assert.equal(normalizedUrl('http://scpwiki.com/scp-002#note'),en+'scp-002');
  assert.equal(normalizedUrl('/scp-002?utm_source=test',en),en+'scp-002');
  assert.equal(normalizedUrl('/scp-002?action=edit',en),null);
  assert.equal(normalizedUrl('https://scp-wiki.wikidot.com:8443/scp-002'),null);
});
test('independent HTML parser identifies article references, skipping auxiliary and self-work links',()=>{
  const {workByUrl,supportedHosts}=index();
  const html='<div id="page-title">SCP</div><div id="page-content">'+
    '<p><a href="/scp-002">Two</a><a href="/scp-002#appendix">Again</a></p>'+
    '<nav><a href="/scp-003">next</a></nav>'+
    '<div class="licensebox"><a href="/scp-003">credit</a></div>'+
    '<a class="newpage" href="/scp-003">missing</a>'+
    '<div class="translation-source"><a href="'+jp+'scp-001">translated</a></div>'+
    '<p><a href="'+jp+'scp-001">self work</a></p>'+
    '<p><a href="/uncataloged">missing catalog</a></p>'+
    '<a href="#note">self fragment</a></div>';
  const result=fromHtml(html,en+'scp-001',workByUrl,supportedHosts);
  assert.deepEqual([...result.links.keys()],['work:two']);
  assert.equal(result.links.get('work:two').length,2);
  assert.equal(result.counts.outside_catalog,1);
  assert.equal(result.counts.auxiliary_content,3);
  assert.equal(result.counts.same_work,1);
  assert.equal(result.counts.fragment_or_empty,1);
});
test('non-html code/FTML comments ignored, explicit FTML links detected',()=>{
  const {workByUrl,supportedHosts}=index();
  const ftml=[
    '[[[scp-002|Two]]]',
    '[https://scp-wiki.wikidot.com/scp-003 Third]',
    '[!-- [[[scp-003|hidden]]] --]',
    '[[code]] [[[scp-003|code]]] [[/code]]',
    '[[div class="credit"]] [[[scp-003|credit]]] [[/div]]',
    '[[include page:link]]'
  ].join('\n');
  const result=fromFtml(ftml,en+'scp-001',workByUrl,supportedHosts);
  assert.deepEqual([...result.links.keys()],['work:two','work:three']);
  assert.equal(result.counts.auxiliary_content,1);
  assert(result.warnings.includes('ftml_includes_not_expanded'));
});
test('comparison exposes both published-only and missing links',()=>{
  const difference=compare(['work:a','work:b'],['work:b','work:c']);
  assert.deepEqual(difference.tp,['work:b']);
  assert.deepEqual(difference.fp,['work:a']);
  assert.deepEqual(difference.fn,['work:c']);
});
test('deterministic selection, fixed allocation, holdout exclusion and branch coverage',()=>{
  const pages=[];
  for(const [language,n] of [['jp',55],['en',55],['ru',55],['fr',55]]){
    for(let i=0;i<n;i++)pages.push({url:'https://'+language+'.example.com/scp-'+i,
      language,kind:0,workId:language+':'+i,slug:'scp-'+i,versions:i%4===0?2:1,
      expected:new Set(i%3===0?['x','y','z']:[]),review:i%5===0});
  }
  const a=samplePages({pages},{limit:100,seed:'seed'});
  const b=samplePages({pages},{limit:100,seed:'seed'});
  assert.deepEqual(a.pages.map(x=>x.url),b.pages.map(x=>x.url));
  assert.equal(new Set(a.pages.map(x=>x.url)).size,100);
  for(const lang of ['jp','en','ru','fr'])assert(a.pages.some(p=>p.language===lang));
  const c=samplePages({pages},{limit:30,seed:'different',excluded:new Set(a.pages.map(x=>x.url))});
  assert.equal(c.pages.length,30);
  assert(c.pages.every(p=>!a.pages.some(o=>o.url===p.url)));
  assert.equal(Object.values(allocate(500)).reduce((x,y)=>x+y,0),500);
});
test('CSV output preserves quotes and embedded delimiters',()=>{
  assert.equal(csv([{url:'a,b',note:'"quoted"'}],['url','note']),'"url","note"\n"a,b","""quoted"""\n');
});
