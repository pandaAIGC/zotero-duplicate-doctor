const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const runtime = fs.readFileSync(path.join(__dirname, "..", "chrome/content/duplicateDoctor.js"), "utf8");

assert(runtime.includes("DUPLICATE_GROUP_CACHE_TTL_MS"), "duplicate group scans should be cached");
assert(runtime.includes("duplicateGroupCache"), "duplicate group cache should be stored in state");
assert(runtime.includes("Date.now() - cached.timestamp < DUPLICATE_GROUP_CACHE_TTL_MS"), "duplicate group cache should use a TTL");
assert(runtime.includes("await Zotero.Items.getAsync(ids)"), "item loading should batch getAsync calls");
assert(runtime.includes("WHERE itemID IN"), "non-duplicate pair checks should use one set-based SQL query");
assert(runtime.includes("loadNonDuplicatePairSet(allItemIDs)"), "duplicate group construction should preload non-duplicate pairs once per scan");
assert(runtime.includes("hasAnyNonDuplicatePairInSet(items, nonDuplicatePairs)"), "duplicate group construction should use in-memory non-duplicate pair checks");
assert(runtime.includes("now - lastProgressUpdate > 250"), "bulk merge progress updates should be throttled");
assert(runtime.includes("}, 5000);"), "duplicate pane polling should avoid frequent full refreshes");
assert(runtime.includes("getDuplicateGroups(libraryID, { force: true })"), "bulk merge should force a fresh duplicate scan");
assert(runtime.includes("if (!row?.isDuplicates?.())"), "duplicate stats should skip scanning outside the duplicate pane");
assert(
  runtime.indexOf("label.textContent.includes(\"/\")") < runtime.indexOf("await countDuplicateItems(libraryID)"),
  "duplicate stats should skip counting when the selected label already has cached counts"
);

console.log("performance-policy.test.js passed");
