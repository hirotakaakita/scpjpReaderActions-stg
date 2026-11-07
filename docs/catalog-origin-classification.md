# Original branch classification

The original branch is independent of the hosting language and article category.
The weekly `merge-catalog-indexes.js` pipeline now uses this order:

1. Article-specific provenance from existing catalog page types, publisher origin
   tags, explicit translation metadata, or canonical SCP identifiers.
2. A recognized branch in the official collection URL or the member's actual
   branch heading. Unknown suffixes such as `hub` and `arc` are not branches.
3. For untagged articles in selected native English collections only, the
   collection's native EN origin. This never defaults other sites to their hosting
   language, and translation markers or translation metadata block the default.
4. Keep the branch unclassified when evidence is missing or conflicting.

Article-specific conflicting origins remain unclassified. Mixed hub headings
cannot override a definitive article tag. Heading scopes follow heading levels;
sibling headings restore the parent/collection origin. Parser version 5 refreshes
old checkpoints during the normal scheduled crawl. Reclassification also ignores
unsubstantiated inherited heading origins in existing checkpoints, without needing
to download article bodies again. Explicit translation lookup can use already
collected records across all languages, without discovering any linked articles.

## STG reclassification on 2026-11-08 JST

- All 58,063 additional catalog URL/item-ID pairs are unchanged.
- All 75,285 board works and the 2 verified semantic edges remain present.
- Board works with an unknown branch: **23,074 → 15,966** (7,108 fewer).
- JP-hosted additional articles with an unknown branch: **713 → 13**.
- No invalid `arc`, `hub`, `j`, `la`, or `un` branch page types remain.
- Article category `other` remains 307; this is separate from unknown origin.
- Some previously assigned branches were revoked because they only had leaked
  heading evidence. Missing provenance, especially on translations, is deliberately
  retained as unknown rather than guessed from the hosting site or matching slug.
- No body/mutual links were added, no new article URLs were collected, and no
  user identity migration is required. Existing v1/v2 payloads remain unchanged.

`node --test` covers precedence, invalid suffixes, heading scope, native EN
collections, translation safeguards, and cross-site explicit translation metadata.
The published-board validator rebuilds the graph and checks exact catalog URL
membership and HOME article-category parity for every work.
