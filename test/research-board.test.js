const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib');
const { buildBoard, generateResearchBoard } = require('../research-board/catalog');
const { makeRecord, normalizePage, digest } = require('../research-board/extract');
const { merge, saveSources, readSources, capture } = require('../research-board/source-store');
const { branchForPageType } = require('../research-board/classification');
const BASE = 'https://scp-wiki.wikidot.com/';
function state(slug, html) {
  const record = makeRecord(BASE + slug, `<div id="page-content">${html}</div>`, 'html', '2026-11-05T00:00:00Z');
  return { record, lastAttempt: { status: 'success', at: record.checkedAt } };
}
function catalogs() {
  return [{ language: 'en', timestamp: '2026-11-05T00:00:00Z', data: [
    { itemId: 'scp-series-001', pageType: 'scp-series', titleJP: 'First', urlJP: BASE + 'scp-001' },
    { itemId: 'scp-series-002', pageType: 'scp-series', titleJP: 'Isolated', urlJP: BASE + 'scp-002' },
  ] }];
}

test('all catalog pages survive without links; branch identity and log kinds remain distinct', () => {
  const records = new Map();
  merge(records, state('scp-001', '<a href="/experiment-log-t-98816-oc108-682">Log</a><a href="https://scp-jp.wikidot.com/scp-001">JP</a>'));
  merge(records, state('experiment-log-t-98816-oc108-682', '<a href="/scp-682">682</a>'));
  const a = buildBoard(catalogs(), records), b = buildBoard(catalogs(), records);
  assert.deepEqual(a, b);
  const isolated = a.nodes.find(n => n[4] === 'scp-002');
  assert.equal(isolated[9], 0);
  assert.equal(a.nodes.filter(n => n[4] === 'scp-001').length, 1);
  assert.equal(a.nodes.find(n => n[4] === 'scp-001')[13].length, 2);
  assert.equal(a.nodes.find(n => n[4].startsWith('experiment-log'))[3], 1);
  assert.ok(a.overview.types.includes('appears_in_log'));
  assert.equal(a.overview.types.includes('co_appearance'), false);
  for (const n of a.nodes) {
    assert.ok(n[1] >= 0 && n[1] <= a.overview.width);
    assert.ok(n[2] >= 0 && n[2] <= a.overview.height);
  }
});

test('navigation is excluded; addendum links have provenance; quote rules are source specific', () => {
  const records = new Map();
  merge(records, state('scp-079', '<div class="wikiwalk-nav"><a href="/scp-078">nav</a></div>' +
    '<p>SCP-079 and SCP-682 were contained within the same chamber for 43 minutes.</p>' +
    '<h2>Addendum:</h2><a href="/scp-682">682</a>'));
  const board = buildBoard(catalogs(), records);
  assert.equal(board.nodes.some(n => n[4] === 'scp-078'), false);
  assert.ok(board.overview.types.includes('co_appearance'));
  assert.ok(board.overview.types.includes('appears_in_addendum'));
  assert.ok(board.proofs.every(p => p[0] === BASE + 'scp-079' && /^[a-f0-9]{64}$/.test(p[3])));
  const other = new Map();
  merge(other, state('scp-002', '<p>SCP-079 and SCP-682 were contained within the same chamber for 43 minutes.</p>'));
  assert.equal(buildBoard(catalogs(), other).edges.length, 0);
});

test('incremental source shards preserve failed observations and replace deleted links on success', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-sources-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const records = new Map(), first = state('scp-001', '<a href="/scp-002">2</a>');
  merge(records, first); saveSources(records, dir);
  const restored = readSources(dir);
  merge(restored, { url: BASE + 'scp-001', record: null, lastAttempt: { status: 'fetch_error', at: '2026-11-06T00:00:00Z' } });
  assert.equal(buildBoard(catalogs(), restored).edges.length, 1);
  const newer = state('scp-001', 'no links');
  newer.record.checkedAt = '2026-11-07T00:00:00Z'; newer.lastAttempt.at = newer.record.checkedAt;
  merge(restored, newer);
  assert.equal(buildBoard(catalogs(), restored).edges.length, 0);
  const captured = path.join(dir, 'capture');
  capture(BASE + 'scp-002', '<div id="page-content">ok</div>', 'html', captured);
  assert.equal(fs.readdirSync(captured).length, 1);
});

test('one deterministic verified gzip is generated alongside mobile catalogs, without changing legacy data', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-catalog-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'local-data'), en = path.join(input, 'en');
  fs.mkdirSync(en, { recursive: true });
  const legacy = JSON.stringify(catalogs()[0]);
  fs.writeFileSync(path.join(en, 'scp-data.json'), legacy);
  const output = path.join(input, 'mobile-v1');
  const first = generateResearchBoard(input, output), second = generateResearchBoard(input, output);
  assert.deepEqual(first, second);
  const bytes = fs.readFileSync(path.join(output, 'research-board', first.fileName));
  assert.equal(digest(bytes), first.sha256);
  assert.equal(zlib.gunzipSync(bytes).length, first.decodedBytes);
  assert.equal(fs.readFileSync(path.join(en, 'scp-data.json'), 'utf8'), legacy);
});

test('existing weekly crawler owns capture and mobile generation; no new scheduler or release publisher', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/scp-crawler.yml'), 'utf8');
  assert.match(workflow, /CAPTURE_RESEARCH_BOARD: '1'/);
  assert.match(fs.readFileSync(path.join(__dirname, '../mobile-catalog.js'), 'utf8'), /generateResearchBoard\(input/);
  assert.equal(fs.existsSync(path.join(__dirname, '../.github/workflows/relation-graph.yml')), false);
});

test('reading-ledger page types classify translations by work origin while preserving actual pages and links', () => {
  const jp = 'https://scp-jp.wikidot.com/';
  const records = new Map();
  const record = makeRecord(jp + 'scp-1537', '<div id="page-content"><a href="/scp-1537-jp">Other work</a></div>', 'html', '2026-11-05T00:00:00Z');
  merge(records, { record, lastAttempt: { status: 'success', at: record.checkedAt } });
  const board = buildBoard([
    { language: 'jp', timestamp: '2026-11-05T00:00:00Z', data: [
      { itemId: 'scp-series-1537', urlJP: jp + 'scp-1537', pageType: 'scp-series' },
      { itemId: 'scp-series-jp-1537', urlJP: jp + 'scp-1537-jp', pageType: 'scp-series-jp' },
      { urlJP: jp + 'scp-001-ex', pageType: 'scp-ex' },
      { urlJP: jp + 'scp-001-j', pageType: 'joke-scps' },
    ] },
    { language: 'en', timestamp: '2026-11-05T00:00:00Z', data: [
      { itemId: 'scp-series-1537', urlJP: BASE + 'scp-1537', pageType: 'scp-series' },
    ] },
  ], records);
  const translated = board.nodes.find(n => n[4] === 'scp-1537');
  assert.equal(translated[8], 'en'); assert.equal(translated[13].length, 2);
  assert.ok(translated[13].some(p => p[0] === 'jp' && p[1] === jp + 'scp-1537'));
  assert.equal(translated[12], 'scp-series');
  assert.equal(board.nodes.find(n => n[4] === 'scp-1537-jp')[8], 'jp');
  assert.equal(board.nodes.filter(n => n[4] === 'scp-1537').length, 1);
  assert.equal(board.edges.length, 1);
  assert.ok(board.nodes[board.edges[0][0]][13].some(p => p[1] === jp + 'scp-1537'));
  assert.equal(board.nodes[board.edges[0][1]][6], jp + 'scp-1537-jp');
  assert.equal(board.overview.classification, 'reading_record_page_type');
  for (const [type, expected] of [['scp-series', 'en'], ['joke-scps', 'en'], ['scp-ex', 'en'],
    ['scp-series-jp', 'jp'], ['joke-scps-jp', 'jp'], ['scp-jp-ex', 'jp'], ['scp-series-zh', 'zh'], ['scp-series-sk', 'sk']]) {
    assert.equal(branchForPageType(type), expected);
  }
});

test('non-catalog logs use explicit publisher origin tags; unknown origins are not guessed from hosting language', () => {
  const records = new Map();
  for (const [slug, tag] of [['experiment-log-example', 'en'], ['unclassified-log', null]]) {
    const url = 'https://scp-jp.wikidot.com/' + slug;
    const record = makeRecord(url, '<div id="page-content">Content</div>' +
      (tag ? `<div class="page-tags"><a>${tag}</a></div>` : ''), 'html', '2026-11-05T00:00:00Z');
    merge(records, { record, lastAttempt: { status: 'success', at: record.checkedAt } });
  }
  const board = buildBoard(catalogs(), records);
  const log = board.nodes.find(n => n[4] === 'experiment-log-example');
  assert.equal(log[8], 'en'); assert.equal(log[11], 'jp');
  assert.equal(log[3], 1);
  assert.equal(board.nodes.find(n => n[4] === 'unclassified-log')[8], 'other');
});

test('one work has language choices and one connection with every original proof', () => {
  const jp = 'https://scp-jp.wikidot.com/';
  const records = new Map();
  merge(records, state('scp-079', '<p>SCP-079 and SCP-682 were contained within the same chamber for 43 minutes.</p><a href="/scp-682">682</a>'));
  const r = makeRecord(jp + 'scp-079', '<div id="page-content"><a href="/scp-682">682</a><a href="https://scp-wiki.wikidot.com/scp-079">Original</a></div>', 'html', '2026-11-05T00:00:00Z');
  merge(records, { record: r, lastAttempt: { status: 'success', at: r.checkedAt } });
  const board = buildBoard(['en','jp'].map(language => ({ language, timestamp: r.checkedAt, data:
    ['079','682'].map(id => ({ itemId: 'scp-series-' + id, pageType: 'scp-series', numericItemId: Number(id),
      urlJP: (language === 'jp' ? jp : BASE) + 'scp-' + id })) })), records);
  assert.equal(board.nodes.length, 2);
  assert.ok(board.nodes.every(n => n[13].length === 2));
  assert.equal(board.overview.sourcePageCount, 4);
  assert.ok(board.overview.internalReferences > 0);
  const references = board.edges.filter(e => board.overview.types[e[2]] === 'references');
  assert.equal(references.length, 1);
  assert.equal(references[0][4].length, 2);
  assert.deepEqual(new Set(references[0][4].map(id => board.proofs[id][0])), new Set([BASE + 'scp-079', jp + 'scp-079']));
  const claim = board.edges.find(e => board.overview.types[e[2]] === 'co_appearance');
  assert.equal(claim[4].length, 1);
  assert.equal(board.proofs[claim[3]][0], BASE + 'scp-079');
  assert.ok(board.overview.sections.every(s => !/ · \d+$/.test(s.label)));
});

test('ledger identity keeps branch works, variants and different 001 proposals apart', () => {
  const data = [
    { itemId: 'scp-series-001-a', pageType: 'scp-series', numericItemId: 1, urlJP: BASE + 'proposal-a' },
    { itemId: 'scp-series-001-b', pageType: 'scp-series', numericItemId: 1, urlJP: BASE + 'proposal-b' },
    { itemId: 'scp-series-jp-001', pageType: 'scp-series-jp', numericItemId: 1, urlJP: 'https://scp-jp.wikidot.com/scp-001-jp' },
  ];
  const board = buildBoard([{ language: 'en', timestamp: '2026-11-05T00:00:00Z', data },
    { language: 'jp', timestamp: '2026-11-05T00:00:00Z', data: [{ ...data[0], urlJP: 'https://scp-jp.wikidot.com/proposal-a' }] }], new Map());
  assert.equal(board.nodes.length, 3);
  assert.equal(board.nodes.find(n => n[14][1] === 'scp-series-001-a')[13].length, 2);
  assert.ok(board.overview.sections.every(s => s.label === '000–099'));
});


test('additional catalog documents retain ledger IDs and log shapes', () => {
  const board = buildBoard([{ language: 'en', timestamp: '2026-11-06T00:00:00Z', data: [
    { itemId: 'document-log', pageType: 'related-document-en', urlEN: BASE + 'experiment-log-example' },
    { itemId: 'document-unknown', pageType: 'related-document-unclassified', urlEN: BASE + 'unknown-page' },
  ] }], new Map());
  const log = board.nodes.find(n => n[4] === 'experiment-log-example');
  assert.equal(log[3], 1);
  assert.equal(log[8], 'en');
  assert.deepEqual(log[14], ['catalog:related-document-en:document-log', 'document-log']);
  const unknown = board.nodes.find(n => n[4] === 'unknown-page');
  assert.equal(unknown[8], 'other');
  assert.equal(unknown[14][1], 'document-unknown');
});


test('graph input uses combined v2 catalog and rejects a damaged payload', t => {
  const input = fs.mkdtempSync(path.join(os.tmpdir(), 'board-v2-'));
  t.after(() => fs.rmSync(input, { recursive: true, force: true }));
  const directory = path.join(input, 'mobile-v2/en');
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(path.join(input, 'en'));
  fs.writeFileSync(path.join(input, 'en/scp-data.json'), JSON.stringify(catalogs()[0]));
  const combined = { language: 'en', totalCount: 1, data: [
    { itemId: 'document-log', pageType: 'related-document-en', urlEN: BASE + 'experiment-log-example' }
  ] };
  const bytes = zlib.gzipSync(Buffer.from(JSON.stringify(combined)));
  const sha256 = digest(bytes), fileName = `catalog-${sha256}.json.gz`;
  fs.writeFileSync(path.join(directory, fileName), bytes);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ fileName, sha256, bytes: bytes.length }));
  const { loadCatalogs } = require('../research-board/catalog');
  assert.deepEqual(loadCatalogs(input), [combined]);
  fs.writeFileSync(path.join(directory, fileName), 'damaged');
  assert.throws(() => loadCatalogs(input), /checksum/);
});
