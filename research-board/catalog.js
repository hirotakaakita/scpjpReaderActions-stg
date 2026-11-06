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
const KINDS = ['scp', 'log', 'hub', 'tale', 'organization', 'document'];

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
      catalogEntries.get(node.id).push({ language: catalog.language, pageType: row.pageType, itemId: row.itemId, articleNumber: row.numericItemId });
    }
  }
  for (const state of sources.values()) {
    const r = state.record;
    const source = page(r?.url || state.url);
    if (!source) continue;
    if (!r) { source.coverage = 'failed'; continue; }
    source.title = r.title || source.title;
    source.coverage = state.lastAttempt?.status === 'not_found' ? 'missing' :
      state.lastAttempt?.status !== 'success' && state.lastAttempt?.status !== 'not_modified' ? 'stale' : 'fetched';
    source.pageKind = pageKind(source, r);
    if (source.coverage === 'missing') continue;
    for (const [baseType, items] of [['references', r.links], ['translation_assertion', r.translations],
      ...Object.entries(Object.groupBy(r.semanticRelations || [], x => x.type))]) {
      for (const item of items || []) {
        const semantic = !['references', 'translation_assertion'].includes(baseType);
        if (semantic && !['source_specific_exact_quote', 'explicit_canon_breadcrumb'].includes(item.method)) continue;
        let target;
        if (item.targetEntity && baseType === 'member_of') {
          const entity = item.targetEntity, id = `entity:${source.id}/${entity.key}`;
          if (!/^[a-z0-9-]+$/.test(entity.key)) throw Error('Invalid entity');
          target = { id, slug: entity.title, title: entity.title, url: source.url, branch: source.branch,
            siteBranch: source.siteBranch, classificationSourceId: source.id,
            coverage: source.coverage, pageKind: { type: 'organization' } };
          pages.set(id, target);
        } else target = page(item.target);
        const subject = item.subject ? page(item.subject) : source;
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
  sourcePages.forEach(n => { n.kindIndex = n.pageType && !n.pageType.startsWith('related-document-') ? 0 : Math.max(0, KINDS.indexOf((n.pageKind || pageKind(n)).type)); });
  const { nodes, relations, sourcePageCount, internalReferences } = collapseWorks(sourcePages, candidates, catalogEntries);
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
    return [n.index, n.x, n.y, n.kindIndex, n.slug, n.title, n.url, n.coverage, n.branch, n.degree, n.section, n.siteBranch, n.pageType, n.versions, [n.id, n.articleId]];
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
  const overview = { schemaVersion: 2, generatedAt, pageCount: nodes.filter(n => !n.classificationSourceId).length,
    identity: 'ledger_work', sourcePageCount, internalReferences,
    nodeCount: nodes.length, edgeCount: edges.length, tileSize, width, height, geometryWarp: warp, sections,
    trunks: trunks.map(([a,b]) => [nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, a, b]),
    branches: groups.map(b => ({ code: b.code, x: b.left, y: b.top, width: b.width, height: b.height,
      count: b.nodes.length, lanes: b.lanes, polygon: b.polygon })),
    points: [...points.values()], branchLinks: [], aggregateLinks: [], tiles: [...tileKeys], kinds: KINDS, types,
    classification: 'reading_record_page_type',
    classificationCounts: Object.fromEntries([...new Set(nodes.map(n => n.classificationBasis))].sort()
      .map(basis => [basis, nodes.filter(n => n.classificationBasis === basis).length])),
    semanticCoverage: 'partial_source_specific_only', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' };
  const content = { schemaVersion: 2, overview, nodes: compact, edges, proofs };
  const revision = digest(JSON.stringify(content)).slice(0, 20);
  return { ...content, revision, overview: { ...overview, revision } };
}

function loadCatalogs(input) {
  return Object.keys(LANGUAGES).sort().flatMap(language => {
    const directory = path.join(input, 'mobile-v2', language);
    const pointer = path.join(directory, 'manifest.json');
    if (fs.existsSync(pointer)) {
      const manifest = JSON.parse(fs.readFileSync(pointer));
      if (!/^catalog-[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)) throw Error('Invalid v2 catalog pointer');
      const bytes = fs.readFileSync(path.join(directory, manifest.fileName));
      if (digest(bytes) !== manifest.sha256 || bytes.length !== manifest.bytes) throw Error('Invalid v2 catalog checksum');
      const catalog = JSON.parse(zlib.gunzipSync(bytes));
      if (catalog.language !== language || catalog.totalCount !== catalog.data.length) throw Error('Invalid v2 catalog');
      return [catalog];
    }
    const file = path.join(input, language, 'scp-data.json');
    return fs.existsSync(file) ? [JSON.parse(fs.readFileSync(file))] : [];
  });
}

function generateResearchBoard(input, output, { incoming = path.join(input, '../partial-data/research-board'), seed } = {}) {
  const sourceDir = path.join(input, 'research-board-sources');
  const sources = readSources(sourceDir);
  if (seed) importDirectory(sources, seed);
  importDirectory(sources, incoming);
  const catalogs = loadCatalogs(input);
  const board = buildBoard(catalogs, sources);
  const json = Buffer.from(JSON.stringify(board)), bytes = zlib.gzipSync(json, { level: 9 });
  if (json.length > 160 * 1024 * 1024 || bytes.length > 32 * 1024 * 1024) throw Error('Research board client size limit exceeded');
  const sha256 = digest(bytes), fileName = `board-${sha256}.json.gz`;
  const directory = path.join(output, 'research-board');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, fileName), bytes);
  const manifest = { schemaVersion: 2, revision: board.revision, timestamp: board.overview.generatedAt,
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
