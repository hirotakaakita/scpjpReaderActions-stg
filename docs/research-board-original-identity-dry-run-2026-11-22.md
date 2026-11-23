# Research Board: original SCP identity fix — full dry-run verification

Verification: 2026-11-22. Base revision: d1169d1aedd310205196. Preview revision: 080dc267576a8d4f0898.

Evidence: [Actions run 45022044107](https://github.com/hirotakaakita/scpjpReaderActions-stg/actions/runs/45022044107), artifact research-board-original-preview-45022044107.

## Result

The targeted original-credit regression suite, the complete repository unit test suite and a **read-only full-corpus in-memory rebuild** passed. The script checked all original catalog page URLs, preserved prior catalog reading aliases, identity proof integrity, link evidence with original source hashes, and the corrected ownership of EN SCP-179.

| Measure | Before | Preview |
| --- | ---: | ---: |
| Catalog member URLs | 124,860 | 124,860 |
| Work nodes | 54,879 | 54,900 |
| Aggregated reference edges | 147,592 | 147,645 |

32 source pages change their parent work ID. 28 aggregated reference edges are removed and 81 are added. All old catalog identity aliases remain assigned; none were lost. The first broader attempt lost 126 aliases involving Nordic namespace paths; the final implementation excludes nonstandard namespace slugs from automatic credit override and the full validation passed.

EN SCP-179 now belongs to catalog:scp-series-es:scp-series-es-026 with the native ES-026 original; the distinct native ES-179 remains catalog:scp-series-es:scp-series-es-179. Related ZH-TR SCP-179 still has a different work key and remains a review item. Other correctly evidenced changed-number translations include EN SCP-2104 → ES-004 and EN SCP-6470 → CN-2469.

## Re-assessment of original-credit review candidates

| Audit class | Before | Preview |
| --- | ---: | ---: |
| Exactly same work | 10,788 | 10,799 |
| Split work candidates | 240 | 257 |
| Native collision candidates | 78 | 50 |
| Credited original not cataloged | 248 | 248 |

The 318 original split/collision candidates were re-evaluated against the new graph; 307 remain flagged. Seven source pages have multiple original credits. These are **review labels**, not 307 proven crawler bugs. A formerly improper merger can correctly become a split; automatically fixing all remaining entries would be unsound.

## Review and shipping status

This draft PR contains code changes, regression tests and the isolated diff tool, but has **not** changed STG or master. Full technical integrity is green; semantic review of the 32 source-work moves, their 81/28 edge differences and other credit anomalies still remains before merging.

Artifact files: SUMMARY.json, moved-page-owners.csv, rewired-edges.csv, original-credit-review.csv, original-credit-review.json, and preview-board.json.gz. Each is generated without changing local-data.

The previous independent-audit PR #1 remains separate. RU API/FTML sampling and unknown historical HTML source snapshots were not changed by this patch.
