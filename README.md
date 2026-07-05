# Duplicate Doctor for Zotero

[![Zotero](https://img.shields.io/badge/Zotero-7%2F8%2F9%2F10-CC2936)](https://www.zotero.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Duplicate Doctor is a Zotero 7+ plugin that audits duplicate groups and safely
handles a common gap left by bulk duplicate workflows: same-DOI records where the
best item is a `journalArticle` but another copy was imported as a `webpage`.

It is independent software and is not affiliated with Zoplicate. It is designed
to complement Zotero's built-in duplicate pane and tools such as Zoplicate by
handling high-confidence cross-type DOI duplicates conservatively.

## Features

- Scan active regular Zotero items for duplicate-risk groups.
- Classify same-DOI duplicate groups.
- Auto-discard newly added/imported high-confidence duplicates by DOI or ISBN.
- Configure import-time deduplication from `Zotero Settings -> Duplicate Doctor`.
- Safely merge same-library `webpage` items into same-DOI `journalArticle`
  masters.
- Preserve collections, tags, valid missing fields, creators when the article
  has none, child attachments, child notes, and relations.
- Move merged webpage records to the Zotero trash instead of permanently
  deleting them.
- Move auto-discarded import duplicates to the Zotero trash instead of
  permanently deleting them.
- Leave same-title/different-DOI records for manual review.
- Generate a Mozilla-style `updates.json` with SHA-256 hash for release assets.

## Installation

### Method 1: Download `.xpi` (Recommended)

1. Download the latest `duplicate-doctor.xpi` file from
   [Releases](https://github.com/pandaAIGC/zotero-duplicate-doctor/releases).
2. Open Zotero -> Tools -> Plugins.
3. Click the gear icon -> Install Plugin From File...
4. Select the downloaded `.xpi` file.
5. Restart Zotero if requested.

### Method 2: Build from Source

Requirements: Python 3 and Node.js.

```bash
npm run check
npm test
npm run build
```

The release XPI is written to the project root:

```text
duplicate-doctor.xpi
```

`npm run build` also writes a Zotero/Mozilla-style update manifest to the
project root:

```text
updates.json
```

Copies are also written to `dist/` for local inspection. By default, release
URLs target:

```text
https://github.com/pandaAIGC/zotero-duplicate-doctor/releases/download/v<version>/
```

To build for another GitHub repository or release tag:

```bash
python scripts/build_xpi.py --repository <owner>/<repo> --release-tag v0.2.0
```

Or pass the final XPI URL directly:

```bash
python scripts/build_xpi.py --update-link https://example.org/releases/duplicate-doctor.xpi
```

The plugin adds:

- `Zotero Settings -> Duplicate Doctor` for auto-deduplication and merge policy.
- `Tools -> Duplicate Doctor` for manual scan, safe merge, and duplicate search
  refresh actions.

Do not install by only copying the XPI into the profile `extensions` directory;
Zotero will not necessarily register it in `extensions.json`.

For local development only, after closing Zotero, this helper can install the
built XPI into the current profile and back up `extensions.json`:

```bash
python scripts/install_to_profile.py
```

## Import-Time Auto Dedupe

Duplicate Doctor registers a Zotero item observer. When new regular parent items
are added, it waits briefly for Zotero to finish saving the import and then
checks the new records against existing active records in the same library.

If a newly added item has a DOI or ISBN already present in the library, the new
duplicate item is moved to the Zotero trash and a notification is shown. If two
duplicates arrive in the same import batch, the earliest item in that batch is
kept and later duplicates are moved to the trash.

This feature is enabled by default and can be configured from:

```text
Zotero Settings -> Duplicate Doctor
```

The settings page controls DOI matching, ISBN matching, whether child
attachments/notes of the discarded newly imported duplicate move to the trash,
and whether notifications are shown. The auto-discard feature intentionally does
not delete same-title matches with missing or conflicting identifiers.

## Release Checklist

Before publishing:

1. Confirm `manifest.json` has the intended public add-on ID and DOI Fix-style
   raw GitHub update manifest URL:

   ```text
   https://raw.githubusercontent.com/pandaAIGC/zotero-duplicate-doctor/main/updates.json
   ```

2. Build the XPI and update manifest for the final release tag:

   ```bash
   npm run check
   npm test
   python scripts/build_xpi.py --repository pandaAIGC/zotero-duplicate-doctor --release-tag v0.2.0
   ```

3. Commit the generated root `updates.json` so installed copies can check for
   updates through the stable raw GitHub URL.

4. Create the matching GitHub release, such as `v0.2.0`, and upload the root
   XPI file:

   - `duplicate-doctor.xpi`

5. Keep the `updates.json` URL in `manifest.json` stable. Future releases should
   rebuild and commit a new root `updates.json`, then upload the new XPI to the
   matching GitHub release.
6. Announce the plugin in the Zotero Forums after testing on a clean Zotero
   profile and a copied data directory.

7. Run the privacy/release tests before pushing a public repository:

   ```bash
   npm test
   ```

## Safety Model

Automatic merge is limited to groups with:

- same Zotero library
- same normalized DOI
- at least one `journalArticle`
- at least one `webpage`

The plugin does not automatically merge same-title records when DOI values are
missing or conflicting.

Import-time auto-discard is limited to DOI/ISBN identifier duplicates. Discarded
items are moved to Zotero trash, so they can be restored manually if needed.
