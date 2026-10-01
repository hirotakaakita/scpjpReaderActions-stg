# SCP Reader Stg data service

This repository is the isolated staging deployment of `hirotakaakita/scpjpReaderActions`.
Initial snapshot: production commit `4dcfb1fc466685375897d2a2930cfb1b8542da74` (2026-10-01).

- Android package: `com.scp.reader.stg`
- Firebase project: `scpjp-reader-stg`
- Public data: `https://raw.githubusercontent.com/hirotakaakita/scpjpReaderActions-stg/refs/heads/master`
- Catalog, manga and maintenance configuration are served from this repository only.
- `SCP Crawler STG` runs manually on master; automatic scheduled crawling is disabled.
- Pushes run `Validate staging`, which checks catalogs and notification isolation without crawling or sending messages.
- Notification topics: `stg_new_scp_<language>`; titles start with `[STG]`.
- The crawler's `stg` GitHub environment uses the `STG_FIREBASE_SERVICE_ACCOUNT_JSON` secret, never production credentials.
- Grant the staging sender only Firebase Cloud Messaging API Admin (`roles/firebasecloudmessaging.admin`) on the staging project. Never paste the key into repository files or logs.
- Explicitly enable `send_push_notifications` for a notification test after credentials and a staging test device are ready. No secret means no notifications.
- Production credentials are rejected before token creation or network access.
- New deployments must preserve these staging changes. Do not merge production workflows or notification code over them without review.
- The original README below describes the crawler; its production URLs are reference material, not staging deployment destinations.

Staging app build and Firebase setup instructions are in the app repository's `docs/staging.md`.
