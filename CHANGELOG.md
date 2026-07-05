# Changelog

## 0.2.0

- Prepare the XPI for public distribution with a stable public add-on ID, GitHub release URLs, and a generic `duplicate-doctor.xpi` asset name.
- Generate Zotero JSON update manifests from the public manifest metadata.
- Remove local-profile assumptions from the local development installer.

## 0.1.14

- Avoid recounting duplicate groups when the selected duplicate-pane label already displays cached counts.

## 0.1.13

- Preload all non-duplicate decisions for a duplicate scan once, then use in-memory pair checks per group.
- Throttle bulk-merge progress updates to reduce UI churn on large duplicate sets.
- Reduce duplicate-pane polling frequency from 2s to 5s.

## 0.1.12

- Speed up duplicate-pane refresh and bulk merge preparation by caching duplicate groups for 30 seconds.
- Batch-load Zotero items during duplicate group construction instead of loading each item one by one.
- Replace per-pair non-duplicate checks with a single set-based SQL query per duplicate group.
- Skip duplicate count scans entirely when the active pane is not Zotero's duplicate items view.

## 0.1.11

- Make bulk merge resilient: skip failed duplicate groups, continue the batch, and report failed groups instead of aborting with a generic error.
- Skip cross-type duplicate groups that cannot be safely merged instead of counting them as processed.

## 0.1.10

- Refresh duplicate-pane button icons with cleaner modern line-style SVGs.

## 0.1.9

- Match Zoplicate's right-pane buttons more closely by using XUL buttons with merge and non-duplicate icons.

## 0.1.8

- Force a cache-busting release for the Zoplicate-style duplicate-pane layout.

## 0.1.7

- Render duplicate-pane buttons as HTML buttons so Zotero's custom message head displays them reliably.
- Match Zoplicate's duplicate-pane button layout: a vertical `duplicate-custom-head` stack with full-width 28px buttons.
- Detect the duplicate items view from the Zotero window title as a fallback.

## 0.1.6

- Keep duplicate-pane buttons visible after Zotero switches between duplicates pane and message pane by patching `setItemPaneMessage()` and `updateItemPaneButtons()`.
- Detect the duplicate items view from both `ZoteroPane.getCollectionTreeRow()` and `ZoteroPane.itemPane.collectionTreeRow`.
- Match Zoplicate's inner/external button model so a hidden duplicates pane button cannot block insertion into the visible message pane.

## 0.1.5

- Fix duplicate-pane buttons not appearing when Zotero shows the right-side “selected N items” message pane by using Zotero's `item-message-pane.renderCustomHead()` hook.

## 0.1.4

- Fix bulk merge dry-run finding: same-DOI `journalArticle` + `webpage` groups now force the journal article as master before generic oldest/newest/detailed selection.

## 0.1.3

- Add Zoplicate-style default duplicate action settings.
- Add Zoplicate-style duplicate pane bulk merge and non-duplicate buttons.
- Add local non-duplicate records, mark/unmark actions, and import/export.
- Add duplicate count display best effort support for the duplicate items pane.
- Keep the Duplicate Doctor import-time DOI/ISBN auto-discard enhancement.

## 0.1.2

- Fix Zotero Settings controls by localizing XUL checkbox/radio labels via Fluent `.label` attributes, matching Zotero and Zoplicate conventions.

## 0.1.1

- Fix Zotero Settings pane loading by using a stable pane ID.
- Keep preferences page as a Zotero XUL fragment instead of a full window.
- Add native preference controls for better Zotero Settings compatibility.

## 0.1.0

- Initial public-ready scaffold.
- Adds duplicate risk scan.
- Adds import-time auto-discard for newly added DOI/ISBN duplicates.
- Adds a Zotero Settings pane for auto-discard and safe-merge policy.
- Adds safe merge for same-DOI `webpage` into `journalArticle` groups.
- Adds Zotero duplicate search refresh helper.
- Adds XPI and `updates.json` builder.
