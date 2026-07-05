const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const preferences = fs.readFileSync(path.join(root, "chrome/content/preferences.xhtml"), "utf8");
const defaultPrefs = fs.readFileSync(path.join(root, "prefs.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "chrome/content/duplicateDoctor.js"), "utf8");

const uiPrefKeys = [...preferences.matchAll(/\bpreference="([^"]+)"/g)].map((match) => match[1]);
assert(uiPrefKeys.length > 0, "preferences.xhtml should bind controls to Zotero preference keys");

for (const key of uiPrefKeys) {
  assert(
    defaultPrefs.includes(`pref("${key}"`),
    `UI preference ${key} must have a default in prefs.js so Zotero can persist it predictably`
  );
  assert(
    runtime.includes(key),
    `UI preference ${key} must be read by runtime code, not only displayed in settings`
  );
}

const expectedRuntimePrefs = [
  "extensions.duplicateDoctor.duplicate.default.action",
  "extensions.duplicateDoctor.bulk.master.item",
  "extensions.duplicateDoctor.duplicate.stats.enable",
  "extensions.duplicateDoctor.autoDiscardNewDuplicates",
  "extensions.duplicateDoctor.autoDiscardByDOI",
  "extensions.duplicateDoctor.autoDiscardByISBN",
  "extensions.duplicateDoctor.trashChildrenWithDuplicate",
  "extensions.duplicateDoctor.showNotifications",
  "extensions.duplicateDoctor.safeMergeWebpageIntoArticle",
];

for (const key of expectedRuntimePrefs) {
  assert(uiPrefKeys.includes(key), `Runtime preference ${key} should be configurable from Zotero Settings`);
}

console.log("settings-binding.test.js passed");
