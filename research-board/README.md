# Research board delivery

The existing weekly `scp-crawler.yml` owns this pipeline. `CAPTURE_RESEARCH_BOARD=1`
extracts evidence from the same HTML/API responses used by the normal crawler.
There is no graph-specific crawler schedule, model review process or Release upload.

After catalog merging and manga flags, `node mobile-catalog.js` produces the
unchanged language catalogs plus one shared `local-data/mobile-v1/research-board/`
gzip/manifest. The app checks that manifest at startup, including when the language
catalog timestamp is unchanged. Content hashes avoid mixed CDN revisions.

`local-data/research-board-sources/` contains checksummed gzip shards of public
extracted observations (not complete HTML/bodies). These are durable crawler
inputs, not app downloads. New successful captures replace prior links; failed
captures retain previous observations with their original date/status. A verified
404 removes outgoing claims. Newly referenced documents without captured bodies
remain explicitly unexamined. No missing source shard is silently ignored.

Initial migration from the previously checked local corpus was performed once:

```
node mobile-catalog.js local-data local-data/mobile-v1 --seed-research-sources relations/.cache/records
```

Subsequent runs need only `node mobile-catalog.js`. `node research-board/validate.js`
rebuilds the actual board from committed inputs and checks the published payload.
The existing STG validation workflow runs this without a recrawl. STG uses the
same Sunday 00:00 UTC schedule as production with its own repository guard and
publication lock. Production deployment is deferred while STG is evaluated.

The URL identity/extraction and visual layout helpers were adapted from the
earlier experimental branch. Generation, transport and client installation are
implemented for mobile catalog delivery; no old graph workflow is restored.

SCP Wiki derived data is CC BY-SA 3.0:
https://creativecommons.org/licenses/by-sa/3.0/
Original page URLs, content hashes, source dates and available author metadata
are retained. The app exposes the source for each relation. Shared tags or SCP
numbers never imply interaction, canon membership or translation equivalence.
Semantic assertions remain partial and require source-specific exact quotations
or explicit publisher canon breadcrumbs.

Regions now follow the reading ledger's work classification (`pageType`), not
the site hosting a translation. For example, SCP-1537 on the Japanese site
belongs to EN, while SCP-1537-JP belongs to JP. Page URLs/nodes and evidence
remain separate. Node columns 11 and 12 retain the hosting branch and pageType.
Catalog pageTypes take priority; publisher origin tags and canonical SCP IDs
cover additional pages. Documents without a supported origin remain in `other`
rather than treating their hosting language as proof. The app labels the actual
hosting branch and prefers that language's page in classified search results.
