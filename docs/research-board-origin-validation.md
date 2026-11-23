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

The existing full-suite failure `de/scp-series-1264` in the weekly-feature plan
also reproduces on unchanged master. It remains visible and is not suppressed
by these workflows. This repair does not change feature plans or reading IDs.

The historical November 22 reports describe an older data snapshot. Do not use
their counts as current acceptance results. Original-credit review candidates
and the ZH-TR SCP-179 transitive relationship still require publisher evidence;
they are not automatically merged. A passing preview does not establish the
historical correctness of every original credit or authorize publication.
