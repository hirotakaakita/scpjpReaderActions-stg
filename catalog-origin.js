'use strict';
const { LANGUAGES } = require('./languages');
const branches = new Set(['en', 'zh', 'sk', 'id', ...Object.keys(LANGUAGES)]);
function validOrigin(value) {
  value = value === 'zh-tr' ? 'zh' : value;
  return branches.has(value) ? value : null;
}

// These native EN collections omit language suffixes and native language tags.
// Never apply this default to another hosting site or a translation-tagged page.
function nativeCollectionOrigin(source) {
  try {
    const u = new URL(source);
    return u.hostname === 'scp-wiki.wikidot.com' &&
      /^\/(?:foundation-tales|goi-formats|top-rated-tales|tales-by-(?:year|author|title|date))(?:\/|$)/.test(u.pathname) ? 'en' : null;
  } catch { return null; }
}
function resolveOrigin(record, evidence, fallback, originHint) {
  // Article-specific provenance wins over a mixed hub's section headings.
  if (validOrigin(fallback.branch)) return { ...fallback, branch: validOrigin(fallback.branch) };
  if (/^conflicting_|^translation_(?:cycle|depth_limit)$/.test(fallback.basis || '')) return fallback;
  const origins = [...new Set(evidence.map(e => {
    const hint = e.source ? validOrigin(originHint(e.source)) : null;
    // Old checkpoints may carry an origin leaked from a previous heading.
    // Recover from the actual collection URL or this member's own heading.
    const heading = /^SCP[- ]([a-z]{2})(?:\b|-)/i.exec(e.section || '');
    return hint || (heading && validOrigin(heading[1].toLowerCase()) === validOrigin(e.origin) ? validOrigin(e.origin) : null);
  }).filter(Boolean))];
  if (origins.length === 1) return { branch: origins[0], basis: 'official_index_section', evidence: origins };
  if (origins.length > 1) return { branch: null, basis: 'conflicting_index_origins', evidence: origins };
  const translation = (record.tags || []).some(t => /^(?:translation|translated|international|traduzido|翻译|翻譯|翻訳)$/.test(t)) || record.translations?.length;
  const native = !translation && evidence.map(e => nativeCollectionOrigin(e.source)).find(Boolean);
  return native ? { branch: native, basis: 'native_official_collection', evidence: evidence.filter(e => nativeCollectionOrigin(e.source)).map(e => e.source) } : fallback;
}
module.exports = { validOrigin, nativeCollectionOrigin, resolveOrigin };
