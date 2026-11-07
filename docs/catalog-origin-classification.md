# Original branch classification

The original branch is independent of the hosting language and article category.
The weekly `merge-catalog-indexes.js` pipeline now uses this order:

1. Article-specific provenance from existing catalog page types, publisher origin
   tags, explicit translation metadata, or canonical SCP identifiers.
2. A recognized branch in the official collection URL or the member's actual
   branch heading. Unknown suffixes such as `hub` and `arc` are not branches.
3. For untagged articles in selected native English collections only, the
   collection's native EN origin. This never defaults other sites to their hosting
   language, and translation markers or translation metadata block the default.
4. Keep the branch unclassified when evidence is missing or conflicting.

Article-specific conflicting origins remain unclassified. Mixed hub headings
cannot override a definitive article tag. Heading scopes follow heading levels;
sibling headings restore the parent/collection origin. Parser version 5 refreshes
old checkpoints during the normal scheduled crawl. Reclassification also ignores
unsubstantiated inherited heading origins in existing checkpoints, without needing
to download article bodies again. Explicit translation lookup can use already
collected records across all languages, without discovering any linked articles.

## STG reclassification on 2026-11-08 JST

- All 58,063 additional catalog URL/item-ID pairs are unchanged.
- All 75,285 board works and the 2 verified semantic edges remain present.
- Board works with an unknown branch: **23,074 → 15,966** (7,108 fewer).
- JP-hosted additional articles with an unknown branch: **713 → 13**.
- No invalid `arc`, `hub`, `j`, `la`, or `un` branch page types remain.
- Article category `other` remains 307; this is separate from unknown origin.
- Some previously assigned branches were revoked because they only had leaked
  heading evidence. Missing provenance, especially on translations, is deliberately
  retained as unknown rather than guessed from the hosting site or matching slug.
- No body/mutual links were added, no new article URLs were collected, and no
  user identity migration is required. Existing v1/v2 payloads remain unchanged.

`node --test` covers precedence, invalid suffixes, heading scope, native EN
collections, translation safeguards, and cross-site explicit translation metadata.
The published-board validator rebuilds the graph and checks exact catalog URL
membership and HOME article-category parity for every work.

## Publisher tag policies (second pass, 2026-11-08 JST)

The first pass missed site-specific origin tags and documented tagging defaults.
These rules now run in the shared `classify` function, including cross-site
explicit translation metadata resolution:

- [CN tag guide](https://scp-wiki-cn.wikidot.com/tag-guide): `原创` identifies
  Chinese originals. Fiction with a primary tag (`scp`, `故事`, `goi格式`,
  `补充材料`, `站点`) and neither an original nor another origin tag defaults to
  translation from EN. Fragments, untagged pages, and secondary translations
  without a resolved origin do not receive this default.
- [ZH tag guide](https://scp-zh-tr.wikidot.com/tag-guide): `原創` identifies
  Traditional Chinese originals, only on that publishing site.
- [EN translations policy](https://scp-wiki.wikidot.com/translations-policy):
  translated works require `international` and a language tag such as `_ru`.
  Hidden language tags are recognized on EN. Fiction without a translation marker
  or other origin tag can use the publisher's native EN default.
- [DE rules](https://scp-wiki-de.wikidot.com/regeln): translations require
  `übersetzt` and the source language, except for English. DE pages carrying
  `übersetzt` with no other source language can therefore use EN.
- Native anomalous-item/event/location lists with a recognized language suffix
  also supply the origin of their untagged indexed records.

Explicit origin tags and translation metadata take priority. Unsupported language
tags block these defaults, as do unresolved explicit translation links. No title
or slug matching merges separate works and no article-link traversal is added.

The same 58,063 catalog URL/item-ID pairs are retained. Unknown origin catalog
entries decrease from **15,966 to 7,024** (8,942 fewer). Regression tests cover
site-scoped native tags, EN hidden tags, documented defaults, conflicting tags,
unsupported origin tags, and unresolved translation metadata.

## Explicit original credits and smaller branches (third pass)

- [PT tag guide](https://scp-pt-br.wikidot.com/guia-de-tags): translations have
  `traduzido`; source-language tags are required except for English. This policy
  now supplies EN only when no explicit source/tag conflict is present.
- `additional-origins.json` recognizes smaller origin branches and documented
  aliases. This does not add their sites as catalog collection targets. Published
  translations can be assigned to their original LA/TR/EO/etc. branch. ID remains
  excluded from collection.
- `origin-provenance.js` extracts **explicit original-source labels** (for example
  Czech `Originál:`) from credit containers. Ordinary body links, author profiles,
  navigation, arbitrary hosts, action URLs, and self links are excluded. Source
  URLs and label evidence are retained in the crawl checkpoint and classification.
- A source already present in the catalog/checkpoints is resolved by its own
  origin, never by the host of an intermediate translation. Conflicting sources,
  unresolved known sources, INT pages without origin evidence, and unresolved
  secondary translations remain unknown. Credit source URLs are never crawled as
  newly discovered catalog members and do not create graph edges.
- The normal weekly collector prioritizes unknown articles lacking provenance
  metadata within its existing request/time limits, even if their other metadata
  is still fresh. Successfully checked records are not immediately re-downloaded.
- `node tool/refresh-origin-provenance.js` provides a bounded, resumable backfill
  of already-published unknown URLs only (`PROVENANCE_MAX_REQUESTS`,
  `PROVENANCE_MAX_DURATION_MS`, optional `PROVENANCE_LANGUAGES`). Failures retain
  previous data. Local incoming checkpoints receive refreshed metadata too.

The initial bounded backfill refreshed 192 articles, found explicit original
sources on 121, and had no request failures. Together with policy/code changes,
unknown origins decrease **7,024 → 6,059**. All 58,063 additional catalog URL/item-ID
pairs remain unchanged. The remaining unrefreshed credits continue through the
normal weekly schedule; this pass does not claim all 7,024 bodies were rechecked.

The STG app adds Japanese/English fallback names for the smaller origin branches
to HOME and the reading ledger. Existing localized names are reused for the
previously supported branches; other app languages use English for the new names.
