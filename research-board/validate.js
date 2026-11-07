'use strict';
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { digest, normalizePage } = require('./extract');
const { buildBoard, loadCatalogs } = require('./catalog');
const { readSources } = require('./source-store');
const { branchForPageType } = require('./classification');
const {CATEGORY_ORDER, KIND_BY_CATEGORY, homeCategory} = require('./article-categories');
function validate(root = path.join(__dirname, '..')) {
  const input = path.join(root, 'local-data'), directory = path.join(input, 'mobile-v3/research-board');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
  if (manifest.fileName !== `board-${manifest.sha256}.json.gz`) throw Error('Invalid board pointer');
  const bytes = fs.readFileSync(path.join(directory, manifest.fileName));
  if (bytes.length !== manifest.bytes || digest(bytes) !== manifest.sha256) throw Error('Board checksum mismatch');
  const decoded = zlib.gunzipSync(bytes);
  if (decoded.length !== manifest.decodedBytes) throw Error('Board decoded size mismatch');
  const board = JSON.parse(decoded);
  if (board.revision !== manifest.revision || board.nodes.length !== manifest.nodeCount || board.edges.length !== manifest.edgeCount) throw Error('Board metadata mismatch');
  if (board.overview.classification !== 'reading_record_page_type') throw Error('Missing ledger classification');
  if (board.schemaVersion !== 3 || board.overview.identity !== 'ledger_work') throw Error('Missing work identity');
  const workIds = new Set(), pageUrls = new Set(), aliases = new Set();
  for (const n of board.nodes) {
    if (n.length !== 15 || (n[12] && branchForPageType(n[12]) !== n[8])) throw Error('Ledger classification mismatch');
    if (workIds.has(n[14][0])) throw Error('Duplicate work node');
    workIds.add(n[14][0]);
    if (n[14].length !== 3 || !Array.isArray(n[14][2])) throw Error('Missing work aliases');
    for (const key of n[14][2]) {
      if (aliases.has(key)) throw Error('Work alias assigned to multiple nodes');
      aliases.add(key);
    }
    if (n[3] !== 4) for (const version of n[13]) {
      if (pageUrls.has(version[1])) throw Error('Page assigned to multiple works');
      pageUrls.add(version[1]);
    }
  }
  if (pageUrls.size !== board.overview.sourcePageCount) throw Error('Lost source page');
  const catalogs = loadCatalogs(input);
  if (JSON.stringify(board.overview.categoryOrder) !== JSON.stringify(CATEGORY_ORDER)) throw Error('HOME category order mismatch');
  const catalogWorks = new Map();
  for (const catalog of catalogs) for (const row of catalog.data) {
    const key = `catalog:${row.pageType}:${row.itemId}`;
    if (!catalogWorks.has(key)) catalogWorks.set(key,[]);
    catalogWorks.get(key).push({...row,language:catalog.language});
  }
  for (const node of board.nodes) {
    const rows = catalogWorks.get(node[14][0]) || [];
    const row = rows.find(row => row.language === node[11]) || rows[0];
    if (!row || node[3] !== KIND_BY_CATEGORY[homeCategory(row.pageType,row.contentType)]) {
      throw Error(`HOME article category mismatch: ${node[14][0]}`);
    }
  }
  const members = new Set(catalogs.flatMap(c => c.data.map(row =>
    normalizePage(row.isTranslatedJP !== false && row.urlJP ? row.urlJP : row.urlEN)?.url)).filter(Boolean));
  if (pageUrls.size !== members.size || [...pageUrls].some(url => !members.has(url))) {
    throw Error('Board pages differ from the fetched official catalog');
  }
  if (board.nodes.some(n => n[3] === 4) ||
      board.overview.types.some(type => ['references','appears_in_log','appears_in_addendum','translation_assertion'].includes(type))) {
    throw Error('Uncollected entity or excluded hyperlink relations');
  }
  // Exercise the real generation path against committed evidence and catalogs.
  // This runs in the existing staging validation workflow without recrawling.
  const rebuilt = buildBoard(catalogs, readSources(path.join(input, 'research-board-sources')));
  if (JSON.stringify(board) !== JSON.stringify(rebuilt)) throw Error('Published board does not match current crawler inputs');
  console.log(JSON.stringify({ revision: board.revision, nodes: board.nodes.length, edges: board.edges.length, verified: true }));
}
if (require.main === module) validate();
module.exports = { validate };
