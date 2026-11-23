# Research board ↔ Flutter article identity contract

Verified 2026-11-22 against the user's connected `hirotakaakita/scpReader` application repository and the isolated board preview of revision `080dc267576a8d4f0898`.

## Two identities, two purposes

1. **User progress / bookmarks:** the Flutter application stores `user_data.articleId` keyed to the article catalog's **`itemId`** in SQLite, and joins it with `articles.itemId`. The app deliberately persists this key when languages change. Relevant source files: `lib/services/database_service.dart`, `lib/models/scp_article.dart` in `hirotakaakita/scpReader`.
2. **Research board work:** the research-board `node[14][0]` is a **work ID**, unifying published versions. `node[13]` contains source page URLs; `node[14][2]` contains original catalog aliases. Work IDs **are not** SQLite user-data keys and must not replace them.

The identity fix changes source-page → work assignment for **32** URLs. It changes **zero** mobile catalog itemId values and makes **no changes** in the Flutter repository. Existing saved bookmark/history rows therefore are not migrated or deleted by this patch.

## Compatibility hazard for a future Research Board UI

In all **32** reassigned URLs, the previous work ID continues to resolve to a different work node. This is unavoidable where the prior ID was legitimately assigned to the unrelated native article (e.g. EN SCP-179 is translated from ES-026, but genuine native ES-179 retains its own `catalog:scp-series-es:scp-series-es-179` identity).

An app feature that looks up board work **only by an old catalog itemId/work ID** can consequently attach the wrong version. A future implementation MUST:

- First normalize and resolve the **exact source article URL** against `node[13][*][1]`. The URL is the bridge from a localized catalog article to its current board work.
- Accept a work-ID / catalog-alias lookup only when the intended original URL is unavailable **and** it is unambiguous for the operation. Do not infer another URL from a coincident SCP number.
- Keep the existing `articles.itemId` and `user_data.articleId` untouched. Do not write new work IDs to this table, migrate rows by SCP number, or automatically combine two users' reading states.
- For a missing or ambiguous mapping, retain ordinary article navigation and skip Research Board linking, rather than returning a possibly incorrect work.
- Add fixtures for EN SCP-179 → ES-026, genuine ES-179, ZH-TR SCP-179 (still unresolved), the two same-number translations of SCP-1097 with *different* credited originals, DE SCP-1114/EN SCP-114 site conflict, and namespaced Nordic `sv:scp-019`.

## Automated evidence

`tool/review-research-board-origin-diff.js` emits `WORK_ID_LOOKUP_RISKS.csv` from the immutable full preview. It asserts source-page uniqueness, verifies the 32 migration decisions, confirms all 109 edge changes are associated with changed works, and reports the old alias owner for every moved source URL.

**STG data publication (2026-11-23):** the direct-credit repair is included in board revision `f693e54930396d0ddd8f`, with 125,100 catalog source URLs and unchanged mobile itemIds. URL-first lookup and full-board validation are covered by the acceptance pipeline. Protected same-site splits and unresolved transitive credits remain review candidates; no Flutter read-history migration is performed. See [the current validation and publication record](research-board-origin-validation.md).
