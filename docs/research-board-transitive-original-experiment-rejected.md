# 2-hop SCP credit experiment rejected by complete evidence validation

Evidence: [failed isolated full-corpus run 45025319578](https://github.com/hirotakaakita/scpjpReaderActions-stg/actions/runs/45025319578). Experimental branch: `experiment/research-board-transitive-credit-20261122`. This branch is **not** part of Draft PR #2.

## Precise failure

The independent fixture suite and the existing complete unit test suite passed (339 tests in experimental run), but **the full catalog rebuild validation failed** with `Unproven two-hop original SCP credit`.

In the experimental output, the independent literal credit chain
`CS SCP-179 → EN SCP-179 → ES SCP-ES-026` was accepted as a two-hop link into ES-026. However, the *intermediate EN SCP-179* had become isolated into `catalog:scp-series:scp-series-179@original-64469bd332c6`, while CS SCP-179 was attached to the ES-026 work. The target native ES-026 was still correctly at its canonical key, but all three did **not** belong to one provable work component.

Examining `preview-board.json.gz` (retained only as a diagnostic artifact) also showed `EN SCP-179 → ES-026` rejected with `conflicting_component_origins`: accepting a CS page whose assigned catalog-origin branch was EN into the ES original's group introduced conflicting native-origin claims and blocked the direct EN-ES assertion. DE and ZH-TR SCP-179 also remained isolated, proving the proposal **regressed a previously fixed identity**.

The failed experimental preview was NOT published or merged. It had 54,905 nodes, 147,657 edges and 37 moved pages; those counts must **not** replace the last validated PR #2 output (54,900 nodes, 147,645 edges, 32 moved pages).

## Guardrails going forward

- Existing Draft PR #2 deliberately follows **a unique, verified direct publisher credit only**. It continues to map EN SCP-179 to ES-026, and all previous 124,860 catalog source URLs and old ID aliases are maintained.
- A future transitive-origin implementation must validate **all intermediary works and their inherited original branch** before constructing a single component. Matching URLs is not enough: the catalog-origin/pageType of a secondary translation may differ from the ultimate original. Native branch conflicts and same-site duplicate article URLs must be resolved by evidence, not waived.
- Require the same full dry-run gates, exact work identity proof validation, preservation of all reading/catalog IDs, and the absence of newly incompatible origin component merges.
- Do not ship or merge the experiment on test-fixture success alone.

The base PR adds a permanent unit regression asserting that a secondary translation credit cannot invalidate a correctly proven direct original identity.

No STG, master, or Flutter user data was modified.
