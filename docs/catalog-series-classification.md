# Numbered SCP series in mobile-v3

Additional official-index SCP rows previously used their base `pageType` as
`extractedFrom` for every number. HOME groups by that source; a base source is
series I, so SCP-1000-KO and larger numbers appeared under series I in several
viewing languages. The repair found 2,688 affected delivery rows across 17 sites.

Mobile-v3 now normalizes an unnumbered/base/legacy API SCP series source using
`floor(numericItemId / 1000) + 1`: 000–999 use the base source, 1000–1999 use
`<pageType>-2`, and 2000–2999 use `<pageType>-3`. Existing explicit numbered or
custom source listings are preserved. Joke/EX and document categories are not
renumbered by this rule. No work IDs, raw catalogs, article URLs, titles, tags,
bookmarks or reading records are rewritten.

Existing apps compare catalog delivery timestamps before reimporting data. If
an existing mobile-v3 payload has a different source listing and its source
timestamp has not advanced, generation advances the delivery timestamp once.
Repeated generation preserves that timestamp floor and produces the same bytes.
Mobile-v1/v2 keep their existing delivery behavior and endpoints. For a v3-only
repair use `generateMobileV3Catalogs(input)`; then regenerate/validate the shared
board, whose catalog timestamp is included in its revision.

The published gzip additional catalog takes precedence over a leftover local
uncompressed catalog, so a stale developer cache cannot restore pruned articles.

The Flutter source normalizer also recognizes base sources, not only `api`.
HOME and the reading ledger repair the cached article source field on access,
without a download or changes to user data. JSON/SQLite article models use the
same normalizer. Boundary, multi-branch, no-download cache repair and read/
bookmark preservation tests cover the behavior. Server delivery fixes work for
already-released mobile-v3 apps after their next successful catalog update; the
offline cache repair code is included in the next app build.
