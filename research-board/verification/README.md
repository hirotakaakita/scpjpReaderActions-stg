# Research board independent verification

This directory contains an **independent, read-only audit** of the existing research-board data. No publishing, STG writes, catalog changes or crawler checkpoint mutations occur.

## Verification contract

- A directed reference \`A -> B\` exists when an eligible hyperlink occurs in the article body of a catalog member belonging to work A, and the destination belongs to a **different** catalog work B.
- Evidence from translated pages counts toward the shared source/target work. Do not equate a translated article with a separate SCP.
- Exclude author credits, licenses, global navigation, translation metadata, missing-page links, fragments, self-work links and unsafe URLs.
- Record links into uncollected/non-catalog pages as **outside_catalog**, separate from false negatives.
- Explicit source-specific semantic relations (experiments, canon associations, etc.) are **not** \`references\` edges and are not evaluated by this audit.
- Dynamic scripts, includes, modules, iframe content and interactive DOM may be absent from static HTML or FTML. The script reports these limitations; do not claim a comprehensive semantic audit.

## How it works

1. **Coverage inventory.** Read \`local-data/research-board-body-link-coverage.json.gz\`. Export URL, branch, unresolved reason, and retry-after to \`unresolved-pages.csv\`. This includes the remaining Russian, English and German failures when still present in the published snapshot.
2. **Sampling.** Read the published manifest, hash-verify the board, construct original-page-to-work mapping, and extract per-page expected \`references\` from proof URLs. Choose up to 500 pages with a fixed seed: 250 representative, 50 zero outgoing links, 50 high-degree, 50 translations, 50 unusual formats and 50 identity-risk cases. A stratum with too few candidates is topped up from other pages. Representative sampling guarantees at least one per supported language.
3. **Independent capture.** Fetch page HTML/FTML with explicit host restrictions, manual redirect checks and >=1-second request spacing. HTML uses its own DOM walk; FTML uses an independent token scanner. This path **does not call** \`research-board/extract.js\`, \`catalog.js\`, or their link methods.
4. **Comparison.** Map observed target URLs to work IDs and compare the directed edges with published \`references\`. Record extra published edges (FP), missing published edges (FN), source element/selector/quote and ignored destinations.
5. **Freshness guard.** Compare response SHA-256 with the stored source snapshot. Only byte-identical pages are scored in precision/recall. Changed content, missing snapshots, network failures and unsupported dynamic markup are reported separately.
6. **Review / holdout.** Investigate differences, fix the crawler only after separate review, then rerun with a different seed and \`--exclude\` from the initial \`audit.json\`.

## Commands

From repository root (Node 24 / \`npm ci\`):

\`\`\`sh
node --test research-board/verification/verification.test.js
node research-board/verification/audit.js --inventory --out research-board/verification/audit-results
node research-board/verification/audit.js --limit 25 --seed smoke-2026-11-19 --out research-board/verification/audit-results
node research-board/verification/audit.js --limit 500 --seed 2026-11-19-initial --out research-board/verification/audit-results
node research-board/verification/audit.js --limit 500 --seed holdout-2026-11-19 --exclude research-board/verification/audit-results/audit.json --out research-board/verification/holdout-results
\`\`\`

A separate, read-only Actions workflow, \`.github/workflows/research-board-verification.yml\`, runs tests, inventory and an independent sample audit. Reports are stored as short-lived **workflow artifacts**, not committed back to the repository.

## Outputs

- \`inventory.json\`: total, checked, pending and unresolved reasons (not necessarily just the originally failed 30 pages).
- \`unresolved-pages.csv\`: source URLs still unresolved in the current published snapshot.
- \`audit.json\`: revision, deterministic sample, page-level status and aggregate metrics.
- \`differences.csv\`: links and evidence for inspection; original HTML snippets are truncated to 450 characters.
- \`SUMMARY.md\`: concise statistics and methodological limitations.
- \`partial-progress.json\`: checkpoint-style progress in the current run; not a resume mechanism.

Only **byte-identical** source pages contribute to precision and recall. Both are sample statistics, not whole-population guarantees. Mixed language sampling is useful for finding bugs, not estimating corpus-wide rates without reweighting.

## Known limits and next stage

- This verifier checks the **published corpus**, not whether every official SCP index has been completely discovered. A future branch-by-branch official-index inventory is required for catalog recall.
- Source content hashes are byte-sensitive: innocuous page chrome changes can cause \`content_changed\` exclusions.
- Special chapter navigation and auxiliary-content cases may require human review. Sampled disagreements are candidates, not automatically crawler bugs.
- FTML transclusions and interactive scripts are not expanded. Track limitations rather than assuming zero missed links.
- Once discrepancies are reviewed, publish repaired extraction logic separately. Do not automatically modify production or STG from this verifier.
