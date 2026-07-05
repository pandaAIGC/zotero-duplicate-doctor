const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const runtime = fs.readFileSync(path.join(__dirname, "..", "chrome/content/duplicateDoctor.js"), "utf8");

assert(runtime.includes("function createDuplicatePaneControls"), "duplicate pane controls should be created by a helper");
assert(runtime.includes("messagePane.renderCustomHead"), "message pane controls should use Zotero's renderCustomHead hook");
assert(runtime.includes("PANE_CONTROLS_INNER_ID"), "duplicate pane controls should use a separate inner placement like Zoplicate");
assert(runtime.includes("PANE_CONTROLS_EXTERNAL_ID"), "duplicate pane controls should use a separate external/message placement like Zoplicate");
assert(runtime.includes("BULK_MERGE_INNER_BUTTON_ID"), "bulk merge button should have an inner ID");
assert(runtime.includes("BULK_MERGE_EXTERNAL_BUTTON_ID"), "bulk merge button should have an external ID");
assert(runtime.includes("NON_DUPLICATE_INNER_BUTTON_ID"), "non-duplicate button should have an inner ID");
assert(runtime.includes("NON_DUPLICATE_EXTERNAL_BUTTON_ID"), "non-duplicate button should have an external ID");
assert(runtime.includes('createMenuElement(doc, "button")'), "duplicate pane buttons should use Zotero/XUL buttons like Zoplicate");
assert(runtime.includes('chrome://duplicate_doctor/content/icons/${imageName}.svg'), "duplicate pane buttons should use plugin icon images like Zoplicate");
assert(runtime.includes('createPaneButton(doc, "merge")'), "bulk merge button should use the merge icon");
assert(runtime.includes('createPaneButton(doc, "non-duplicate")'), "non-duplicate button should use the non-duplicate icon");
assert(runtime.includes("duplicate-custom-head"), "button layout should match Zoplicate's duplicate-custom-head structure");
assert(runtime.includes("flex-direction: column"), "buttons should be stacked vertically like Zoplicate");
assert(runtime.includes("height: 28px"), "buttons should use Zoplicate's compact button height");
assert(runtime.includes("insertBefore(createDuplicatePaneControls"), "controls should be inserted before Zotero's duplicate/message pane head like Zoplicate");
assert(runtime.includes("function patchItemPaneHooks"), "item pane hooks should be patched so Zotero refreshes cannot clear controls permanently");
assert(runtime.includes("itemPane.setItemPaneMessage = function"), "setItemPaneMessage should trigger a button refresh after message pane changes");
assert(runtime.includes("itemPane.updateItemPaneButtons = function"), "updateItemPaneButtons should trigger a button refresh after custom head resets");
assert(runtime.includes('doc.getElementById("zotero-duplicates-merge-button")'), "duplicates merge pane should still support insertion near Zotero's built-in merge button");
assert(runtime.includes("unregisterDuplicatePaneUI(win)"), "controls should be removed when leaving the duplicate pane");
assert(runtime.includes("itemPaneRow?.isDuplicates?.()"), "duplicate pane detection should also check ZoteroPane.itemPane.collectionTreeRow");
assert(runtime.includes("/重复条目|Duplicate Items/i.test(title)"), "duplicate pane detection should fall back to Zotero's duplicate-window title");

console.log("duplicate-pane-ui.test.js passed");
