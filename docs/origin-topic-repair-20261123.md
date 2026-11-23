# English topic-tag origin repair

The ordinary English tag `pig` describes article subject matter. Only the
publisher's explicit `_pig` tag denotes Pig Latin origin. The corrected origin
parser repairs 23 numbered English articles and SCP-1551-EX, which shared the
same defect.

The stored official catalogs already classify these rows as English. The
two-scenario preview found zero catalog rows requiring a pageType rewrite.
Therefore the catalog payloads, itemIds, URLs and source observations are
unchanged. The rebuilt board is revision `b53af973497a96159bc3`, with 125,100
source URLs, 54,929 works and 157,368 aggregated edges.

The 24 previous work keys are retained in `research-board/reviewed-work-aliases.json`.
The alias applicator rejects conflicting owners and never reintroduces removed
catalog pages. No reading-state key is dropped. Comparing the previous and new
graphs verifies that every relation survives remapping except self-work links
and duplicate edges created by the reviewed work merges.

Reproduce with Node 24 and installed dependencies:

```sh
node --test
node research-board/validate.js
node tool/verify-board-migration.js \
  local-data/mobile-v3/research-board/board-7f729ad7a24d9b2e8eb728cc8784e46e26b50c5cd147c16585902197d56a70c9.json.gz \
  local-data/mobile-v3/research-board/board-5e3cdad685d6e7196deb8c4f8683054b2657f05a6dee17a17b3e12d6c1d6f466.json.gz
```

The postmerge audit reports remain historical evidence for revision
`567e87a668607aa8babd`. Their provenance-review candidates are not automatic
merge instructions. The new migration changes only the 24 evidenced origins.

Use `tool/` for reusable diagnostics and `research-board/verification/` for the
independent verifier. `relations/`, `.board-*.cjs`, and `__pycache__/` are local
outputs or scratch material. Older untracked investigations were archived
locally before cleanup; source hashes and restoration patches are retained.
