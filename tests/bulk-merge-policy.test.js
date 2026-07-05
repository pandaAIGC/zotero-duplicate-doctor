const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const runtime = fs.readFileSync(path.join(__dirname, "..", "chrome/content/duplicateDoctor.js"), "utf8");
const mergeStart = runtime.indexOf("async function mergeDuplicateItemSet");
const chooseMasterStart = runtime.indexOf("const master = await chooseMasterItem(items)", mergeStart);
const specialCaseStart = runtime.indexOf('Zotero.ItemTypes.getName(item.itemTypeID) === "journalArticle"', mergeStart);

assert(mergeStart >= 0, "mergeDuplicateItemSet should exist");
assert(specialCaseStart > mergeStart, "journalArticle/webpage mixed DOI groups must be special-cased");
assert(chooseMasterStart > specialCaseStart, "journalArticle/webpage special case must run before generic master selection");
assert(runtime.includes("await mergeWebpageIntoArticle(masterArticle, webpage)"), "webpage records should merge into the journal article master");
assert(runtime.includes("failedGroups"), "bulk merge should report per-group failures without aborting the entire run");
assert(runtime.includes("Duplicate Doctor skipped duplicate group after merge error"), "bulk merge should skip failed groups and continue");
assert(runtime.includes("return sameTypeOthers.length > 0;"), "cross-type groups that cannot be safely merged should be skipped");
assert(runtime.includes("item.itemTypeID === master.itemTypeID && item.libraryID === master.libraryID"), "same-type merge should filter by type and library before calling Zotero mergeItems");

console.log("bulk-merge-policy.test.js passed");
