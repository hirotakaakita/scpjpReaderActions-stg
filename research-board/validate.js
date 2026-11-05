'use strict';
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { digest } = require('./extract');
const { buildBoard } = require('./catalog');
const { readSources } = require('./source-store');
const { branchForPageType } = require('./classification');
function validate(root = path.join(__dirname, '..')) {
  const input = path.join(root, 'local-data'), directory = path.join(input, 'mobile-v1/research-board');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
  if (manifest.fileName !== `board-${manifest.sha256}.json.gz`) throw Error('Invalid board pointer');
  const bytes = fs.readFileSync(path.join(directory, manifest.fileName));
  if (bytes.length !== manifest.bytes || digest(bytes) !== manifest.sha256) throw Error('Board checksum mismatch');
  const decoded = zlib.gunzipSync(bytes);
  if (decoded.length !== manifest.decodedBytes) throw Error('Board decoded size mismatch');
  const board = JSON.parse(decoded);
  if (board.revision !== manifest.revision || board.nodes.length !== manifest.nodeCount || board.edges.length !== manifest.edgeCount) throw Error('Board metadata mismatch');
  if (board.overview.classification !== 'reading_record_page_type') throw Error('Missing ledger classification');
  for (const n of board.nodes) {
    if (n.length !== 13 || (n[12] && branchForPageType(n[12]) !== n[8])) throw Error('Ledger classification mismatch');
  }
  const catalogs = fs.readdirSync(input).sort().flatMap(code => {
    const file = path.join(input, code, 'scp-data.json');
    return fs.existsSync(file) ? [JSON.parse(fs.readFileSync(file))] : [];
  });
  // Exercise the real generation path against committed evidence and catalogs.
  // This runs in the existing staging validation workflow without recrawling.
  const rebuilt = buildBoard(catalogs, readSources(path.join(input, 'research-board-sources')));
  if (JSON.stringify(board) !== JSON.stringify(rebuilt)) throw Error('Published board does not match current crawler inputs');
  console.log(JSON.stringify({ revision: board.revision, nodes: board.nodes.length, edges: board.edges.length, verified: true }));
}
if (require.main === module) validate();
module.exports = { validate };
