# Official-catalog research board (STG)

The only article membership input is the currently published `mobile-v3/<language>/manifest.json` and its hash-verified catalog. A body hyperlink never discovers an additional node. Pages outside the fetched catalogs, including synthetic organizations, are excluded.

Run `node mobile-catalog.js` in the existing weekly crawler workflow. The command generates mobile-v1/v2/v3 as before, then the shared `mobile-v3/research-board/manifest.json` and immutable gzip payload. No new schedule, AI request, Firestore read, or independent crawl is introduced. New body requests made by the existing crawler optionally capture source-specific assertions and explicit translation metadata for the next build.

## Scope and identity

- Article existence, title, category and original branch come from the official-index catalog, not the hosting language of a translation.
- The ledger identity `pageType + itemId` merges the normal SCP translations. An exact shared page URL or an explicit publisher translation assertion can establish additional aliases. Unrelated branch originals, proposals and variants remain distinct.
- All accepted identities of a merged work are retained in schema 3. Classification-rejected IDs cannot leak into aliases. Aliases cannot belong to multiple nodes.
- Catalog rows, IDs, bookmarks and reading history are never rewritten by the board generator.
- SCP, record/log, hub, Tale, GoI format and setting categories occupy separate districts. Invalid origin codes stay unclassified rather than creating invalid branches.

## Relationships

**Mutual/article hyperlinks are not used.** Body, addendum, log and footnote links are neither extracted nor saved by this feature. Translation metadata is used only to consolidate already-cataloged versions and is not drawn as an edge.

Only source-specific, previously reviewed semantic assertions with exact quotes, or approved explicit canon breadcrumbs, can create edges between existing catalog members. Latest failed/deleted observations suppress older assertions. Metadata with a changed content hash cannot preserve an old semantic assertion without revalidation. Merely having a link, a similar identifier, a shared generic tag or nearby layout positions is not evidence of a story relationship.

Current snapshot: 125,032 catalog rows / 125,023 distinct page URLs → 75,285 work nodes, **2 verified semantic edges**. This is not an exhaustive semantic review of all articles. Isolated works remain visible. Gzip: 5,781,320 bytes; decoded JSON: 41,234,531 bytes (the manifest is authoritative after subsequent updates).

## Rendering and update contract

The Flutter app installs the shared gzip during startup into immutable local shards in an isolate. Only visible geometry and selected relations/evidence enter bounded caches. Search uses a compact branch index rather than repeatedly decoding all node versions. The same graph revision is reused across content languages. Failed updates keep the last valid version; open routes pin their version. Corrupt local shards mark the snapshot for reinstallation, even when the remote revision is unchanged.

`node research-board/validate.js` validates checksums, exact catalog membership, work/alias uniqueness, excluded link types, classifications and deterministic regeneration from saved inputs. Existing STG validation and weekly publication both run it. Production Actions are unchanged and the production app does not enable or download the board by default.

## HOME category parity (2026-11-08)

Article types now exactly follow HOME's `ArticleClassification.category`: SCP, SCP-EX, JOKE-SCP, Tale, GoI, record, setting, hub and other. Source tags and URL patterns cannot override the catalog category. Work consolidation runs first; the representative catalog row determines the final category. Districts and the Flutter legend follow HOME's category order. Flutter reuses HOME's localized labels for all supported locales.

The stable numeric wire IDs remain separate from that display order, with EX=8 and JOKE=9 added. Existing STG clients reject those unsupported IDs and preserve their prior snapshot; install the updated STG APK. Shared contract fixtures cover the Dart/JavaScript mapping, and validation checks all 75,285 published work categories against the underlying catalog rows.
