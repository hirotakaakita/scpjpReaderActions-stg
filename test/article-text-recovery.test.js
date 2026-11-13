'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const axios=require('axios');
const {fetchRecord,articleFetchTarget}=require('../related-documents');
const {recoverReport}=require('../tool/article-text-recovery');
const {VERSION}=require('../article-excerpts');
const url='https://scpko.wikidot.com/scp-1047-j';
test('a listing redirect reads the owned original page and never borrows the list body',async t=>{
 const calls=[];t.mock.method(axios,'get',async target=>{
  calls.push(target);if(target===url)return {status:301,headers:{location:'http://ko.scp-wiki.net/joke-scps'}};
  assert.equal(target,url+'/noredirect/true');return {status:200,data:'<div id="page-title">SCP-1047-J</div><div id="page-content"><div class="error-block">리다이렉트 모듈입니다.</div><p><span class="printuser">TroyL</span>이 창작하였습니다.</p><div class="ko-footer">댓글 보기</div></div><div class="page-tags"><a>농담</a><a>scp</a></div>'};
 });
 const record=await fetchRecord(url);assert.equal(record.title,'SCP-1047-J');assert.equal(record.descriptionExcerpt,'');assert.equal(record.descriptionStatus,'redirect_only');assert.equal(record.url,url);
 assert.deepEqual(calls,[url,url+'/noredirect/true']);
 assert.equal(articleFetchTarget('https://evil.example/scp-1047-j/noredirect/true'),null);
 assert.equal(articleFetchTarget(url+'/noredirect/true'),url+'/noredirect/true');
});
test('one fresh source observation recovers both failed cache variants only for the approved run',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'article-recovery-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'local-data'));
 const record={url,language:'ko',title:'SCP-1047-J',descriptionExcerpt:'',descriptionStatus:'redirect_only',redirectTarget:'http://ko.scp-wiki.net/joke-scps',descriptionVersion:VERSION,availabilityVersion:1,contentSha256:'a'.repeat(64),checkedAt:'2026-11-13T08:00:00Z'};
 fs.writeFileSync(path.join(root,'local-data/article-text-recovery.json'),JSON.stringify({schemaVersion:1,runId:'approved',repository:'owner/stg',observations:[{expectedFailureReason:'Unsupported redirect',record}]}));
 const failure={url,reason:'Unsupported redirect'},make=()=>({language:'ko',at:'2026-11-13T07:00:00Z',failed:[{...failure},{...failure}],pending:[]});
 let report=make();assert.equal(recoverReport(root,report,{runId:'other',repository:'owner/stg'}).records.size,0);assert.equal(report.failed.length,2);
 const result=recoverReport(root,report,{runId:'approved',repository:'owner/stg'});assert.equal(result.records.size,1);assert.equal(report.failed.length,0);assert.equal(report.recoveredFailures.length,2);
 report=make();report.failed.push({url:'https://scpko.wikidot.com/unrelated',reason:'timeout'});recoverReport(root,report,{runId:'approved',repository:'owner/stg'});assert.deepEqual(report.failed,[{url:'https://scpko.wikidot.com/unrelated',reason:'timeout'}]);
});
