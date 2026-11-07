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
