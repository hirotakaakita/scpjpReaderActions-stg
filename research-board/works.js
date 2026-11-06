'use strict';
const { branchForPageType } = require('./classification');

// Ledger identity, not a bare SCP number. Each variant/proposal and branch
// namespace keeps its own itemId. Unverified document translations stay apart.
function collapseWorks(pages, candidates, catalogEntries) {
  const pageKeys = new Map(), ledger = new Map(), aliases = new Map();
  for (const page of pages) {
    const available = (catalogEntries.get(page.id) || []).filter(e => e.itemId && e.pageType);
    const classified = available.filter(e => e.pageType !== 'related-document-unclassified' &&
      branchForPageType(e.pageType) === page.branch);
    const entries = classified.length ? classified :
      available.filter(e => e.pageType === 'related-document-unclassified');
    const own = entries.filter(e => e.language === page.siteBranch);
    const eligible = own.length ? own : entries;
    const keys = [...new Set(eligible.map(e => `catalog:${e.pageType}:${e.itemId}`))];
    if (keys.length === 1) {
      const entry = eligible[0], key = keys[0];
      ledger.set(key, { articleId: entry.itemId, articleNumber: entry.articleNumber, pageType: entry.pageType, branch: page.branch });
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

  const parent = new Map([...pageKeys.values()].map(key => [key, key]));
  function root(key) {
    const previous = parent.get(key);
    if (previous === key) return key;
    const found = root(previous); parent.set(key, found); return found;
  }
  const byPage = new Map(pages.map(p => [p.id, p]));
  for (const edge of candidates) if (edge.type === 'translation_assertion') {
    const a = root(pageKeys.get(edge.source)), b = root(pageKeys.get(edge.target));
    const source = byPage.get(edge.source), target = byPage.get(edge.target);
    if (a === b || source.classificationSourceId || target.classificationSourceId ||
        (ledger.has(a) && ledger.has(b)) || source.siteBranch === target.siteBranch ||
        (source.branch !== 'other' && target.branch !== 'other' && source.branch !== target.branch)) continue;
    // Prefer a catalog-backed identity over a URL-only identity.
    const first = ledger.has(a) ? a : ledger.has(b) ? b : [a, b].sort()[0];
    parent.set(first === a ? b : a, first);
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
    versions.sort((a, b) => Number(b.siteBranch === (info?.branch || b.branch)) -
      Number(a.siteBranch === (info?.branch || a.branch)) ||
      Number(b.coverage === 'fetched') - Number(a.coverage === 'fetched') || a.id.localeCompare(b.id, 'en'));
    const representative = versions[0];
    const pageVersions = versions.map(p => [p.siteBranch, p.url, p.slug,
      p.catalogTitle || p.title || p.slug, p.coverage]);
    nodes.push({ ...representative, id: key, articleId: info?.articleId || '', articleNumber: info?.articleNumber,
      branch: info?.branch || representative.branch,
      pageType: info?.pageType || representative.pageType,
      title: representative.catalogTitle || representative.title,
      coverage: versions.some(p => p.coverage === 'fetched') ? 'fetched' : representative.coverage,
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
  return { nodes, sourcePageCount: pages.filter(p => !p.classificationSourceId).length, internalReferences,
    relations: [...relations.values()].map(e => ({ ...e, proofs: [...e.proofs].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([, proof]) => proof) }))
      .sort((a, b) => `${a.source}\0${a.type}\0${a.target}`.localeCompare(`${b.source}\0${b.type}\0${b.target}`, 'en')) };
}
module.exports = { collapseWorks };
