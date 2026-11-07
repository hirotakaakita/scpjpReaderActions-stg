'use strict';
const { LANGUAGES } = require('./languages');
const branches = new Set(['en', 'zh', 'sk', 'id', ...Object.keys(LANGUAGES)]);
function validOrigin(value) {
  value = value === 'zh-tr' ? 'zh' : value;
  return branches.has(value) ? value : null;
}
// Publisher rules, not a blanket inference from the page's hosting language.
// CN tag-guide: native = 原创; fiction without an origin tag defaults to EN.
// EN translations-policy: translations require international and _<branch>.
const unsupportedOrigins = new Set(['ar','cy','el','eo','et','he','hu','la','ms','nd-da','nd-no','nd-sv','ro','sl','tr','uk','da','no','sv','sh','interslavic','interlingue','ido','tok','nl']);
function publisherOriginTags(url, record) {
  const host = new URL(url).hostname;
  const tags = (record?.tags || []).map(t => t.toLowerCase());
  const values = tags.map(t => t.replace(/^филиал:/u, '')).map(t =>
    host === 'scp-wiki.wikidot.com' && /^_[a-z]{2,3}$/.test(t) ? t.slice(1) : t);
  if (host === 'scp-wiki-cn.wikidot.com' && tags.includes('原创')) values.push('cn');
  if (host === 'scp-zh-tr.wikidot.com' && tags.includes('原創')) values.push('zh');
  return {
    origins: [...new Set(values.map(validOrigin).filter(Boolean))],
    unsupported: [...new Set(values.filter(t => unsupportedOrigins.has(t)))],
  };
}
function publisherDefaultOrigin(url, record) {
  // Unresolved explicit translation metadata must not be replaced by a default.
  if (record?.translations?.length) return null;
  const tags = new Set((record?.tags || []).map(t => t.toLowerCase()));
  const host = new URL(url).hostname;
  // DE rules require übersetzt plus the source-language tag, except for EN.
  if (host === 'scp-wiki-de.wikidot.com' && tags.has('übersetzt')) {
    return { branch:'en',basis:'publisher_default_origin',evidence:['https://scp-wiki-de.wikidot.com/regeln'] };
  }
  if ([...tags].some(t => ['international','translation','translated','二次翻译','二次翻譯','翻譯','翻译','traduzido'].includes(t))) return null;
  if (host === 'scp-wiki-cn.wikidot.com' &&
      ['scp','故事','goi格式','补充材料','站点'].some(t => tags.has(t))) {
    return { branch:'en',basis:'publisher_default_origin',evidence:['https://scp-wiki-cn.wikidot.com/tag-guide'] };
  }
  if (host === 'scp-wiki.wikidot.com' &&
      ['scp','tale','supplement','hub','site'].some(t => tags.has(t))) {
    return { branch:'en',basis:'publisher_default_origin',evidence:['https://scp-wiki.wikidot.com/translations-policy'] };
  }
  return null;
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
  if (/^conflicting_|^unsupported_|^translation_(?:cycle|depth_limit)$/.test(fallback.basis || '')) return fallback;
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
module.exports = { validOrigin, nativeCollectionOrigin, resolveOrigin, publisherOriginTags, publisherDefaultOrigin };
