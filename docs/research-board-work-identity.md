# Research board work identity

The original branch and the language of a selected page are different fields.
A single-language translated node is valid when the original is not collected,
or when the relationship cannot be verified. It is a merge omission when both
pages have compatible, confirmed identity evidence and remain separate.

## Identity rules

Ordinary SCPs retain their existing catalog work IDs. Document translations use:

- An explicit original-source credit, with both endpoints already cataloged.
  Credits take priority over matching paths, even when the stated original is
  outside the collected catalog. Uncollected pages are never added or fetched.
- A known original branch plus the same preserved original page identifier in
  that branch's collected native catalog. This requires recorded publisher origin
  evidence and compatible article categories. Existing author IDs corroborate the
  relationship when present; conflicting author IDs prevent automatic merging.
- Generic resource/index paths do not merge under the path rule. Hubs require
  corroborating author metadata or explicit original credits. Titles alone and
  bare SCP numbers are never identity evidence. Different 001 proposal paths,
  original branches, and unrelated documents remain separate.
- Multiple original credits, contradictory source targets, conflicting component
  origins and same-site identity collisions are held for review. An explicit
  credit pointing elsewhere cannot be overridden by a same-path candidate.

Native original catalog identities are preferred as the work's stable identity.
Every merged catalog ID remains an alias, and every original page URL remains in
the work's language versions. Database IDs, bookmarks and history are not migrated
or rewritten. Existing reads from any alias ID, work key or page URL mark the
merged work as read. Temporary fetch failures do not erase prior identity metadata;
unverified semantic relations continue to follow their separate freshness rules.

`catalog-sources.js` carries the necessary original-branch/credit metadata into
the persisted source snapshot. `translation-identities.js` generates identity
assertions, and `works.js` joins compatible components. These assertions never
become story-relation edges and do not use body/mutual links.

The existing weekly `mobile-catalog.js` generation performs this automatically.
The validator checks every original page appears exactly once, catalog aliases are
unique, identity-proof endpoints share one work, HOME category parity holds, and
regeneration from saved inputs is deterministic. `workIdentityProofs` and
`identityReview` in the shared gzip preserve compact audit information. Full
metadata/provenance stays in the source snapshots.

## STG verification

- AELIANA: JP/CN/ES/INT **4 nodes → 1 JP-origin work with 4 language versions**.
- Entire board: **75,285 → 61,053 works**, removing 14,232 duplicate nodes.
- All **125,023 cataloged page URLs** remain present. The two semantic edges are
  retained; no translation/body-link relation edges are created.
- 1,491 candidate records remain held for evidence/category/author conflicts or
  generic resource paths, rather than being forced into one work.
- Node regression tests cover AELIANA, missing originals, changed translation
  URLs, title/path collisions, conflicting authors, compilations, temporary
  failures and the Traditional Chinese native-site alias.
- Flutter tests use the generated AELIANA row to check all legacy read identities.
  A full published-payload installation/search smoke test also passes.

Only STG is updated. The current STG app accepts this schema without rebuilding.

## Legacy SCP IDs and full identifiers

SCP-749-JP exposed another class of merge omission: the KO catalog retained
`document-ko--scp-749-jp`, while JP/ZH used `scp-series-jp-749`. The database IDs
are preserved. SCP/EX/Joke identity now uses original branch, family and full
identifier (including all variant/proposal suffixes), independently of the old
catalog item ID. Branch-prefix and branch-suffix spellings are normalized, e.g.
`scp-de-272` and `scp-272-de`; number padding and remaining suffixes are preserved.
Positional branch codes also correct board-only origin metadata from old mixed
Joke indexes. Explicit publisher origin tags handle entries without positional
codes. Words later in suffixes are not treated as language codes.

The audit also found old IDs reused by different works. One ID must not join
SCP-001-J and SCP-001-EX-J or an EN Joke and an unrelated DE Joke. The uniquely
authoritative original owns the old scoped key; other works use their existing
valid aliases or a corrected branch scope with the unchanged article ID. If the
same scoped ID still collides, an opaque `@work-<hash>` qualifier distinguishes
board work keys. This qualifier is not an article ID and never changes catalog
rows, database IDs, bookmarks or saved history.

46 reused article IDs are explicitly flagged in the board overview. The updated
STG app does not use those ambiguous IDs/work keys alone as read evidence or as a
cross-language reader fallback. Exact page URLs and unambiguous aliases continue
to work. Historic records containing only a reused ID cannot be reliably assigned
to a work from that ID alone, and are not automatically migrated.

Verification:

- SCP-749-JP: **one JP-origin node with JP/KO/ZH versions**, retaining the KO ID.
- Board: **61,053 → 60,654 nodes**, with all 125,023 page URLs retained.
- **Zero duplicate normalized full SCP signatures**, enforced by the validator.
- All reused raw IDs across distinct catalog works must have an ambiguity flag.
- Tests cover legacy document IDs, reused IDs, distinct 001 suffix variants,
  prefix/suffix branch spelling, read-state isolation and safe reader fallback.
- Full actual-payload installation/search/read checks pass in Flutter.

The data remains schema 3. Install the updated STG APK for the ambiguous-ID read
and reader protections; the node merging itself is delivered through board data.

## Category-independent work identity (2026-11-08)

An article's local content category is not a work identifier. Native and
translated catalog entries may disagree on SCP/log, Tale/other or hub/setting.
An exact distinctive original path plus confirmed original-branch provenance
can therefore join different categories. The native catalog entry continues to
determine the canonical category; all existing catalog IDs remain read aliases.
Full numbered SCP/log paths can also resolve legacy SCP-vs-document entries,
with all suffixes preserved. Shared author conflicts and generic hub names are
still held for review. A distinctive hub with an explicit publisher origin tag
does not need optional author metadata merely to join its collected native hub.

If the native page is uncollected, two already-collected document translations
can join only when both have origin provenance, the exact same distinctive path
and a shared credited Wikidot author. Explicit original credits take precedence;
conflicting or unavailable original credits are never replaced by path guessing.
No native placeholder, catalog row or linked target is added.

The STG snapshot changed from 60,654 to 59,232 work nodes, retaining all 125,023
page URLs. Known-origin single-language nodes whose host differs from the origin
decreased from 4,660 to 3,151. This count cannot be expected to reach zero: among
the remaining nodes, 1,999 have no same-path counterpart, 851 have only translated
counterparts without enough matching identity evidence, and 301 have a native
same-path counterpart held for conflicting authors, generic names or other
insufficient evidence. A missing same-path counterpart does not establish that
the work has no original anywhere; its original may be outside the catalogs or
under an unproven different path.

SCP-093-Blue-Test now has one record node with 14 language versions, including
the formerly separate RU SCP catalog entry. Its RU legacy ID still marks that
same work read and opens the actual RU catalog page. SCP-1025-RU-J likewise has
one RU/CN node. Reference edges are remapped to merged work endpoints, with
self-references suppressed and duplicate edges consolidated.

## Explicit source credits and contributor roles

The credit extractor recognizes an original article linked by the literal
anchor label `原文`, as well as labelled JP `元記事` / `翻訳元` links. Historical
CN publisher domains `scp-wiki-cn.org` and `www.scp-wiki-cn.org` normalize to the
current CN host for source identity. Ordinary body references do not become
translation identity assertions.

JP `元記事リンク` and `著作権者`, and CN plain bracketed `原文地址` URLs are
also supported. A separately labelled derivative-work creator takes precedence
over an upstream SCP creator; `upstreamAuthors` preserves that distinction.

`authorCreditVersion: 1` stores `originalAuthors` and `translators` separately.
Only explicitly labelled credit lines supply those roles. Unlabelled or image
contributors are not promoted to original authors. When no role was recognized,
legacy author conflicts remain conservative; an empty new field alone must not
erase a prior conflict. Actual original-author disagreements still block path
inference. A direct explicit original-source credit can establish identity
independently of the credited translators.

When an original-author label is absent, only explicitly identified translator
accounts are subtracted from legacy credits; unassigned contributors are not
silently discarded. A translation citing a single uncollected original on the
expected original branch and exact path can still join another version with
the same origin/path and shared author. Adding a compatible explicit source
credit must not detach previously supported translations.

Two collected translations citing the same single explicit original URL can
share one node even when their paths differ and the original is uncollected.
Conflicting or multiple original credits, incompatible known origins and
distinct pages on one hosting site remain guarded. Validation rechecks the
shared original URL against both saved source records. No original placeholder
or new catalog article is added.

`node research-board/refresh-identities.js [language]` refreshes the unresolved
single-language nodes that already have same-origin/path counterparts, plus
those existing counterparts only. The queue is resumable through per-page
captures, has a global request/time budget and at most one active request per
hosting site. Failed observations back off for one day; refined metadata is
rechecked after 28 days if identity remains unresolved. The existing weekly
language jobs run a 150-request / 3-minute pass after normal source collection.

If distinct pages on one site cite the same original URL, that URL is not a
unique work identifier (for example a shared deletion notice or collection).
Such credits stay in source metadata and produce `non_unique_original_credit`
review entries, but cannot merge those different works. Independent matching
path/author evidence can still identify the individual translations.

FTML capture freshness validates the page, format and capture timestamp. The
ordinary RU catalog hashes its source string, whereas research evidence hashes
the full API response; comparing those two hashes would incorrectly reject a
successful API capture. HTML captures additionally compare content hashes.

The 2026-11-08 targeted pass revisited all 1,892 selected/counterpart pages and
retried transient failures successfully. After the additional JP/CN label pass,
40 of the original 851 translation-counterpart cases and 81 of the original 301
native-counterpart cases became multilingual nodes; 811 and 220 respectively
remain held. These cohort outcomes trace the original page URLs into the new
graph. Of the first group's 40 resolutions, 22 used an actual original or alias
at a different path rather than the previous same-path candidate.

The graph contains 59,123 work nodes / 125,023 retained page URLs, with 26,083
edges after current body-link extraction. Identity counts must not be reduced
by forcing unknown authors or generic/shared source URLs to match. Full Node
tests and actual Flutter payload installation, identity/read and reference
direction checks pass. Schema 3 and existing article IDs remain unchanged.
