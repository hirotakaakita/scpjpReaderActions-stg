'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { normalizePage, digest } = require('./extract');
const { pageKind } = require('./semantics');
const { readSources, importDirectory, saveSources } = require('./source-store');
const { starLayout } = require('./layout.cjs');
const { regionLayout } = require('./regions.cjs');
const { warpLayout } = require('./warp.cjs');
const { classifyNodes } = require('./classification');
const { collapseWorks } = require('./works');
const { LANGUAGES } = require('../languages');
const KINDS = ['scp', 'log', 'hub', 'tale', 'organization', 'document', 'goi', 'setting'];

function buildBoard(catalogs, sources) {
  const pages = new Map(), candidates = [], catalogEntries = new Map();
  function page(url) {
    const identity = normalizePage(url);
    if (!identity) return null;
    if (!pages.has(identity.id)) pages.set(identity.id, { ...identity, siteBranch: identity.branch, title: identity.slug, coverage: 'unfetched' });
    return pages.get(identity.id);
  }
  for (const catalog of catalogs) for (const row of catalog.data) {
    const node = page(row.isTranslatedJP !== false && row.urlJP ? row.urlJP : row.urlEN);
    if (node && (catalog.language === node.branch || node.title === node.slug)) {
      node.title = row.titleJP || node.slug; node.catalogTitle = node.title;
    }
    if (node) {
      if (!catalogEntries.has(node.id)) catalogEntries.set(node.id, []);
      catalogEntries.get(node.id).push({ language: catalog.language, pageType: row.pageType, itemId: row.itemId, articleNumber: row.numericItemId, contentType: row.contentType });
    }
  }
  const catalogPageIds = new Set(pages.keys());
  // Evidence may connect catalog members, never discover new catalog articles.
  function catalogPage(url) {
    const identity = normalizePage(url);
    return identity && catalogPageIds.has(identity.id) ? pages.get(identity.id) : null;
  }
  for (const state of sources.values()) {
    const r = state.record;
    const source = catalogPage(r?.url || state.url);
    if (!source) continue;
    const terminal = ['not_found', 'not_article', 'unavailable'].includes(state.lastAttempt?.status);
    if (!r) { source.coverage = terminal ? 'missing' : 'failed'; continue; }
    source.title = r.title || source.title;
    source.coverage = terminal ? 'missing' : r.limitations?.includes('legacy_unchecked_links') ? 'unfetched' :
      state.lastAttempt?.status !== 'success' && state.lastAttempt?.status !== 'not_modified' ? 'stale' : 'fetched';
    source.pageKind = pageKind(source, r);
    // A failed new observation cannot keep old assertions as current relations.
    if (source.coverage !== 'fetched') continue;
    for (const [baseType, items] of [['translation_assertion', r.translations],
      ...Object.entries(Object.groupBy(r.semanticRelations || [], x => x.type))]) {
      for (const item of items || []) {
        if (!['translation_assertion','co_appearance','hostile_to','member_of','canon_member','same_canon','experiment','sequel','created_by','contains_document'].includes(baseType)) continue;
        const semantic = baseType !== 'translation_assertion';
        if (semantic && !['source_specific_exact_quote', 'explicit_canon_breadcrumb'].includes(item.method)) continue;
        let target;
        if (item.targetEntity) continue; // No synthetic or uncollected article nodes.
        target = catalogPage(item.target);
        const subject = item.subject ? catalogPage(item.subject) : source;
        if (!target || !subject || target.id === subject.id) continue;
        const type = baseType === 'references' ? (item.section?.kind === 'addendum' ? 'appears_in_addendum' :
          source.pageKind.type === 'log' ? 'appears_in_log' : 'references') : baseType;
        const proof = [r.url, item.quote || '', item.section?.title ? `${item.location} / ${item.section.title}` : item.location || '',
          r.contentSha256, item.sourceAnchor || '', item.note || '', r.checkedAt];
        candidates.push({ source: subject.id, target: target.id, type, proof });
      }
    }
  }
  const sourcePages = [...pages.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  classifyNodes(sourcePages, sources, catalogEntries);
  sourcePages.forEach(n => {
    const entries = catalogEntries.get(n.id) || [];
    const own = entries.find(e => e.language === n.siteBranch) || entries[0];
    const category = own?.contentType;
    const kind = {record:'log',log:'log',hub:'hub',tale:'tale',goi:'goi',setting:'setting'}[category];
    n.kindIndex = n.classificationSourceId ? 4 : n.pageType && !n.pageType.startsWith('related-document-') ? 0 : Math.max(0, KINDS.indexOf(kind || (n.pageKind || pageKind(n)).type));
  });
  const collapsed = collapseWorks(sourcePages, candidates, catalogEntries);
  const { nodes, sourcePageCount, internalReferences } = collapsed;
  const relations = collapsed.relations.filter(edge => edge.type !== 'translation_assertion');
  nodes.forEach((n, index) => { n.index = index; });
  const byId = new Map(nodes.map(n => [n.id, n]));
  const neighbors = nodes.map(() => new Set());
  for (const e of relations) {
    const a = byId.get(e.source).index, b = byId.get(e.target).index;
    neighbors[a].add(b); neighbors[b].add(a);
  }
  if (!nodes.length) throw Error('Empty research board');
  const { groups, sections, trunks } = starLayout(nodes, neighbors);
  regionLayout(groups, sections);
  const { warp, width, height } = warpLayout(nodes, groups, sections);
  const tileSize = 320, tileKeys = new Set(), points = new Map();
  const compact = nodes.map(n => {
    tileKeys.add(`${Math.floor(n.x / tileSize)}_${Math.floor(n.y / tileSize)}`);
    const key = `${n.branch}:${Math.floor(n.x / 180)}:${Math.floor(n.y / 180)}`;
    if (!points.has(key)) points.set(key, [n.x, n.y, 0, n.branch, n.kindIndex]);
    points.get(key)[2]++;
    return [n.index, n.x, n.y, n.kindIndex, n.slug, n.title, n.url, n.coverage, n.branch, n.degree, n.section, n.siteBranch, n.pageType, n.versions, [n.id, n.articleId, n.workKeys]];
  });
  const types = [...new Set(relations.map(e => e.type))].sort(), proofs = [], proofIds = new Map();
  const edges = relations.map(e => {
    const ids = e.proofs.map(proof => {
      const key = JSON.stringify(proof);
      if (!proofIds.has(key)) { proofIds.set(key, proofs.length); proofs.push(proof); }
      return proofIds.get(key);
    });
    return [byId.get(e.source).index, byId.get(e.target).index, types.indexOf(e.type), ids[0], ids];
  });
  const generatedAt = [...catalogs.map(c => c.timestamp), ...[...sources.values()].map(s => s.record?.checkedAt).filter(Boolean)].sort().at(-1);
  const overview = { schemaVersion: 3, generatedAt, pageCount: nodes.filter(n => !n.classificationSourceId).length,
    identity: 'ledger_work', sourcePageCount, internalReferences,
    nodeCount: nodes.length, edgeCount: edges.length, tileSize, width, height, geometryWarp: warp, sections,
    trunks: trunks.map(([a,b]) => [nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, a, b]),
    branches: groups.map(b => ({ code: b.code, x: b.left, y: b.top, width: b.width, height: b.height,
      count: b.nodes.length, lanes: b.lanes, polygon: b.polygon })),
    points: [...points.values()], branchLinks: [], aggregateLinks: [], tiles: [...tileKeys], kinds: KINDS, types,
    classification: 'reading_record_page_type', membership: 'official_index_catalog_v3', linkPolicy: 'excluded_verified_semantics_only',
    classificationCounts: Object.fromEntries([...new Set(nodes.map(n => n.classificationBasis))].sort()
      .map(basis => [basis, nodes.filter(n => n.classificationBasis === basis).length])),
    semanticCoverage: 'partial_source_specific_only', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' };
  const content = { schemaVersion: 3, overview, nodes: compact, edges, proofs };
  const revision = digest(JSON.stringify(content)).slice(0, 20);
  return { ...content, revision, overview: { ...overview, revision } };
}

function loadCatalogs(input) {
  return Object.keys(LANGUAGES).sort().flatMap(language => {
    const directory = path.join(input, 'mobile-v3', language);
    const pointer = path.join(directory, 'manifest.json');
    if (fs.existsSync(pointer)) {
      const manifest = JSON.parse(fs.readFileSync(pointer));
      if (!/^catalog-[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)) throw Error('Invalid v3 catalog pointer');
      const bytes = fs.readFileSync(path.join(directory, manifest.fileName));
      if (digest(bytes) !== manifest.sha256 || bytes.length !== manifest.bytes) throw Error('Invalid v3 catalog checksum');
      const catalog = JSON.parse(zlib.gunzipSync(bytes));
      if (catalog.language !== language || catalog.totalCount !== catalog.data.length) throw Error('Invalid v3 catalog');
      return [catalog];
    }
    return [];
  });
}

function generateResearchBoard(input, output, { incoming = path.join(input, '../partial-data/related-documents/research-board'), seed } = {}) {
  const sourceDir = path.join(input, 'research-board-sources');
  const sources = readSources(sourceDir);
  if (seed) importDirectory(sources, seed);
  importDirectory(sources, incoming);
  const catalogs = loadCatalogs(input);
  require('./catalog-sources').importCatalogSources(sources, input, catalogs);
  // The user explicitly excludes mutual hyperlinks from this feature.
  for (const state of sources.values()) if (state.record) state.record.links = [];
  const board = buildBoard(catalogs, sources);
  const json = Buffer.from(JSON.stringify(board)), bytes = zlib.gzipSync(json, { level: 9 });
  if (json.length > 160 * 1024 * 1024 || bytes.length > 32 * 1024 * 1024) throw Error('Research board client size limit exceeded');
  const sha256 = digest(bytes), fileName = `board-${sha256}.json.gz`;
  const directory = path.join(output, 'research-board');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, fileName), bytes);
  const manifest = { schemaVersion: 3, revision: board.revision, timestamp: board.overview.generatedAt,
    fileName, bytes: bytes.length, decodedBytes: json.length, sha256,
    nodeCount: board.nodes.length, edgeCount: board.edges.length };
  saveSources(sources, sourceDir);
  fs.writeFileSync(path.join(directory, 'manifest.json.tmp'), JSON.stringify(manifest) + '\n');
  fs.renameSync(path.join(directory, 'manifest.json.tmp'), path.join(directory, 'manifest.json'));
  // Retain the last published payload so a cached pointer can still be used.
  const prior = fs.readdirSync(directory).filter(n => /^board-[a-f0-9]{64}\.json\.gz$/.test(n) && n !== fileName)
    .sort((a,b) => fs.statSync(path.join(directory,b)).mtimeMs - fs.statSync(path.join(directory,a)).mtimeMs);
  for (const name of prior.slice(1)) fs.unlinkSync(path.join(directory, name));
  return manifest;
}
module.exports = { buildBoard, generateResearchBoard, loadCatalogs };
