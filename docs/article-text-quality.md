# Article title and excerpt quality

Every published mobile-v3 row is scanned by `tool/audit-article-text.js`.
The report is persisted as `local-data/article-text-audit.json.gz` and records
counts by language, unresolved findings, source pages without extractable prose,
and date-prefixed narratives retained in their original form.

Extraction version 3 fixes CSS theme source shown in Wikidot code blocks,
hidden theme installation instructions, FTML comments and CSS modules,
author/rating/ACS/adult-warning controls, and generated UI timestamps.
Portuguese `Descrição` and labels nested inside colored spans are supported.
The article request uses HTTPS even when a historical catalog URL uses HTTP.
Blank list titles fall back to the actual page heading. Valid titles such as
`Untitled` and `Null` are preserved. The repair does not guess a title from a
different article with the same SCP number.

`repair-catalog-excerpts.js` also fetches empty/null excerpts, missing titles,
and older short/date-prefixed previews. Date-prefixed diaries and intentionally
redacted short text are compared with the source and retained when genuine.
Image-only pages keep their identity and a verified empty-prose status;
only explicitly missing source pages are retired. Each observation is applied
only to matching source URLs and prior excerpt hashes in the primary, indexed
and retained caches. Checkpoints can resume failed repair runs.

The weekly `scp-crawler.yml` refreshes all published article kinds through the
same `refresh-article-text.js` stage. SCP, Joke and EX page fetching uses the same
`fetchRecord` transport/parser as Tales, GoI, hubs and supplements. Previews use
the same 500-code-point limit. Only article URL discovery differs by source.
Official-index discovery no longer has its own 600-article content queue; the
common refresh stage reads every collected URL. Successful captures from the
current invocation avoid fetching numbered SCP pages twice; old healthy caches
do not exempt any kind of article. Incomplete refreshes prevent publication.
To resume a full crawl after article retrieval failures, dispatch the current
`master` with `repair_excerpts_only=true`, `resume_crawl_run=<earlier run ID>`,
and `excerpt_repair_run=<earlier run ID>`. The crawl artifacts (including new
articles and index membership) are restored and passed through publication;
validated successful text edits are reused and unfinished retrievals are retried.
All language reports must complete before publication. Source artifacts must
still be available (retention is three days). No run-specific failure exemptions
are applied.

The normal weekly schedule stays unchanged. The legacy `repair_excerpts_only`
switch can skip discovery when resuming, and `excerpt_repair_run` reuses earlier
completed observations.

```sh
node --test
node tool/refresh-article-text.js jp
node tool/audit-article-text.js --strict
```
