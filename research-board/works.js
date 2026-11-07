'use strict';
const { branchForPageType } = require('./classification');
const {native}=require('./translation-identities');

// Ledger identity, not a bare SCP number. Each variant/proposal and branch
// namespace keeps its own itemId. Unverified document translations stay apart.
function collapseWorks(pages, candidates, catalogEntries) {
  const pageKeys = new Map(), ledger = new Map(), aliases = new Map(), equivalentKeys = [];
  for (const page of pages) {
    const entries = (catalogEntries.get(page.id) || []).filter(e => e.itemId &&
      e.pageType && branchForPageType(e.pageType) === page.branch);
    const own = entries.filter(e => e.language === page.siteBranch);
    const eligible = own.length ? own : entries;
    const keys = [...new Set(eligible.map(e => `catalog:${e.pageType}:${e.itemId}`))];
    if (keys.length >= 1) {
      keys.sort();
      const key = keys[0];
      for (const entry of eligible) ledger.set(`catalog:${entry.pageType}:${entry.itemId}`, {
        articleId:entry.itemId, articleNumber:entry.articleNumber, pageType:entry.pageType, branch:page.branch,
      });
      if (keys.length > 1) equivalentKeys.push(keys);
      pageKeys.set(page.id, key);
      const alias = `${page.branch}\0${page.slug}`;
      if (!aliases.has(alias)) aliases.set(alias, new Set());
      aliases.get(alias).add(key);
    }
  }
  for (const page of pages) if (!pageKeys.has(page.id)) {
    const known = aliases.get(`${page.branch}\0${page.slug}`);
    if (!page.classificationSourceId && page.kindIndex === 0 && page.branch !== 'other') {
      if (known?.size === 1) pageKeys.set(page.id, [...known][0]);
      else if (!known && page.classificationBasis === 'scp_identifier') pageKeys.set(page.id,
        `identifier:${page.branch}:${page.pageType}:${page.slug}`);
    }
    if (!pageKeys.has(page.id)) pageKeys.set(page.id, page.id);
  }

  const parent = new Map([...pageKeys.values(), ...ledger.keys()].map(key => [key, key]));
  function root(key) {
    const previous = parent.get(key);
    if (previous === key) return key;
    const found = root(previous); parent.set(key, found); return found;
  }
  // Two catalog IDs explicitly pointing at the exact same page are aliases,
  // without changing either ID or any saved reading record in the app.
  for (const keys of equivalentKeys) for (const key of keys.slice(1)) {
    const a = root(keys[0]), b = root(key);
    if (a !== b) parent.set([a,b].sort()[1], [a,b].sort()[0]);
  }
  const byPage = new Map(pages.map(p => [p.id, p]));
  const claims=new Map(),blockedSources=new Set();
  for(const edge of candidates)if(edge.type==='translation_assertion'){
    const target=byPage.get(edge.target),key=edge.source+'\0'+target.siteBranch;
    if(!claims.has(key))claims.set(key,new Set());claims.get(key).add(target.id);
    if(claims.get(key).size>1)blockedSources.add(edge.source);
  }
  const components=new Map(),nativeKeys=new Set(),identityProofs=[],identityReview=[];
  for(const page of pages){
    const key=root(pageKeys.get(page.id));
    if(!components.has(key))components.set(key,new Set());components.get(key).add(page.id);
    if(native(page))nativeKeys.add(key);
  }
  for (const edge of candidates) if (edge.type === 'translation_assertion') {
    if(blockedSources.has(edge.source)){identityReview.push({url:byPage.get(edge.source).url,original:byPage.get(edge.target).url,reason:'conflicting_translation_targets'});continue;}
    const a = root(pageKeys.get(edge.source)), b = root(pageKeys.get(edge.target));
    const source = byPage.get(edge.source), target = byPage.get(edge.target);
    const bothCatalogued = ledger.has(a) && ledger.has(b);
    const explicitDocumentTranslations = bothCatalogued &&
      ledger.get(a).pageType.startsWith('related-document-') &&
      ledger.get(b).pageType.startsWith('related-document-');
    if(a===b)continue;
    if (source.classificationSourceId || target.classificationSourceId ||
        (bothCatalogued && !explicitDocumentTranslations) || source.siteBranch === target.siteBranch ||
        (source.branch !== 'other' && target.branch !== 'other' && source.branch !== target.branch)) {identityReview.push({url:source.url,original:target.url,reason:'incompatible_translation_scope'});continue;}
    const left=[...(components.get(a)||[])].map(id=>byPage.get(id));
    const right=[...(components.get(b)||[])].map(id=>byPage.get(id));
    // An identity component cannot contain two distinct pages on one site, or
    // acquire incompatible origins through a chain of translation assertions.
    if(left.some(p=>right.some(q=>p.siteBranch===q.siteBranch&&p.id!==q.id))){identityReview.push({url:source.url,original:target.url,reason:'same_site_identity_collision'});continue;}
    const origins=new Set([...left,...right].map(p=>p.branch).filter(b=>b!=='other'));
    if(origins.size>1){identityReview.push({url:source.url,original:target.url,reason:'conflicting_component_origins'});continue;}
    // Prefer a catalog-backed identity over a URL-only identity.
    const first = nativeKeys.has(a)!==nativeKeys.has(b) ? nativeKeys.has(a)?a:b : bothCatalogued ? [a,b].sort()[0] : ledger.has(a) ? a : ledger.has(b) ? b : [a, b].sort()[0];
    const second=first===a?b:a;
    parent.set(second,first);
    components.set(first,new Set([...(components.get(a)||[]),...(components.get(b)||[])]));components.delete(second);
    if(nativeKeys.has(a)||nativeKeys.has(b))nativeKeys.add(first);
    identityProofs.push({source:source.url,target:target.url,method:edge.proof?.[5]||edge.proof?.[2]||'explicit_translation_metadata'});
  }

  const groups = new Map();
  for (const page of pages) {
    const key = root(pageKeys.get(page.id));
    pageKeys.set(page.id, key);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(page);
  }
  const nodes = [];
  for (const [key, versions] of groups) {
    const info = ledger.get(key);
    versions.sort((a, b) => Number(native(b)&&b.branch === (info?.branch || b.branch)) -
      Number(native(a)&&a.branch === (info?.branch || a.branch)) ||
      Number(b.coverage === 'fetched') - Number(a.coverage === 'fetched') || a.id.localeCompare(b.id, 'en'));
    const representative = versions[0];
    const pageVersions = versions.map(p => [p.siteBranch, p.url, p.slug,
      p.catalogTitle || p.title || p.slug, p.coverage]);
    nodes.push({ ...representative, id: key, articleId: info?.articleId || '', articleNumber: info?.articleNumber,
      branch: info?.branch || representative.branch,
      pageType: info?.pageType || representative.pageType,
      title: representative.catalogTitle || representative.title,
      coverage: versions.some(p => p.coverage === 'fetched') ? 'fetched' : representative.coverage,
      workKeys: [...new Set(versions.flatMap(p => (catalogEntries.get(p.id) || []).map(e => `catalog:${e.pageType}:${e.itemId}`)).filter(k => ledger.has(k) && root(k) === key))].sort(),
      versions: pageVersions });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id, 'en'));

  const relations = new Map();
  let internalReferences = 0;
  for (const edge of candidates) {
    const source = pageKeys.get(edge.source), target = pageKeys.get(edge.target);
    if (!source || !target) throw Error('Unknown work endpoint');
    if (source === target) { internalReferences++; continue; }
    const key = `${source}\0${edge.type}\0${target}`;
    if (!relations.has(key)) relations.set(key, { source, target, type: edge.type, proofs: new Map() });
    relations.get(key).proofs.set(JSON.stringify(edge.proof), edge.proof);
  }
  return { nodes, identityProofs, identityReview, sourcePageCount: pages.filter(p => !p.classificationSourceId).length, internalReferences,
    relations: [...relations.values()].map(e => ({ ...e, proofs: [...e.proofs].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([, proof]) => proof) }))
      .sort((a, b) => `${a.source}\0${a.type}\0${a.target}`.localeCompare(`${b.source}\0${b.type}\0${b.target}`, 'en')) };
}
module.exports = { collapseWorks };
