'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {makeRecord,extractFtml,EXTRACTOR_VERSION,FTML_LINK_VERSION} = require('../research-board/extract');
const related = require('../related-documents');
const base='https://scp-wiki.wikidot.com/';
const html=body=>'<title>SCP-3169</title><div id="page-content"><p>'+ 'Narrative article content. '.repeat(10)+'</p>'+body+'</div>';
const record=body=>makeRecord(base+'scp-3169',html(body));
const targets=r=>r.links.map(link=>link.target);

test('SCP-3169 author collection is excluded while its narrative Site-196 link survives',()=>{
  const r=record('<p>Acquired by <a href="/scp-7793">Site-196</a>.</p>'+
    '<div class="collection"><div class="collapsible-block"><a class="collapsible-block-link">More&nbsp;From&nbsp;This&nbsp;Author</a>'+
    '<table><tr><th class="articlecolumn"><a href="/poufys-proposal">Poufy\'s Proposal</a><a href="/scp-7793">SPHERE</a></th></tr></table></div></div>');
  assert.deepEqual(targets(r),[base+'scp-7793']);
  assert.equal(r.links[0].quote,'Site-196');
});

test('author collection remains excluded after its toggle heading has already been removed',()=>{
  const r=record('<div class="collection"><table><tr><td class="articlecolumn"><a href="/scp-173">SCP-173</a></td></tr></table></div>');
  assert.deepEqual(r.links,[]);
});

test('ordinary hub lists and generic collections remain valid references',()=>{
  const r=record('<div class="collection"><h2>Collected field reports</h2><div class="list-pages-box"><a href="/scp-173">SCP-173</a></div></div>'+
    '<div class="collapsible-block"><a href="/experiment-log">Actual experiment log</a></div>');
  assert.deepEqual(targets(r),[base+'experiment-log',base+'scp-173']);
});

test('multibranch chooser images are excluded without removing narrative links to the same hub',()=>{
  const r=record('<div class="multibranch-wrapper content-panel centered standalone"><div class="branch"><a href="/canon-hub"><img src="logo.png"></a><a href="/groups-of-interest"><img src="logo.png"></a></div></div>'+
    '<p>Discussed in <a href="/groups-of-interest">Groups of Interest</a>.</p>'+
    '<p><a href="/scp-173"><img src="evidence.png" alt="photographic evidence"></a></p>');
  assert.deepEqual(targets(r),[base+'groups-of-interest',base+'scp-173']);
  assert.equal(r.links[0].quote,'Groups of Interest');
});

test('WARPAINT navbar is excluded without suppressing genuine narrative Site-7 references',()=>{
  const r=record('<p>Recovered at <a href="/secure-facility-dossier-site-7">Site-7</a>.</p>'+
    '<div class="rnb-navbar"><div class="rnb-last"><a href="/airgap">PREVIOUS « AIRGAP »</a></div>'+
    '<a href="/secure-facility-dossier-site-7">SITE-7</a><a href="/humint">NEXT « HUMINT »</a></div>');
  assert.deepEqual(targets(r),[base+'secure-facility-dossier-site-7']);
  assert.equal(r.links[0].quote,'Site-7');
});

test('two-link Previous Page / Next Page pagination is excluded',()=>{
  const r=record('<div class="list-pages-box"><p><a href="/previous-page">Previous Page |</a> <a href="/next-page">Next Page</a></p></div>'+
    '<p>See <a href="/next-to-nothing">Next to Nothing</a> for the experiment.</p>');
  assert.deepEqual(targets(r),[base+'next-to-nothing']);
  const titles=record('<p><a href="/previous-lives">Previous Lives</a> | <a href="/next-to-nothing">Next to Nothing</a></p>');
  assert.equal(titles.links.length,2);
});

test('FTML dedicated UI containers and two-link pagination are excluded',()=>{
  const r=extractFtml({title:'RU',source:'[[div class="rnb-navbar"]][[[airgap|PREVIOUS]]] [[[humint|NEXT]]][[/div]]\n'+
    '[[div class="multibranch-wrapper"]][[[canon-hub]]][[/div]]\n'+
    '[[[previous-page|Previous Page]]] | [[[next-page|Next Page]]]\n'+
    'Experiment with [[[scp-173|SCP-173]]].'},'https://scpfoundation.net/scp-3169');
  assert.deepEqual(targets(r),['https://scpfoundation.net/scp-173']);
  assert.equal(r.linkExtractionVersion,FTML_LINK_VERSION);
});

test('ordinary catalog extraction uses the same auxiliary-content filter',()=>{
  const r=related.extractHtml(base+'scp-3169',html('<div class="collection"><a class="collapsible-block-link">More From This Author</a><a href="/poufys-proposal">Proposal</a></div>'+
    '<p>Containment at <a href="/scp-7793">Site-196</a>.</p>'));
  assert.deepEqual(r.bodyLinks.map(link=>link.target),[base+'scp-7793']);
  assert.equal(r.linkExtractionVersion,EXTRACTOR_VERSION);
  const api=related.extractApi('https://scpfoundation.net/scp-3169',{title:'RU',source:
    '[[div class="rnb-navbar"]][[[airgap]]] [[[humint]]][[/div]]\nExperiment with [[[scp-173]]].'});
  assert.equal(api.linkExtractionVersion,FTML_LINK_VERSION);
  assert.deepEqual(api.bodyLinks.map(link=>link.target),['https://scpfoundation.net/scp-173']);
});
