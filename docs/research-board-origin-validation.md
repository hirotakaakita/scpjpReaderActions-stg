# Original-work repair validation

The current repair follows a unique explicit original-article credit when the
native catalog page, origin branch and article kind agree. A same-site collision
keeps the claimed translation in a separate work for review. That rejected claim
is not a successful identity proof and must not reserve the original's numbered
identity in the validator. Exact original merges still require their recorded
`explicit_scp_original_credit` proof; an arbitrary split without a real same-site
collision is rejected.

`research-board/validate.js` exports `validateBoard()` so both persisted-board
validation and an isolated preview execute the same identity, catalog membership,
category, alias, ambiguous itemId and reference-proof checks. The persisted-file
entry point additionally checks the manifest, payload checksum and deterministic
rebuild. The preview checks its freshly generated board in memory and conserves
the previous member URLs and aliases; it does not publish or rewrite source shards.

## Reproduce from repository root

Use Node 24 and `npm ci`, then:

```sh
node --test test/research-board-explicit-origin.test.js test/research-board-article-work-resolver.test.js test/research-board-reading-itemid.test.js
node tool/preview-research-board-origin-fix.js research-board-origin-preview
node tool/review-research-board-origin-diff.js research-board-origin-preview research-board-origin-preview/semantic
node tool/audit-board-reading-itemids.js research-board-origin-preview research-board-origin-preview/itemid-compat
node tool/validate-board-article-resolver.js research-board-origin-preview research-board-origin-preview/resolver
node --test
```

The original-identity preview workflow runs this complete pipeline from the
checked-out commit. Its full repository tests are a separate job so unrelated
test failures remain visible without suppressing the diagnostic preview. The
manual semantic-review workflow calls the same pipeline at its own ref. Neither
workflow downloads another run's artifacts or depends on their expiration dates.

## Reproduced against master data on 2026-11-23

- Published input revision: `c7913a677358895cf0c3`.
- Validated preview revision: `f693e54930396d0ddd8f` (unchanged by the validator fix).
- Catalog member URLs: 125,100 before and after; no lost previous aliases.
- Work nodes: 55,089 to 55,110; reference edges: 150,169 to 150,222.
- 32 changed page owners: 11 original merges, 21 protected same-site splits.
- 28 removed and 81 added aggregated edges, all tied to affected works.
- EN SCP-179 follows ES-026; native ES-179 remains separate.

## Initial STG publication payload (2026-11-23, PR #2)

PR #2 published revision `f693e54930396d0ddd8f`, payload
`board-886506eadf80a7034934882ff82faff6a25b1ee8da8fa062834d3fa36380712a.json.gz`.
Its decoded contents exactly match the validated preview. The full persisted
manifest/checksum, proof and deterministic rebuild validation passes. Previous
board payloads remain available for cached pointers. Catalog itemIds and source
records are unchanged; platform-only gzip header changes were excluded.

The former weekly-feature failure `de/scp-series-1264` was resolved in PR #3.
All 382 tests passed without skips after repairing eight stale selections and
adding plan synchronization. Deferred editions now retain their selections and
return automatically when at least five eligible articles are available again.

## Audit follow-up (2026-11-23)

The current payload is revision `567e87a668607aa8babd`, SHA-256
`7f729ad7a24d9b2e8eb728cc8784e46e26b50c5cd147c16585902197d56a70c9`.
All 125,100 catalog URLs and every previously published work alias are conserved.
The board contains 54,953 works and 157,423 edges; 166 page owners changed.

The 198 previously unchecked pages were successfully captured. Both the saved
coverage file and an independent recomputation report 125,100 checked and zero
pending pages. Publication now refreshes this report in the generation path.
Unchanged source shards retain their exact gzip bytes across operating systems.

Unique explicit credit chains now reach a native original through intermediate
translations, with each hop retained in an identity proof. Cycles, multiple
originals, incompatible article kinds and same-site collisions remain blocked.
ZH-TR, CS and DE SCP-179 follow EN SCP-179 to ES-026; ES-179 remains distinct.
Nordic `sv:` delivery pages can follow exact credits while preserving their old
opaque scoped aliases. Unknown/draft namespaces do not gain numeric identity.
The identity-only preview conserved all prior aliases and catalog URLs.

The current provenance scan finds 11,712 unique pointers: 11,281 already share
a work and 431 remain separate with recorded hold reasons. The latter comprise
254 originals outside the catalog, 50 same-site collisions, 40 retirement-notice
targets, and 87 other publisher-identity review candidates. Seven multiple-
original claims are separately held. These are evidence-review candidates,
not 438 established implementation defects, and must not be merged by number.
`identity-provenance.js` exports every case with its exact credit, chain, source
hash, capture time and disposition; regenerate its JSON/CSV when data changes.

Russian FTML pages are included in ordinary audit sampling. Fifty targeted
pages matched the graph; both parsers agreed on all 50 identical responses and
their frozen replay (zero link differences). Static FTML includes/modules still
are not expanded. These checks are sample diagnostics, not whole-corpus proof.

Historical November 22 reports describe older snapshots and cannot establish
current acceptance. Raw artifacts and the new holdout results must be retained
with the exact board revision used by each audit.

## Independent 500-page holdout and final repair

The holdout used seed `holdout-complete-2026-11-23`, excluded the initial 500
sample URLs, included RU, and examined revision `4830220344422c55b038`.
All 500 responses were fetched successfully. The 32 byte-identical snapshots
had 3,253 matching references and zero false positives/negatives. The other
468 responses changed bytes and are not eligible for historical precision or
recall scoring. Four live disagreements were investigated separately.

- `scripture-for-microwaves` (ZH-TR): a chapter bar with a plain-text hub label.
- `scp-6380` (EN): 29 links in a "More From This Author" collection.
- `task-forces` (ZH-TR): an image-license source link.
- `k-class-complete-list` (JP): one newly observed narrative link to SCP-6789.

The first three were independent-verifier overcounts. Structural regression
tests now exclude those panels while retaining narrative links. The fourth
was present in both parsers; its current publisher record was refreshed in
the final payload. Its target already had an aggregated work edge from another
translation, so the total edge count is unchanged while its proof is added.

All four disagreements plus ten controls were saved as raw snapshots. Frozen
replay with the corrected verifier has zero parser disagreements, with exactly
the one newly observed narrative reference differing from the prior graph.
Explicit acceptance against the final repaired board compares those same
14 retained responses with zero remaining differences; the historical
artifact's revision is preserved. These diagnostics do not establish complete
official-index discovery or whole-population semantic correctness.
