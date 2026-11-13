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

Normal runs perform a bounded repair and record the full audit. Dispatching
`scp-crawler.yml` with `repair_excerpts_only=true` scans all languages, repairs
the complete candidate set and requires the final audit to pass before publishing.
Use `excerpt_repair_run` to reuse successful observations from a prior run.

```sh
node --test
node tool/repair-catalog-excerpts.js jp
node tool/audit-article-text.js --strict
```
