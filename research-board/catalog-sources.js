'use strict';
// Reuse the metadata already collected from official indexes. No network or AI.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { normalizePage } = require('./extract');
const { merge } = require('./source-store');
function importCatalogSources(sources, input, catalogs) {
  const members = new Set(catalogs.flatMap(c => c.data.map(row =>
    normalizePage(row.isTranslatedJP !== false && row.urlJP ? row.urlJP : row.urlEN)?.id)).filter(Boolean));
  for (const key of sources.keys()) if (!members.has(key)) sources.delete(key);
  const root = path.join(input, 'catalog-indexes');
  if (!fs.existsSync(root)) return;
  for (const name of fs.readdirSync(root).sort()) {
    if (!/^[a-z-]+\.json\.gz$/.test(name)) continue;
    const state = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,name))));
    for (const record of Object.values(state.records || {})) {
      const page = normalizePage(record.url);
      if (!page || !members.has(page.id) || !/^[a-f0-9]{64}$/.test(record.contentSha256 || '')) continue;
      const previous = sources.get(page.id)?.record;
      const trusted = record.linkExtractionVersion >= 5;
      const legacyPrevious = previous?.limitations?.includes('metadata_links_only');
      if (previous && previous.checkedAt >= record.checkedAt && !(legacyPrevious && !trusted)) continue;
      const unchanged = previous?.contentSha256 === record.contentSha256 && !legacyPrevious;
      const converted = unchanged ? {...previous, checkedAt:record.checkedAt} : {
        schemaVersion:1, extractorVersion:trusted ? 5 : 0, pageId:page.id, url:page.url,
        title:record.title, tags:record.tags || [], authors:record.authors || [],
        checkedAt:record.checkedAt, fetchedAt:record.checkedAt,
        contentSha256:record.contentSha256, format:record.format,
        links:record.linkExtractionVersion>=6 ? record.bodyLinks || [] : [],
        linkExtractionVersion:record.linkExtractionVersion || 0,
        translations:[],
        semanticRelations:[], limitations:[trusted ? 'metadata_links_only_v5' : 'legacy_unchecked_links'],
      };
      converted.originalSources=record.originalSources||[];
      if (legacyPrevious && !trusted && previous.checkedAt === record.checkedAt) {
        sources.set(page.id,{...sources.get(page.id),record:converted});
      } else merge(sources,{record:converted,lastAttempt:{status:'success',at:record.checkedAt}});
    }
    for (const [url, attempt] of Object.entries(state.attempts || {})) {
      const page = normalizePage(url);
      if (!page || !members.has(page.id) || !Number.isFinite(Date.parse(attempt.at))) continue;
      const current = sources.get(page.id);
      if (current?.lastAttempt?.at > attempt.at) continue;
      if (!['success','not_modified'].includes(attempt.status)) {
        sources.set(page.id,{url:page.url,record:current?.record || null,lastAttempt:attempt});
      }
    }
  }
  // Work identity metadata is independent of semantic/body-link coverage.
  const additional=path.join(input,'related-documents/catalog.json.gz');
  if(fs.existsSync(additional))for(const row of JSON.parse(zlib.gunzipSync(fs.readFileSync(additional))).data){
    const p=normalizePage(row.url),state=p&&sources.get(p.id);
    if(!state?.record||!members.has(p.id))continue;
    state.record.catalogIdentity={originBranch:row.originBranch,basis:row.classification?.basis};
    // Preserve explicit original credits even if the semantic snapshot has the
    // same timestamp and was therefore retained above.
  }
  for(const name of fs.readdirSync(root).sort())if(/^[a-z-]+\.json\.gz$/.test(name)){
    const state=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,name))));
    for(const r of Object.values(state.records||{})){
      const p=normalizePage(r.url),saved=p&&sources.get(p.id);
      if(saved?.record&&members.has(p.id)&&saved.record.contentSha256===r.contentSha256&&r.originalSources?.length)saved.record.originalSources=r.originalSources;
      if(saved?.record&&members.has(p.id)&&saved.record.contentSha256===r.contentSha256&&r.linkExtractionVersion>=6){
        saved.record.links=r.bodyLinks||[];
        saved.record.linkExtractionVersion=r.linkExtractionVersion;
      }
      if(saved?.record&&members.has(p.id)&&saved.record.contentSha256===r.contentSha256&&r.authorCreditVersion>=1){
        saved.record.identityMetadataVersion=r.identityMetadataVersion;
        saved.record.authorCreditVersion=r.authorCreditVersion;
        saved.record.originalAuthors=r.originalAuthors||[];
        saved.record.upstreamAuthors=r.upstreamAuthors||[];
        saved.record.translators=r.translators||[];
      }
    }
  }
}
module.exports = { importCatalogSources };
