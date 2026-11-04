const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib');
const { buildBoard, generateResearchBoard } = require('../research-board/catalog');
const { makeRecord, normalizePage, digest } = require('../research-board/extract');
const { merge, saveSources, readSources, capture } = require('../research-board/source-store');
const BASE = 'https://scp-wiki.wikidot.com/';
function state(slug, html) {
  const record = makeRecord(BASE + slug, `<div id="page-content">${html}</div>`, 'html', '2026-11-05T00:00:00Z');
  return { record, lastAttempt: { status: 'success', at: record.checkedAt } };
}
function catalogs() {
  return [{ language: 'en', timestamp: '2026-11-05T00:00:00Z', data: [
    { itemId: 'scp-001', titleJP: 'First', urlJP: BASE + 'scp-001' },
    { itemId: 'scp-002', titleJP: 'Isolated', urlJP: BASE + 'scp-002' },
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
  assert.equal(a.nodes.filter(n => n[4] === 'scp-001').length, 2);
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
