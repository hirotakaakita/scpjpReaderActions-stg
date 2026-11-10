const { LANGUAGES } = require('./languages');

/**
 * GitHub Actionsのmatrix定義（言語サイト単位）をJSONで出力する。
 * ワークフローのsetupジョブから呼び出し、fromJSONでcrawlジョブのmatrixに渡す。
 *
 * 使い方: node print-matrix.js
 * 出力例: {"include":[{"lang":"jp"}, {"lang":"en"}, ...]}
 */
const selected = process.env.ADDITIONAL_SITES_ONLY === '1'
  ? Object.keys(require('./additional-sites.json'))
  : Object.keys(LANGUAGES);
const include = selected.map(lang => ({ lang }));

if (include.length > 256) {
  // GitHub Actionsのmatrix上限
  console.error(`matrixエントリ数が上限(256)を超えています: ${include.length}`);
  process.exit(1);
}

console.log(JSON.stringify({ include: include }));
