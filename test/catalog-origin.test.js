'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {resolveOrigin,publisherDefaultOrigin}=require('../catalog-origin');
const {originHint,parseIndex}=require('../catalog-indexes');
const {buildIndexedCatalog}=require('../merge-catalog-indexes');
const unknown={branch:null,basis:'insufficient_origin_evidence',evidence:[]};
const resolve=(tags,evidence,fallback=unknown)=>resolveOrigin({tags},evidence,fallback,originHint);
test('article provenance overrides conflicting or incorrect index origins',()=>{
 const fallback={branch:'jp',basis:'publisher_origin_tag',evidence:['jp']};
 assert.equal(resolve(['jp'],[{source:'https://scp-jp.wikidot.com/foundation-tales-jp',origin:'pl'}],fallback).branch,'jp');
 assert.equal(resolve(['jp','en'],[],{branch:null,basis:'conflicting_origin_tags'}).branch,null);
});
test('native English collections do not classify translations by hosting site',()=>{
 const en=[{source:'https://scp-wiki.wikidot.com/foundation-tales',origin:'pl',section:'Other stories'}];
 assert.equal(resolve(['tale'],en).branch,'en');
 assert.equal(resolve(['translated'],en).branch,null);
 assert.equal(resolve(['tale'],[{source:'https://scp-wiki-cn.wikidot.com/foundation-tales'}]).branch,null);
 assert.equal(resolve(['tale'],en,{branch:'jp',basis:'publisher_origin_tag'}).branch,'jp');
 assert.equal(resolve(['tale'],[{source:'https://scp-wiki.wikidot.com/foundation-tales-audio-edition'}]).branch,null);
});
test('invalid URL suffixes and inherited heading origins are not branch evidence',()=>{
 assert.equal(originHint('https://scp-wiki-cn.wikidot.com/log-of-anomalous-items-cn'),'cn');
 assert.equal(originHint('https://scp-wiki-cn.wikidot.com/log-of-anomalous-items'),null);
 for(const name of ['foundation-tales-arc','canon-hub','foundation-tales-unofficial'])assert.equal(originHint('https://scpko.wikidot.com/'+name),null);
 assert.equal(resolve([], [{source:'https://scpko.wikidot.com/foundation-tales-arc',origin:'arc'}]).branch,null);
 assert.equal(resolve([], [{source:'https://scp-jp.wikidot.com/a-hub',origin:'pl',section:'Other works'}]).branch,null);
 assert.equal(resolve([], [{source:'https://scp-jp.wikidot.com/a-hub',origin:'pl',section:'SCP-PL'}]).branch,'pl');
});
test('index heading scope resets for sibling sections and is preserved for subsections',()=>{
 const html='<div id="page-content"><h2>SCP-PL</h2><ul><li><a href="/a">a</a></li></ul><h3>More</h3><ul><li><a href="/b">b</a></li></ul><h2>Other stories</h2><ul><li><a href="/c">c</a></li></ul></div>';
 const result=parseIndex(html,{url:'https://scp-jp.wikidot.com/foundation-tales-jp',kind:'tale'},new Set());
 assert.deepEqual(result.members.map(m=>m.origin),['pl','pl','jp']);
});
test('explicit cross-site translation metadata uses already collected records and preserves item IDs',()=>{
 const en='https://scp-wiki.wikidot.com/original',jp='https://scp-jp.wikidot.com/translated';
 const record=(url,tags,translations=[])=>({url,title:'Work',tags,translations,checkedAt:'2026-11-08T00:00:00Z',contentSha256:'a'.repeat(64),availabilityVersion:1,descriptionExcerpt:'Body'});
 const state=(url,rec,source)=>({indexes:{x:{members:[{url,source,kind:'tale'}]}},records:{[url]:rec},attempts:{}});
 const result=buildIndexedCatalog([],{en:state(en,record(en,['jp']),'https://scp-wiki.wikidot.com/foundation-tales'),jp:state(jp,record(jp,['tale'],[en]),'https://scp-jp.wikidot.com/foundation-tales')},{data:[{url:jp,itemId:'document-existing',language:'jp'}]});
 const row=result.data.find(r=>r.url===jp);assert.equal(row.pageType,'related-document-jp');assert.equal(row.itemId,'document-existing');
});
const {classify}=require('../related-documents');
const infer=(url,tags)=>classify(url,new Map([[url,{url,tags,translations:[]}]]),new Map());
test('publisher native tags are scoped to the actual site, not translated by text similarity',()=>{
 assert.equal(infer('https://scp-wiki-cn.wikidot.com/story',['原创','故事']).branch,'cn');
 assert.equal(infer('https://scp-zh-tr.wikidot.com/story',['原創','故事']).branch,'zh');
 assert.equal(infer('https://scp-jp.wikidot.com/story',['原创']).branch,null);
 assert.equal(infer('https://scp-wiki-cn.wikidot.com/story',['原创','jp','故事']).basis,'conflicting_origin_tags');
});
test('EN hidden language tags identify the original branch without treating international as INT',()=>{
 assert.equal(infer('https://scp-wiki.wikidot.com/story',['international','_jp','tale']).branch,'jp');
 assert.equal(infer('https://scp-wiki.wikidot.com/story',['international','_ms','tale']).basis,'unsupported_origin_tag');
 assert.equal(infer('https://scp-wiki.wikidot.com/story',['international','tale']).branch,null);
 assert.equal(infer('https://scp-jp.wikidot.com/story',['_jp']).branch,null);
});
test('documented publisher defaults require fiction tags and do not apply to unsupported or secondary translations',()=>{
 const url='https://scp-wiki-cn.wikidot.com/story';
 assert.equal(infer(url,['故事']).branch,'en');
 assert.equal(infer(url,['故事']).basis,'publisher_default_origin');
 for(const tags of [[],['fragment'],['故事','二次翻译'],['故事','tr']])assert.equal(infer(url,tags).branch,null);
 assert.equal(infer('https://scp-vn.wikidot.com/story',['tale']).branch,null);
 assert.equal(infer('https://scp-wiki.wikidot.com/026-exploration-logs',['supplement']).branch,'en');
 assert.equal(infer('https://scp-wiki-de.wikidot.com/story',['übersetzt','geschichte']).branch,'en');
 assert.equal(infer('https://scp-wiki-de.wikidot.com/story',['übersetzt','fr']).branch,'fr');
 assert.equal(infer('https://scp-wiki-de.wikidot.com/story',['geschichte']).branch,null);
 assert.equal(publisherDefaultOrigin(url,{tags:['故事'],translations:['https://scp-int.wikidot.com/unknown']}),null);
});
