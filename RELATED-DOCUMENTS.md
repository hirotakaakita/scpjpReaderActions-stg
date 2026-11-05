# Related document catalogs (STG)

This extends the existing crawler and article delivery. It does not generate a
research board and does not change the production repository.

## Pipeline

1. Existing language crawlers capture body links, origin tags and explicit
   translation metadata while they already have the article HTML/API response.
   Ordinary crawling does not request each body a second time.
2. Existing partial artifacts carry those records to the merge job.
3. After the ordinary language catalogs are merged, `node related-documents.js`
   discovers links from those catalog articles, imports current captured records,
   fetches a bounded batch of missing/stale pages and writes an additional catalog.
4. `node mobile-catalog.js` includes successfully captured additional documents
   in the **ordinary `data` array of each language's existing gzip**. The manifest
   count, size and checksum cover the entire combined payload. No separate app
   download, graph manifest or graph data is needed.

`SCP Crawler STG` executes these steps in its existing merge/publish job and lock.
It retains its current dispatch schedule; this change does not create a second
workflow or enable production crawling. `Validate staging` runs the new tests.

## Files and limits

- `local-data/related-document-cache/??.json.gz`: resumable extracted metadata,
  links and attempts, not full HTML/FTML. This includes seed article records.
- `local-data/related-documents/catalog.json.gz`: additional metadata catalog,
  including classification evidence and the pending queue. Uncompressed JSON is
  a local intermediate and is ignored by Git.
- `local-data/mobile-v1/<language>/catalog-<sha256>.json.gz`: **combined articles**
  used by the app. Legacy `scp-data.json` and legacy metadata remain unchanged.

Default batch: at most 300 requests, 500 ms between requests and a 180-second
loop budget (an in-flight bounded request may finish after that budget). Missing
seed bodies receive up to a quarter of the batch when document work is pending.
There is no recursive traversal of additional document links. Newly discovered
links from a seed fetched in this batch enter the queue for a subsequent run.
Records are due after seven days; failed requests retry after seven days and
404/410/non-article responses after 28 days. Oldest attempts are prioritized so
failures do not indefinitely block untouched pages. A network failure preserves
an earlier successful document as stale; a confirmed deletion/non-article removes
it from usable additions while keeping a recheck entry.

Only configured SCP publisher hosts are requested; redirects are checked against
that allowlist. Queries that can invoke Wiki operations, management namespaces,
missing-page links and obvious navigation are excluded. Russian document bodies
use the existing public `/api/articles/<pageId>` endpoint instead of protected HTML.
Some linked pages are legitimate hubs/personnel/reference pages, not numbered SCPs.
They are kept as documents rather than assigned invented SCP numbers.

## Identity, classification and compatibility

Existing article IDs never change. Additional IDs are deterministic:
`document-<hosting-language>--<page-slug>`. They do not depend on the inferred
origin or the order in which pages are fetched. Unverified translations remain
separate page identities; matching names alone do not merge reading histories.
Origin comes from an existing catalog classification, publisher origin tags,
explicit translation metadata or a canonical SCP identifier, with conflicts
retained as unknown. Hosting language alone and ordinary references to an SCP
are not origin evidence. Catalog JSON retains evidence; ordinary mobile rows use
`pageType: related-document-<origin>` (or `related-document-unclassified`) and
`contentType: log | tale | hub | document`.

Additional documents are delivered only to their hosting language's catalog.
There is no guessed English fallback URL. Standard title, URL, excerpt and tag
fields let them use the existing article database, lists, search, in-app reader,
read history, bookmarks, recommendations and random reading. Tags reuse the
existing dictionary; previously unknown tags have stable IDs without guessed
cross-language translations. The existing world activity sharing service still
publishes only SCP IDs; no world activity backend change is included here.

The combined delivery timestamp is the later of the ordinary and additional
catalog timestamps. The app checks the mobile manifest first so additions trigger
an update even when legacy metadata is unchanged. If mobile delivery is unavailable,
the existing legacy fallback still works, with its ordinary articles only.
The previous gzip is retained for readers holding a cached manifest.

## Initial dataset and verification

Initial metadata was imported from the archived research-board feature branch's
public source records, not fetched again. No graph payload is imported or generated.
At the initial build: 67,192 distinct seed pages, 66,798 captured; 14,521 discovered
additional URLs; 12,557 usable documents (5,510 classified, 7,047 unknown) and
1,964 pending. These are page counts, not a proof of distinct translated works.
Japanese delivery adds 1,356 pages. Counts may change as validation/refresh proceeds.
The six initial live queue requests returned 404 and were recorded for rechecking;
they are not counted as newly captured pages.

Node tests cover extraction, allowlisting, API links, classification conflicts,
bounded resume, stale preservation/deletion and combined gzip generation.
Flutter tests import the combined format through the ordinary startup/DB path,
exercise document search/history/bookmarks/list sections, retain preexisting
user data, and detect a changed mobile timestamp despite unchanged legacy metadata.
An opt-in corpus test decodes all 17 actual generated gzip files:

```
flutter test --no-pub --dart-define=RELATED_CATALOG_CORPUS=true test/related_catalog_corpus_test.dart
```

Local generation without requests:

```
RELATED_DOCUMENT_MAX_REQUESTS=0 node related-documents.js
node mobile-catalog.js
```

Use `RELATED_DOCUMENT_IMPORT_DIR` only for a trusted saved metadata directory.
The ordinary weekly/dispatch pipeline does not require that bootstrap directory.
