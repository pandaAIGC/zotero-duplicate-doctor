(function () {
  "use strict";

  const ROOT_MENU_ID = "duplicate-doctor-root-menu";
  const ROOT_POPUP_ID = "duplicate-doctor-root-popup";
  const SEPARATOR_ID = "duplicate-doctor-separator";
  const SCAN_MENU_ID = "duplicate-doctor-scan";
  const SAFE_MERGE_MENU_ID = "duplicate-doctor-safe-merge";
  const BULK_MERGE_MENU_ID = "duplicate-doctor-bulk-merge";
  const MARK_NON_DUPLICATE_MENU_ID = "duplicate-doctor-mark-non-duplicate";
  const UNMARK_NON_DUPLICATE_MENU_ID = "duplicate-doctor-unmark-non-duplicate";
  const REFRESH_MENU_ID = "duplicate-doctor-refresh-zotero-duplicates";
  const PANE_CONTROLS_INNER_ID = "duplicate-doctor-pane-controls-inner";
  const PANE_CONTROLS_EXTERNAL_ID = "duplicate-doctor-pane-controls-external";
  const BULK_MERGE_BUTTON_ID = "duplicate-doctor-bulk-merge-button";
  const BULK_MERGE_INNER_BUTTON_ID = `${BULK_MERGE_BUTTON_ID}-inner`;
  const BULK_MERGE_EXTERNAL_BUTTON_ID = `${BULK_MERGE_BUTTON_ID}-external`;
  const NON_DUPLICATE_BUTTON_ID = "duplicate-doctor-non-duplicate-button";
  const NON_DUPLICATE_INNER_BUTTON_ID = `${NON_DUPLICATE_BUTTON_ID}-inner`;
  const NON_DUPLICATE_EXTERNAL_BUTTON_ID = `${NON_DUPLICATE_BUTTON_ID}-external`;
  const NON_DUPLICATE_TABLE = "duplicateDoctorNonDuplicates";
  const DEFAULT_ACTION_PREF = "extensions.duplicateDoctor.duplicate.default.action";
  const BULK_MASTER_ITEM_PREF = "extensions.duplicateDoctor.bulk.master.item";
  const DUPLICATE_STATS_PREF = "extensions.duplicateDoctor.duplicate.stats.enable";
  const AUTO_DISCARD_PREF = "extensions.duplicateDoctor.autoDiscardNewDuplicates";
  const AUTO_DISCARD_BY_DOI_PREF = "extensions.duplicateDoctor.autoDiscardByDOI";
  const AUTO_DISCARD_BY_ISBN_PREF = "extensions.duplicateDoctor.autoDiscardByISBN";
  const TRASH_CHILDREN_PREF = "extensions.duplicateDoctor.trashChildrenWithDuplicate";
  const SHOW_NOTIFICATIONS_PREF = "extensions.duplicateDoctor.showNotifications";
  const SAFE_MERGE_WEBPAGE_PREF = "extensions.duplicateDoctor.safeMergeWebpageIntoArticle";
  const MASTER_ITEM_PREF = "extensions.duplicateDoctor.masterItem";
  const DUPLICATE_GROUP_CACHE_TTL_MS = 30000;

  const state = {
    addon: null,
    lastReport: null,
    autoDiscardObserverID: null,
    autoDiscardQueue: new Set(),
    autoDiscardTimer: null,
    bulkMergeRunning: false,
    windowIntervals: new WeakMap(),
    itemPanePatches: new WeakMap(),
    duplicateGroupCache: new Map(),
  };

  const strings = {
    en: {
      menuRoot: "Duplicate Doctor",
      scan: "Scan duplicate risks",
      safeMerge: "Safe merge same-DOI webpages",
      bulkMerge: "Bulk merge all duplicate items",
      markNonDuplicate: "Mark selected items as non-duplicate",
      unmarkNonDuplicate: "Mark selected items as duplicate",
      refresh: "Refresh Zotero duplicate search",
      title: "Duplicate Doctor",
      noCandidates: "No safe same-DOI webpage duplicates were found.",
      scanDone: "Scan complete",
      duplicateDropped: "Duplicate not imported",
      mergeConfirmTitle: "Safe merge same-DOI webpages",
      mergeDone: "Merge complete",
      mergeFailed: "Duplicate Doctor failed. See Zotero's error log for details.",
      mergeDisabled: "Safe webpage merge is disabled in Zotero Settings -> Duplicate Doctor.",
      bulkMergeConfirmTitle: "Bulk merge all duplicate items",
      bulkMergeConfirm: "This will merge all duplicate sets in the selected library. Continue?",
      nonDuplicateDone: "Non-duplicate records updated.",
      exportEmpty: "No non-duplicate records to export.",
      exportDone: "Non-duplicate records exported.",
      importDone: "Non-duplicate records imported.",
    },
    zh: {
      menuRoot: "Duplicate Doctor",
      scan: "扫描重复项风险",
      safeMerge: "安全合并同 DOI 网页项",
      bulkMerge: "批量合并所有重复条目",
      markNonDuplicate: "标记所选条目为非重复条目",
      unmarkNonDuplicate: "标记所选条目为重复条目",
      refresh: "刷新 Zotero 重复搜索",
      title: "Duplicate Doctor",
      noCandidates: "没有找到可安全自动合并的同 DOI 网页重复项。",
      scanDone: "扫描完成",
      duplicateDropped: "重复，未导入",
      mergeConfirmTitle: "安全合并同 DOI 网页项",
      mergeDone: "合并完成",
      mergeFailed: "Duplicate Doctor 处理失败。详情见 Zotero 错误日志。",
      mergeDisabled: "安全合并网页项已在 Zotero 设置 -> Duplicate Doctor 中关闭。",
      bulkMergeConfirmTitle: "批量合并所有重复条目",
      bulkMergeConfirm: "这将合并当前文库中的所有重复条目。是否继续？",
      nonDuplicateDone: "非重复记录已更新。",
      exportEmpty: "没有可导出的非重复记录。",
      exportDone: "非重复记录已导出。",
      importDone: "非重复记录已导入。",
    },
  };

  function t(key) {
    const locale = String(Zotero.locale || "").toLowerCase().startsWith("zh") ? "zh" : "en";
    return strings[locale][key] || strings.en[key] || key;
  }

  DuplicateDoctor.startup = async function (addon) {
    state.addon = addon;
    Zotero.DuplicateDoctor = DuplicateDoctor;
    await initNonDuplicateDB();
    registerAutoDiscardObserver();
    for (const win of Zotero.getMainWindows()) {
      await DuplicateDoctor.onMainWindowLoad(win);
    }
    Zotero.debug("Duplicate Doctor: started");
  };

  DuplicateDoctor.shutdown = async function () {
    unregisterAutoDiscardObserver();
    for (const win of Zotero.getMainWindows()) {
      await DuplicateDoctor.onMainWindowUnload(win);
    }
    if (Zotero.DuplicateDoctor === DuplicateDoctor) {
      delete Zotero.DuplicateDoctor;
    }
    state.addon = null;
    state.lastReport = null;
    state.duplicateGroupCache.clear();
    Zotero.debug("Duplicate Doctor: stopped");
  };

  DuplicateDoctor.onMainWindowLoad = async function (win) {
    registerMenu(win);
    patchItemPaneHooks(win);
    ensureDuplicatePaneUI(win).catch((error) => Zotero.logError(error));
    const interval = win.setInterval(() => {
      ensureDuplicatePaneUI(win).catch((error) => Zotero.logError(error));
      updateDuplicateStats(win).catch((error) => Zotero.logError(error));
    }, 5000);
    state.windowIntervals.set(win, interval);
  };

  DuplicateDoctor.onMainWindowUnload = async function (win) {
    const interval = state.windowIntervals.get(win);
    if (interval) {
      win.clearInterval(interval);
      state.windowIntervals.delete(win);
    }
    unregisterMenu(win);
    unpatchItemPaneHooks(win);
    unregisterDuplicatePaneUI(win);
  };

  DuplicateDoctor.exportNonDuplicates = exportNonDuplicates;
  DuplicateDoctor.importNonDuplicates = importNonDuplicates;

  DuplicateDoctor._test = {
    normalizeDOI,
    normalizeTitle,
    cleanISBNString,
    summarizeReport,
  };

  function registerMenu(win) {
    const doc = win.document;
    const toolsPopup = doc.getElementById("menu_ToolsPopup");
    if (!toolsPopup || doc.getElementById(ROOT_MENU_ID)) {
      return;
    }

    const separator = createMenuElement(doc, "menuseparator");
    separator.id = SEPARATOR_ID;
    toolsPopup.appendChild(separator);

    const root = createMenuElement(doc, "menu");
    root.id = ROOT_MENU_ID;
    root.setAttribute("label", t("menuRoot"));

    const popup = createMenuElement(doc, "menupopup");
    popup.id = ROOT_POPUP_ID;
    popup.appendChild(createMenuItem(doc, SCAN_MENU_ID, t("scan"), () => runScan(win)));
    popup.appendChild(createMenuItem(doc, BULK_MERGE_MENU_ID, t("bulkMerge"), () => runBulkMerge(win)));
    popup.appendChild(createMenuItem(doc, SAFE_MERGE_MENU_ID, t("safeMerge"), () => runSafeMerge(win)));
    popup.appendChild(createMenuItem(doc, MARK_NON_DUPLICATE_MENU_ID, t("markNonDuplicate"), () => markSelectedNonDuplicates(win)));
    popup.appendChild(createMenuItem(doc, UNMARK_NON_DUPLICATE_MENU_ID, t("unmarkNonDuplicate"), () => unmarkSelectedNonDuplicates(win)));
    popup.appendChild(createMenuItem(doc, REFRESH_MENU_ID, t("refresh"), () => refreshZoteroDuplicates(win)));
    root.appendChild(popup);

    toolsPopup.appendChild(root);
  }

  function unregisterMenu(win) {
    const doc = win.document;
    for (const id of [ROOT_MENU_ID, ROOT_POPUP_ID, SEPARATOR_ID, SCAN_MENU_ID, SAFE_MERGE_MENU_ID, BULK_MERGE_MENU_ID, MARK_NON_DUPLICATE_MENU_ID, UNMARK_NON_DUPLICATE_MENU_ID, REFRESH_MENU_ID]) {
      doc.getElementById(id)?.remove();
    }
  }

  function createMenuElement(doc, tagName) {
    if (doc.createXULElement) {
      return doc.createXULElement(tagName);
    }
    return doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", tagName);
  }

  function createMenuItem(doc, id, label, handler) {
    const item = createMenuElement(doc, "menuitem");
    item.id = id;
    item.setAttribute("label", label);
    item.addEventListener("command", handler);
    return item;
  }

  function getPref(key, fallback) {
    try {
      const value = Zotero.Prefs.get(key, true);
      return value === undefined ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function isAutoDiscardEnabled() {
    return Boolean(getPref(AUTO_DISCARD_PREF, true));
  }

  function isAutoDiscardByDOIEnabled() {
    return Boolean(getPref(AUTO_DISCARD_BY_DOI_PREF, true));
  }

  function isAutoDiscardByISBNEnabled() {
    return Boolean(getPref(AUTO_DISCARD_BY_ISBN_PREF, true));
  }

  function shouldTrashDuplicateChildren() {
    return Boolean(getPref(TRASH_CHILDREN_PREF, true));
  }

  function isSafeWebpageMergeEnabled() {
    return Boolean(getPref(SAFE_MERGE_WEBPAGE_PREF, true));
  }

  async function initNonDuplicateDB() {
    await Zotero.DB.queryAsync(
      `CREATE TABLE IF NOT EXISTS ${NON_DUPLICATE_TABLE} (
        itemID INTEGER NOT NULL,
        itemID2 INTEGER NOT NULL,
        libraryID INTEGER NOT NULL,
        itemKey TEXT,
        itemKey2 TEXT,
        PRIMARY KEY (itemID, itemID2)
      )`
    );
    await Zotero.DB.queryAsync(`CREATE INDEX IF NOT EXISTS idx_${NON_DUPLICATE_TABLE}_library ON ${NON_DUPLICATE_TABLE} (libraryID)`);
  }

  function normalizePair(itemID, itemID2) {
    return itemID < itemID2 ? [itemID, itemID2] : [itemID2, itemID];
  }

  async function insertNonDuplicatePair(itemID, itemID2, libraryID) {
    if (itemID === itemID2) {
      return;
    }
    const [a, b] = normalizePair(itemID, itemID2);
    const itemA = await Zotero.Items.getAsync(a);
    const itemB = await Zotero.Items.getAsync(b);
    await Zotero.DB.queryAsync(
      `INSERT OR IGNORE INTO ${NON_DUPLICATE_TABLE} (itemID, itemID2, libraryID, itemKey, itemKey2)
       VALUES (?, ?, ?, ?, ?)`,
      [a, b, libraryID, itemA?.key || null, itemB?.key || null]
    );
    invalidateDuplicateCaches(libraryID);
  }

  async function deleteNonDuplicatePair(itemID, itemID2) {
    const [a, b] = normalizePair(itemID, itemID2);
    await Zotero.DB.queryAsync(`DELETE FROM ${NON_DUPLICATE_TABLE} WHERE itemID=? AND itemID2=?`, [a, b]);
    state.duplicateGroupCache.clear();
  }

  async function isNonDuplicatePair(itemID, itemID2) {
    const [a, b] = normalizePair(itemID, itemID2);
    const value = await Zotero.DB.valueQueryAsync(
      `SELECT 1 FROM ${NON_DUPLICATE_TABLE} WHERE itemID=? AND itemID2=?`,
      [a, b]
    );
    return Boolean(value);
  }

  async function insertNonDuplicateSet(items) {
    if (items.length < 2) {
      return;
    }
    const libraryID = items[0].libraryID;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        await insertNonDuplicatePair(items[i].id, items[j].id, libraryID);
      }
    }
  }

  async function deleteNonDuplicateSet(items) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        await deleteNonDuplicatePair(items[i].id, items[j].id);
      }
    }
  }

  async function hasAnyNonDuplicatePair(items) {
    const ids = unique(items.map((item) => item.id).filter(Boolean));
    if (ids.length < 2) {
      return false;
    }
    const placeholders = ids.map(() => "?").join(",");
    const value = await Zotero.DB.valueQueryAsync(
      `SELECT 1 FROM ${NON_DUPLICATE_TABLE}
       WHERE itemID IN (${placeholders}) AND itemID2 IN (${placeholders})
       LIMIT 1`,
      [...ids, ...ids]
    );
    return Boolean(value);
  }

  async function loadNonDuplicatePairSet(itemIDs) {
    const ids = unique((itemIDs || []).map(Number).filter(Boolean));
    if (ids.length < 2) {
      return new Set();
    }
    const placeholders = ids.map(() => "?").join(",");
    const rows = await Zotero.DB.queryAsync(
      `SELECT itemID, itemID2 FROM ${NON_DUPLICATE_TABLE}
       WHERE itemID IN (${placeholders}) AND itemID2 IN (${placeholders})`,
      [...ids, ...ids]
    );
    return new Set((rows || []).map((row) => makePairKey(row.itemID, row.itemID2)));
  }

  function hasAnyNonDuplicatePairInSet(items, pairSet) {
    if (!pairSet || !pairSet.size) {
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (pairSet.has(makePairKey(items[i].id, items[j].id))) {
          return true;
        }
      }
    }
    return false;
  }

  function makePairKey(itemID, itemID2) {
    return normalizePair(Number(itemID), Number(itemID2)).join("-");
  }

  function getSelectedRegularItems(win) {
    try {
      return (win.ZoteroPane.getSelectedItems() || []).filter((item) => item && !item.deleted && item.isRegularItem?.());
    } catch (error) {
      return [];
    }
  }

  async function markSelectedNonDuplicates(win) {
    const items = getSelectedRegularItems(win);
    if (items.length < 2) {
      Zotero.alert(win, t("title"), "Select at least two regular items.");
      return;
    }
    const libraryIDs = unique(items.map((item) => item.libraryID));
    if (libraryIDs.length !== 1) {
      Zotero.alert(win, t("title"), "Items from different libraries cannot be marked together.");
      return;
    }
    await insertNonDuplicateSet(items);
    await refreshZoteroDuplicates(win, { silent: true });
    notify(t("title"), t("nonDuplicateDone"));
  }

  async function unmarkSelectedNonDuplicates(win) {
    const items = getSelectedRegularItems(win);
    if (items.length < 2) {
      Zotero.alert(win, t("title"), "Select at least two regular items.");
      return;
    }
    await deleteNonDuplicateSet(items);
    await refreshZoteroDuplicates(win, { silent: true });
    notify(t("title"), t("nonDuplicateDone"));
  }

  function patchItemPaneHooks(win) {
    const itemPane = win.ZoteroPane?.itemPane;
    if (!itemPane || state.itemPanePatches.has(win)) {
      return;
    }
    const patch = {
      itemPane,
      setItemPaneMessage: itemPane.setItemPaneMessage,
      updateItemPaneButtons: itemPane.updateItemPaneButtons,
    };
    if (typeof patch.setItemPaneMessage === "function") {
      itemPane.setItemPaneMessage = function (...args) {
        const result = patch.setItemPaneMessage.apply(this, args);
        scheduleDuplicatePaneUIRefresh(win);
        return result;
      };
    }
    if (typeof patch.updateItemPaneButtons === "function") {
      itemPane.updateItemPaneButtons = function (...args) {
        const result = patch.updateItemPaneButtons.apply(this, args);
        scheduleDuplicatePaneUIRefresh(win);
        return result;
      };
    }
    state.itemPanePatches.set(win, patch);
  }

  function unpatchItemPaneHooks(win) {
    const patch = state.itemPanePatches.get(win);
    if (!patch) {
      return;
    }
    if (patch.itemPane.setItemPaneMessage !== patch.setItemPaneMessage) {
      patch.itemPane.setItemPaneMessage = patch.setItemPaneMessage;
    }
    if (patch.itemPane.updateItemPaneButtons !== patch.updateItemPaneButtons) {
      patch.itemPane.updateItemPaneButtons = patch.updateItemPaneButtons;
    }
    state.itemPanePatches.delete(win);
  }

  function scheduleDuplicatePaneUIRefresh(win) {
    win.setTimeout(() => {
      ensureDuplicatePaneUI(win).catch((error) => Zotero.logError(error));
    }, 0);
  }

  async function ensureDuplicatePaneUI(win) {
    const doc = win.document;
    if (!isInDuplicatesPane(win)) {
      unregisterDuplicatePaneUI(win);
      return;
    }

    const mergeButton = doc.getElementById("zotero-duplicates-merge-button");
    if (mergeButton?.parentElement && !doc.getElementById(PANE_CONTROLS_INNER_ID)) {
      const groupBox = mergeButton.parentElement;
      groupBox.parentElement?.insertBefore(createDuplicatePaneControls(doc, win, "inner"), groupBox);
    }

    const messagePane = doc.getElementById("zotero-item-message") || doc.querySelector("item-message-pane");
    if (messagePane?.renderCustomHead && !doc.getElementById(PANE_CONTROLS_EXTERNAL_ID)) {
      messagePane.renderCustomHead(({ doc: paneDoc, append }) => {
        append(createDuplicatePaneControls(paneDoc, win, "external"));
      });
    }

    const customHead = doc.querySelector("item-message-pane .custom-head, item-pane-header .custom-head, note-editor .custom-head");
    if (customHead && !doc.getElementById(PANE_CONTROLS_EXTERNAL_ID)) {
      customHead.parentElement?.insertBefore(createDuplicatePaneControls(doc, win, "external"), customHead);
    }

    await updateDuplicatePaneButtonState(win);
  }

  function createDuplicatePaneControls(doc, win, placement) {
    const isInner = placement === "inner";
    const box = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    box.id = isInner ? PANE_CONTROLS_INNER_ID : PANE_CONTROLS_EXTERNAL_ID;
    box.className = "duplicate-doctor-pane-controls duplicate-custom-head";
    box.setAttribute(
      "style",
      "display: flex; flex-direction: column; align-self: stretch; gap: 6px; padding: 6px 8px; background: var(--material-toolbar); border-bottom: var(--material-panedivider); box-sizing: border-box; width: 100%;"
    );

    const bulkButton = createPaneButton(doc, "merge");
    bulkButton.id = isInner ? BULK_MERGE_INNER_BUTTON_ID : BULK_MERGE_EXTERNAL_BUTTON_ID;
    bulkButton.setAttribute("label", t("bulkMerge"));
    bulkButton.addEventListener("click", () => runBulkMerge(win));

    const nonDuplicateButton = createPaneButton(doc, "non-duplicate");
    nonDuplicateButton.id = isInner ? NON_DUPLICATE_INNER_BUTTON_ID : NON_DUPLICATE_EXTERNAL_BUTTON_ID;
    nonDuplicateButton.setAttribute("label", t("markNonDuplicate"));
    nonDuplicateButton.addEventListener("click", () => markSelectedNonDuplicates(win));

    box.appendChild(bulkButton);
    box.appendChild(nonDuplicateButton);
    return box;
  }

  function createPaneButton(doc, imageName) {
    const button = createMenuElement(doc, "button");
    button.className = "duplicate-doctor-pane-button";
    button.setAttribute("image", `chrome://duplicate_doctor/content/icons/${imageName}.svg`);
    button.setAttribute("crop", "end");
    button.setAttribute(
      "style",
      "height: 28px; margin: 0; width: 100%; min-width: 0; cursor: pointer; -moz-box-pack: center;"
    );
    return button;
  }

  function unregisterDuplicatePaneUI(win) {
    win.document.getElementById(PANE_CONTROLS_INNER_ID)?.remove();
    win.document.getElementById(PANE_CONTROLS_EXTERNAL_ID)?.remove();
  }

  async function updateDuplicatePaneButtonState(win) {
    const inDuplicates = isInDuplicatesPane(win);
    const bulkButtons = [
      win.document.getElementById(BULK_MERGE_INNER_BUTTON_ID),
      win.document.getElementById(BULK_MERGE_EXTERNAL_BUTTON_ID),
    ].filter(Boolean);
    const nonDuplicateButtons = [
      win.document.getElementById(NON_DUPLICATE_INNER_BUTTON_ID),
      win.document.getElementById(NON_DUPLICATE_EXTERNAL_BUTTON_ID),
    ].filter(Boolean);
    for (const bulkButton of bulkButtons) {
      bulkButton.hidden = !inDuplicates;
      bulkButton.disabled = state.bulkMergeRunning;
    }
    const selected = getSelectedRegularItems(win);
    for (const nonDuplicateButton of nonDuplicateButtons) {
      nonDuplicateButton.hidden = !inDuplicates || selected.length < 2;
    }
  }

  function isInDuplicatesPane(win) {
    try {
      const zoteroPane = win.ZoteroPane;
      const activeRow = zoteroPane.getCollectionTreeRow?.();
      const itemPaneRow = zoteroPane.itemPane?.collectionTreeRow;
      const title = String(win.document?.title || "");
      return Boolean(activeRow?.isDuplicates?.() || itemPaneRow?.isDuplicates?.() || /重复条目|Duplicate Items/i.test(title));
    } catch (error) {
      return false;
    }
  }

  async function updateDuplicateStats(win) {
    if (!Boolean(getPref(DUPLICATE_STATS_PREF, true))) {
      return;
    }
    try {
      const pane = win.ZoteroPane;
      const row = pane.getCollectionTreeRow?.();
      if (!row?.isDuplicates?.()) {
        return;
      }
      const label = win.document.querySelector(".virtualized-table .row.selected span.cell-text, #collections-tree .row.selected span.cell-text");
      if (!label || label.textContent.includes("/")) {
        return;
      }
      const libraryID = pane?.getSelectedLibraryID?.() || Zotero.Libraries.userLibraryID;
      const { total, unique: uniqueCount } = await countDuplicateItems(libraryID);
      label.textContent = `${label.textContent} ${uniqueCount}/${total}`;
    } catch (error) {}
  }

  async function countDuplicateItems(libraryID) {
    const groups = await getDuplicateGroups(libraryID);
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    return { total, unique: groups.length };
  }

  async function getDuplicateGroups(libraryID, options = {}) {
    const cacheKey = String(libraryID);
    const cached = state.duplicateGroupCache.get(cacheKey);
    if (!options.force && cached && Date.now() - cached.timestamp < DUPLICATE_GROUP_CACHE_TTL_MS) {
      return cached.groups;
    }
    const duplicates = new Zotero.Duplicates(libraryID);
    const search = await duplicates.getSearchObject();
    const ids = await search.search();
    const groupIDs = new Map();
    for (const id of ids || []) {
      const setItems = unique([...(duplicates.getSetItemsByItemID(id) || []), id]).map(Number).filter(Boolean);
      if (setItems.length < 2) {
        continue;
      }
      const key = setItems.slice().sort((a, b) => a - b).join("-");
      if (!groupIDs.has(key)) {
        groupIDs.set(key, setItems);
      }
    }
    const allItemIDs = unique([...groupIDs.values()].flat());
    const itemMap = new Map((await loadItems(allItemIDs)).map((item) => [item.id, item]));
    const nonDuplicatePairs = await loadNonDuplicatePairSet(allItemIDs);
    const groups = [];
    for (const [key, setItems] of groupIDs.entries()) {
      const items = setItems.map((id) => itemMap.get(id)).filter(isActiveRegularItem);
      if (items.length >= 2 && !hasAnyNonDuplicatePairInSet(items, nonDuplicatePairs)) {
        groups.push({ key, items });
      }
    }
    state.duplicateGroupCache.set(cacheKey, { timestamp: Date.now(), groups });
    return groups;
  }

  async function runBulkMerge(win) {
    if (state.bulkMergeRunning) {
      return;
    }
    const libraryID = win.ZoteroPane?.getSelectedLibraryID?.() || Zotero.Libraries.userLibraryID;
    const confirmed = Zotero.Prompt.confirm({
      window: win,
      title: t("bulkMergeConfirmTitle"),
      text: t("bulkMergeConfirm"),
      button0: Zotero.Prompt.BUTTON_TITLE_YES,
      button1: Zotero.Prompt.BUTTON_TITLE_CANCEL,
    });
    if (confirmed !== 0) {
      return;
    }
    state.bulkMergeRunning = true;
    const progress = makeProgress(t("bulkMerge"), "Preparing...");
    const result = { mergedGroups: 0, skippedGroups: 0, failedGroups: 0, errors: [] };
    try {
      const groups = await getDuplicateGroups(libraryID, { force: true });
      let lastProgressUpdate = 0;
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const now = Date.now();
        if (i === 0 || i === groups.length - 1 || now - lastProgressUpdate > 250) {
          progress.set(`${i + 1}/${groups.length}: ${truncate(group.items[0].getDisplayTitle(), 80)}`, Math.floor((i + 1) / Math.max(groups.length, 1) * 100));
          lastProgressUpdate = now;
        }
        try {
          const merged = await mergeDuplicateItemSet(group.items);
          if (merged) {
            result.mergedGroups++;
          } else {
            result.skippedGroups++;
          }
        } catch (error) {
          result.failedGroups++;
          result.errors.push(`${truncate(group.items[0].getDisplayTitle(), 80)}: ${formatError(error)}`);
          Zotero.debug("Duplicate Doctor skipped duplicate group after merge error: " + formatError(error));
          Zotero.logError(error);
        }
      }
      progress.done(`${t("mergeDone")}: ${result.mergedGroups} merged, ${result.skippedGroups} skipped, ${result.failedGroups} failed.`);
      invalidateDuplicateCaches(libraryID);
      await refreshZoteroDuplicates(win, { silent: true });
      const errorDetails = result.errors.length
        ? `\n\nFailed groups:\n${result.errors.slice(0, 8).join("\n")}${result.errors.length > 8 ? `\n... ${result.errors.length - 8} more` : ""}`
        : "";
      Zotero.alert(win, t("title"), `${t("mergeDone")}\nMerged groups: ${result.mergedGroups}\nSkipped groups: ${result.skippedGroups}\nFailed groups: ${result.failedGroups}${errorDetails}`);
    } catch (error) {
      Zotero.debug("Duplicate Doctor bulk merge fatal error: " + formatError(error));
      Zotero.logError(error);
      Zotero.alert(win, t("title"), `${t("mergeFailed")}\n\n${formatError(error)}`);
    } finally {
      state.bulkMergeRunning = false;
      await updateDuplicatePaneButtonState(win);
    }
  }

  async function mergeDuplicateItemSet(items) {
    items = items.filter(isActiveRegularItem);
    if (items.length < 2) {
      return false;
    }
    const journalArticles = items.filter((item) => Zotero.ItemTypes.getName(item.itemTypeID) === "journalArticle");
    const webpages = items.filter((item) => Zotero.ItemTypes.getName(item.itemTypeID) === "webpage");
    if (journalArticles.length && webpages.length && isSafeWebpageMergeEnabled()) {
      const masterArticle = await chooseMasterArticle(journalArticles);
      const sameTypeArticles = journalArticles.filter((item) => item.id !== masterArticle.id);
      if (sameTypeArticles.length) {
        await mergeSameTypeItems(masterArticle, sameTypeArticles);
      }
      const masterDOI = normalizeDOI(masterArticle.getField("DOI"));
      let mergedAnyWebpage = false;
      for (const webpage of webpages) {
        if (masterDOI && normalizeDOI(webpage.getField("DOI")) === masterDOI) {
          await mergeWebpageIntoArticle(masterArticle, webpage);
          mergedAnyWebpage = true;
        }
      }
      return mergedAnyWebpage || sameTypeArticles.length > 0;
    }
    const master = await chooseMasterItem(items);
    const sameTypeOthers = items.filter((item) => item.id !== master.id && item.itemTypeID === master.itemTypeID);
    const otherTypeItems = items.filter((item) => item.id !== master.id && item.itemTypeID !== master.itemTypeID);
    if (sameTypeOthers.length) {
      await mergeSameTypeItems(master, sameTypeOthers);
    }
    if (otherTypeItems.length && isSafeWebpageMergeEnabled()) {
      const masterType = Zotero.ItemTypes.getName(master.itemTypeID);
      if (masterType === "journalArticle") {
        let mergedWebpage = false;
        for (const item of otherTypeItems) {
          const type = Zotero.ItemTypes.getName(item.itemTypeID);
          if (type === "webpage" && normalizeDOI(item.getField("DOI")) && normalizeDOI(item.getField("DOI")) === normalizeDOI(master.getField("DOI"))) {
            await mergeWebpageIntoArticle(master, item);
            mergedWebpage = true;
          }
        }
        return sameTypeOthers.length > 0 || mergedWebpage;
      }
    }
    return sameTypeOthers.length > 0;
  }

  async function mergeSameTypeItems(master, otherItems) {
    if (!otherItems.length) {
      return;
    }
    otherItems = otherItems.filter((item) => item && item.itemTypeID === master.itemTypeID && item.libraryID === master.libraryID);
    if (!otherItems.length) {
      return;
    }
    const masterJSON = master.toJSON();
    const candidateJSON = otherItems.reduce((acc, item) => Object.assign(acc, item.toJSON()), {});
    const { relations, collections, tags, ...keep } = candidateJSON;
    master.fromJSON({ ...keep, ...masterJSON });
    const { mergeItems } = ChromeUtils.importESModule("chrome://zotero/content/mergeItems.mjs");
    await mergeItems(master, otherItems);
  }

  function formatError(error) {
    if (!error) {
      return "Unknown error";
    }
    return String(error.stack || error.message || error);
  }

  async function chooseMasterItem(items) {
    const strategy = String(getPref(BULK_MASTER_ITEM_PREF, getPref(MASTER_ITEM_PREF, "oldest")) || "oldest");
    if (strategy === "oldest") {
      return items.slice().sort((a, b) => compareDate(a.dateAdded, b.dateAdded) || a.id - b.id)[0];
    }
    if (strategy === "newest") {
      return items.slice().sort((a, b) => compareDate(b.dateAdded, a.dateAdded) || a.id - b.id)[0];
    }
    if (strategy === "modified") {
      return items.slice().sort((a, b) => compareDate(b.dateModified, a.dateModified) || a.id - b.id)[0];
    }
    const scored = [];
    for (const item of items) {
      scored.push({ item, score: await scoreItem(item) });
    }
    scored.sort((a, b) => b.score - a.score || compareDate(a.item.dateAdded, b.item.dateAdded));
    return scored[0].item;
  }

  async function exportNonDuplicates(win) {
    const rows = await Zotero.DB.queryAsync(`SELECT libraryID, itemKey, itemKey2 FROM ${NON_DUPLICATE_TABLE} WHERE itemKey IS NOT NULL AND itemKey2 IS NOT NULL`);
    if (!rows.length) {
      Zotero.alert(win, t("title"), t("exportEmpty"));
      return;
    }
    const libraries = [];
    const byLibrary = new Map();
    for (const row of rows) {
      if (!byLibrary.has(row.libraryID)) {
        byLibrary.set(row.libraryID, []);
      }
      byLibrary.get(row.libraryID).push({ key1: row.itemKey, key2: row.itemKey2 });
    }
    for (const [libraryID, pairs] of byLibrary) {
      const lib = Zotero.Libraries.get(libraryID);
      if (!lib || lib.libraryType === "feed") {
        continue;
      }
      let groupID = null;
      if (lib.libraryType === "group") {
        try {
          groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
        } catch (error) {}
      }
      libraries.push({ libraryType: lib.libraryType, groupID, libraryName: lib.name, pairs });
    }
    const data = { format: "duplicate-doctor-nonduplicates", compatibleFormats: ["zoplicate-nonduplicates"], version: 1, exportedAt: new Date().toISOString(), libraries };
    const { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
    const fp = new FilePicker();
    fp.init(win, "Export non-duplicate records", fp.modeSave);
    fp.defaultString = "duplicate-doctor-nonduplicates.json";
    fp.appendFilter("JSON", "*.json");
    const result = await fp.show();
    if (result !== fp.returnOK && result !== fp.returnReplace) {
      return;
    }
    await Zotero.File.putContentsAsync(fp.file, JSON.stringify(data, null, 2));
    Zotero.alert(win, t("title"), t("exportDone"));
  }

  async function importNonDuplicates(win) {
    const { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
    const fp = new FilePicker();
    fp.init(win, "Import non-duplicate records", fp.modeOpen);
    fp.appendFilter("JSON", "*.json");
    const result = await fp.show();
    if (result !== fp.returnOK) {
      return;
    }
    let data;
    try {
      data = JSON.parse(await Zotero.File.getContentsAsync(fp.file));
    } catch (error) {
      Zotero.alert(win, t("title"), "Invalid JSON file.");
      return;
    }
    if (!data || !Array.isArray(data.libraries) || !["duplicate-doctor-nonduplicates", "zoplicate-nonduplicates"].includes(data.format)) {
      Zotero.alert(win, t("title"), "No compatible non-duplicate records found.");
      return;
    }
    let imported = 0;
    let skipped = 0;
    for (const entry of data.libraries) {
      const libraryID = resolvePortableLibraryID(entry);
      if (!libraryID) {
        skipped += entry.pairs?.length || 0;
        continue;
      }
      for (const pair of entry.pairs || []) {
        const item1 = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, pair.key1);
        const item2 = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, pair.key2);
        if (!item1 || !item2) {
          skipped++;
          continue;
        }
        await insertNonDuplicatePair(item1.id, item2.id, libraryID);
        imported++;
      }
    }
    await refreshZoteroDuplicates(win, { silent: true });
    Zotero.alert(win, t("title"), `${t("importDone")}\nImported: ${imported}\nSkipped: ${skipped}`);
  }

  function resolvePortableLibraryID(entry) {
    if (entry.libraryType === "user") {
      return Zotero.Libraries.userLibraryID;
    }
    if (entry.libraryType === "group" && entry.groupID != null) {
      for (const lib of Zotero.Libraries.getAll()) {
        if (lib.libraryType === "group" && Zotero.Groups.getGroupIDFromLibraryID(lib.libraryID) === entry.groupID) {
          return lib.libraryID;
        }
      }
    }
    return null;
  }

  function registerAutoDiscardObserver() {
    if (state.autoDiscardObserverID || !Zotero.Notifier?.registerObserver) {
      return;
    }
    state.autoDiscardObserverID = Zotero.Notifier.registerObserver(
      {
        notify(event, type, ids) {
          if (event !== "add" || type !== "item") {
            return;
          }
          scheduleAutoDiscard(ids);
        },
      },
      ["item"],
      "DuplicateDoctor",
      100
    );
  }

  function unregisterAutoDiscardObserver() {
    if (state.autoDiscardObserverID && Zotero.Notifier?.unregisterObserver) {
      Zotero.Notifier.unregisterObserver(state.autoDiscardObserverID);
      state.autoDiscardObserverID = null;
    }
    if (state.autoDiscardTimer) {
      clearTimeout(state.autoDiscardTimer);
      state.autoDiscardTimer = null;
    }
    state.autoDiscardQueue.clear();
  }

  function scheduleAutoDiscard(ids) {
    for (const id of ids || []) {
      state.autoDiscardQueue.add(id);
    }
    if (state.autoDiscardTimer) {
      clearTimeout(state.autoDiscardTimer);
    }
    state.autoDiscardTimer = setTimeout(() => {
      state.autoDiscardTimer = null;
      processAutoDiscardQueue().catch((error) => {
        Zotero.debug("Duplicate Doctor auto-discard error: " + error);
        Zotero.logError(error);
      });
    }, 1500);
  }

  async function processAutoDiscardQueue() {
    if (state.autoDiscardQueue.size === 0) {
      return;
    }
    const defaultAction = String(getPref(DEFAULT_ACTION_PREF, "ask") || "ask");
    if (!isAutoDiscardEnabled() && defaultAction === "cancel") {
      state.autoDiscardQueue.clear();
      return;
    }
    const itemIDs = [...state.autoDiscardQueue];
    state.autoDiscardQueue.clear();
    const newIDSet = new Set(itemIDs);
    const rows = await fetchRegularItemRows();
    const rowByID = new Map(rows.map((row) => [row.itemID, row]));
    const doiMap = buildIdentifierMap(rows, "doi");
    const isbnMap = buildIdentifierMap(rows, "isbn");
    const discarded = [];
    const skipped = [];

    for (const itemID of itemIDs) {
      const item = await Zotero.Items.getAsync(itemID);
      if (!item || !isActiveRegularItem(item)) {
        continue;
      }
      const row = rowByID.get(item.id);
      if (!row) {
        continue;
      }
      const match = chooseExistingDuplicate(row, newIDSet, doiMap, isbnMap);
      if (!match) {
        continue;
      }
      try {
        const action = isAutoDiscardEnabled() ? "discard" : defaultAction;
        if (action === "ask") {
          const choice = Zotero.Prompt.confirm({
            title: t("duplicateDropped"),
            text: `${item.getDisplayTitle()}\n\nDuplicate by ${match.reason.toUpperCase()} ${match.identifier}`,
            button0: Zotero.Prompt.BUTTON_TITLE_YES,
            button1: Zotero.Prompt.BUTTON_TITLE_NO,
            button2: Zotero.Prompt.BUTTON_TITLE_CANCEL,
          });
          if (choice === 0) {
            await trashNewDuplicateItem(item);
          } else if (choice === 1) {
            await trashExistingDuplicate(match.row.itemID);
          } else {
            continue;
          }
        } else if (action === "discard") {
          await trashNewDuplicateItem(item);
        } else if (action === "keep") {
          await trashExistingDuplicate(match.row.itemID);
        } else {
          continue;
        }
        discarded.push({ item, match });
      } catch (error) {
        Zotero.debug(`Duplicate Doctor failed to discard duplicate ${item.id}: ${error}`);
        Zotero.logError(error);
        skipped.push({ itemID: item.id, reason: String(error) });
      }
    }

    if (discarded.length) {
      const examples = discarded
        .slice(0, 5)
        .map(({ item, match }) => `${truncate(item.getDisplayTitle(), 70)} -> ${match.reason.toUpperCase()} ${match.identifier}`)
        .join("\n");
      notify(
        t("duplicateDropped"),
        `${discarded.length} duplicate item(s) moved to trash.\n${examples}`
      );
    }
    if (skipped.length) {
      Zotero.debug(`Duplicate Doctor auto-discard skipped ${skipped.length} item(s): ${JSON.stringify(skipped)}`);
    }
  }

  function buildIdentifierMap(rows, kind) {
    const map = new Map();
    for (const row of rows) {
      const identifiers = extractIdentifiersFromRow(row);
      for (const value of identifiers[kind]) {
        const key = `${row.libraryID}::${value}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(row);
      }
    }
    return map;
  }

  function chooseExistingDuplicate(row, newIDSet, doiMap, isbnMap) {
    const identifiers = extractIdentifiersFromRow(row);
    if (isAutoDiscardByDOIEnabled()) {
      for (const doi of identifiers.doi) {
        const match = chooseKeeper(row, newIDSet, doiMap.get(`${row.libraryID}::${doi}`) || []);
        if (match) {
          return { row: match, reason: "doi", identifier: doi };
        }
      }
    }
    if (isAutoDiscardByISBNEnabled()) {
      for (const isbn of identifiers.isbn) {
        const match = chooseKeeper(row, newIDSet, isbnMap.get(`${row.libraryID}::${isbn}`) || []);
        if (match) {
          return { row: match, reason: "isbn", identifier: isbn };
        }
      }
    }
    return null;
  }

  function chooseKeeper(row, newIDSet, candidates) {
    const others = candidates.filter((candidate) => candidate.itemID !== row.itemID);
    if (!others.length) {
      return null;
    }
    const oldItems = others.filter((candidate) => !newIDSet.has(candidate.itemID));
    const sameBatchEarlierItems = others.filter((candidate) => newIDSet.has(candidate.itemID) && candidate.itemID < row.itemID);
    const keepers = oldItems.length ? oldItems : sameBatchEarlierItems;
    if (!keepers.length) {
      return null;
    }
    return keepers.sort((a, b) => scoreRow(b) - scoreRow(a) || a.itemID - b.itemID)[0];
  }

  function scoreRow(row) {
    let score = 0;
    if (row.itemType === "journalArticle") {
      score += 100;
    } else if (row.itemType === "book") {
      score += 90;
    } else if (row.itemType === "bookSection") {
      score += 80;
    }
    if (normalizeDOI(row.doi)) {
      score += 20;
    }
    if (cleanISBNString(row.isbn).length) {
      score += 10;
    }
    score += Number(row.attachmentCount || 0) * 5;
    return score;
  }

  async function trashNewDuplicateItem(item) {
    if (shouldTrashDuplicateChildren()) {
      const childIDs = await Zotero.DB.columnQueryAsync(
        `SELECT itemID FROM itemAttachments WHERE parentItemID=?
          UNION
         SELECT itemID FROM itemNotes WHERE parentItemID=?`,
        [item.id, item.id]
      );
      for (const childID of childIDs) {
        const child = await Zotero.Items.getAsync(childID);
        if (child && !child.deleted) {
          child.deleted = true;
          await child.saveTx();
        }
      }
    }
    item.deleted = true;
    await item.saveTx();
  }

  async function trashExistingDuplicate(itemID) {
    const item = await Zotero.Items.getAsync(itemID);
    if (!item || item.deleted) {
      return;
    }
    item.deleted = true;
    await item.saveTx();
  }

  async function runScan(win) {
    try {
      const report = await buildDuplicateReport();
      state.lastReport = report;
      notify(t("scanDone"), summarizeReport(report));
      Zotero.alert(win, t("title"), summarizeReport(report));
    } catch (error) {
      Zotero.debug("Duplicate Doctor scan error: " + error);
      Zotero.logError(error);
      Zotero.alert(win, t("title"), t("mergeFailed"));
    }
  }

  async function runSafeMerge(win) {
    try {
      if (!isSafeWebpageMergeEnabled()) {
        Zotero.alert(win, t("title"), t("mergeDisabled"));
        return;
      }
      let report = state.lastReport || await buildDuplicateReport();
      const safeGroups = report.sameDOIWebpageArticleGroups;
      if (!safeGroups.length) {
        Zotero.alert(win, t("title"), t("noCandidates"));
        return;
      }

      const confirmed = Zotero.Prompt.confirm({
        window: win,
        title: t("mergeConfirmTitle"),
        text:
          `${summarizeReport(report)}\n\n` +
          "Only same-library groups with the same normalized DOI and at least one journalArticle plus one webpage will be changed. " +
          "Webpage records are moved to the Zotero trash after their collections, tags, child notes, child attachments, and relations are copied to the article item.\n\nContinue?",
        button0: Zotero.Prompt.BUTTON_TITLE_YES,
        button1: Zotero.Prompt.BUTTON_TITLE_CANCEL,
      });
      if (confirmed !== 0) {
        return;
      }

      const progress = makeProgress(t("mergeConfirmTitle"), "Preparing...");
      const result = await mergeSafeGroups(safeGroups, (done, total, label) => {
        progress.set(`${done}/${total}: ${truncate(label, 80)}`, Math.floor(done / Math.max(total, 1) * 100));
      });
      progress.done(`${t("mergeDone")}: ${result.mergedWebpages} webpage item(s), ${result.skipped.length} skipped.`);

      invalidateDuplicateCaches();
      await refreshZoteroDuplicates(win, { silent: true });
      report = await buildDuplicateReport();
      state.lastReport = report;

      Zotero.alert(
        win,
        t("title"),
        `${t("mergeDone")}\n\nMerged webpage records: ${result.mergedWebpages}\nProcessed groups: ${result.processedGroups}\nSkipped groups: ${result.skipped.length}\n\nAfter refresh:\n${summarizeReport(report)}`
      );
    } catch (error) {
      Zotero.debug("Duplicate Doctor merge error: " + error);
      Zotero.logError(error);
      Zotero.alert(win, t("title"), t("mergeFailed"));
    }
  }

  async function refreshZoteroDuplicates(win, options = {}) {
    const pane = win.ZoteroPane;
    const libraryID = pane?.getSelectedLibraryID?.() || Zotero.Libraries.userLibraryID;
    if (Zotero.Duplicates) {
      const duplicates = new Zotero.Duplicates(libraryID);
      const search = await duplicates.getSearchObject();
      await search.search();
    }
    if (pane?.itemsView?.refreshAndMaintainSelection) {
      await pane.itemsView.refreshAndMaintainSelection();
    } else if (pane?.itemsView?.refresh) {
      await pane.itemsView.refresh();
    }
    if (!options.silent) {
      notify(t("refresh"), "Done");
    }
  }

  async function buildDuplicateReport() {
    const rows = await fetchRegularItemRows();
    const byDOI = groupRows(rows, (row) => `${row.libraryID}::${normalizeDOI(row.doi)}`, (row) => Boolean(normalizeDOI(row.doi)));
    const byTitle = groupRows(rows, (row) => `${row.libraryID}::${normalizeTitle(row.title)}`, (row) => Boolean(normalizeTitle(row.title)));

    const sameDOIGroups = [];
    const sameDOIWebpageArticleGroups = [];
    const sameDOISameTypeGroups = [];
    const titleOnlyReviewGroups = [];

    for (const group of byDOI.values()) {
      if (group.rows.length < 2) {
        continue;
      }
      const classified = classifyDOIGroup(group);
      sameDOIGroups.push(classified);
      if (classified.safeAction === "merge_webpage_into_journal_article") {
        sameDOIWebpageArticleGroups.push(classified);
      } else if (classified.typeCounts[classified.rows[0].itemType] === classified.rows.length) {
        sameDOISameTypeGroups.push(classified);
      }
    }

    for (const group of byTitle.values()) {
      if (group.rows.length < 2) {
        continue;
      }
      const dois = unique(group.rows.map((row) => normalizeDOI(row.doi)).filter(Boolean));
      if (dois.length !== 1) {
        titleOnlyReviewGroups.push({
          libraryID: group.rows[0].libraryID,
          title: group.rows[0].title || "",
          doiValues: dois,
          rows: group.rows,
          reason: dois.length === 0 ? "same_title_without_doi" : "same_title_conflicting_doi",
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totalRegularItems: rows.length,
      sameDOIGroups,
      sameDOIWebpageArticleGroups,
      sameDOISameTypeGroups,
      titleOnlyReviewGroups,
    };
  }

  async function fetchRegularItemRows() {
    const doiFieldID = await getFieldID("DOI");
    const titleFieldID = await getFieldID("title");
    const isbnFieldID = await getFieldID("ISBN");
    const urlFieldID = await getFieldID("url");
    const extraFieldID = await getFieldID("extra");
    if (!doiFieldID || !titleFieldID) {
      throw new Error("Required Zotero fields are unavailable.");
    }
    return await Zotero.DB.queryAsync(
      `SELECT i.itemID, i.libraryID, i.key, i.dateAdded, i.dateModified,
              it.typeName AS itemType,
              doiValues.value AS doi,
              titleValues.value AS title,
              isbnValues.value AS isbn,
              urlValues.value AS url,
              extraValues.value AS extra,
              (SELECT COUNT(*) FROM itemAttachments ia WHERE ia.parentItemID = i.itemID) AS attachmentCount
         FROM items i
         JOIN itemTypesCombined it ON it.itemTypeID = i.itemTypeID
         LEFT JOIN itemData doiData ON doiData.itemID = i.itemID AND doiData.fieldID = ?
         LEFT JOIN itemDataValues doiValues ON doiValues.valueID = doiData.valueID
         LEFT JOIN itemData titleData ON titleData.itemID = i.itemID AND titleData.fieldID = ?
         LEFT JOIN itemDataValues titleValues ON titleValues.valueID = titleData.valueID
         LEFT JOIN itemData isbnData ON isbnData.itemID = i.itemID AND isbnData.fieldID = ?
         LEFT JOIN itemDataValues isbnValues ON isbnValues.valueID = isbnData.valueID
         LEFT JOIN itemData urlData ON urlData.itemID = i.itemID AND urlData.fieldID = ?
         LEFT JOIN itemDataValues urlValues ON urlValues.valueID = urlData.valueID
         LEFT JOIN itemData extraData ON extraData.itemID = i.itemID AND extraData.fieldID = ?
         LEFT JOIN itemDataValues extraValues ON extraValues.valueID = extraData.valueID
        WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
          AND i.itemID NOT IN (SELECT itemID FROM itemAttachments)
          AND i.itemID NOT IN (SELECT itemID FROM itemNotes)`,
      [doiFieldID, titleFieldID, isbnFieldID || -1, urlFieldID || -1, extraFieldID || -1]
    );
  }

  async function getFieldID(fieldName) {
    const rows = await Zotero.DB.queryAsync("SELECT fieldID FROM fieldsCombined WHERE fieldName=?", [fieldName]);
    return rows?.[0]?.fieldID;
  }

  function groupRows(rows, keyFn, includeFn) {
    const groups = new Map();
    for (const row of rows) {
      if (!includeFn(row)) {
        continue;
      }
      const key = keyFn(row);
      if (!groups.has(key)) {
        groups.set(key, { key, rows: [] });
      }
      groups.get(key).rows.push(row);
    }
    return groups;
  }

  function classifyDOIGroup(group) {
    const rows = group.rows;
    const typeCounts = {};
    for (const row of rows) {
      typeCounts[row.itemType] = (typeCounts[row.itemType] || 0) + 1;
    }
    const result = {
      libraryID: rows[0].libraryID,
      doi: normalizeDOI(rows[0].doi),
      rows,
      typeCounts,
      safeAction: "manual_review",
      reason: "unsupported_type_mix",
    };
    if (typeCounts.journalArticle && typeCounts.webpage) {
      result.safeAction = "merge_webpage_into_journal_article";
      result.reason = "same_doi_journal_article_plus_webpage";
    } else if (Object.keys(typeCounts).length === 1) {
      result.reason = "same_doi_same_item_type_use_zotero_or_zoplicate_merge";
    }
    return result;
  }

  async function mergeSafeGroups(groups, onProgress) {
    const result = {
      processedGroups: 0,
      mergedWebpages: 0,
      skipped: [],
    };
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      onProgress?.(i + 1, groups.length, group.rows[0]?.title || group.doi);
      try {
        const journalItems = (await loadItems(group.rows.filter((row) => row.itemType === "journalArticle").map((row) => row.itemID)))
          .filter((item) => isActiveType(item, "journalArticle"));
        const webpageItems = (await loadItems(group.rows.filter((row) => row.itemType === "webpage").map((row) => row.itemID)))
          .filter((item) => isActiveType(item, "webpage"));
        if (!journalItems.length || !webpageItems.length) {
          result.skipped.push({ doi: group.doi, reason: "active_item_missing" });
          continue;
        }
        const master = await chooseMasterArticle(journalItems);
        for (const webpage of webpageItems) {
          await mergeWebpageIntoArticle(master, webpage);
          result.mergedWebpages += 1;
        }
        result.processedGroups += 1;
      } catch (error) {
        Zotero.debug(`Duplicate Doctor skipped ${group.doi}: ${error}`);
        Zotero.logError(error);
        result.skipped.push({ doi: group.doi, reason: String(error) });
      }
    }
    return result;
  }

  async function loadItems(itemIDs) {
    const ids = unique((itemIDs || []).map(Number).filter(Boolean));
    if (!ids.length) {
      return [];
    }
    const loaded = await Zotero.Items.getAsync(ids);
    const items = Array.isArray(loaded) ? loaded : [loaded];
    return items.filter(Boolean);
  }

  function invalidateDuplicateCaches(libraryID) {
    if (libraryID) {
      state.duplicateGroupCache.delete(String(libraryID));
    } else {
      state.duplicateGroupCache.clear();
    }
  }

  function isActiveType(item, typeName) {
    if (!isActiveRegularItem(item)) {
      return false;
    }
    try {
      return Zotero.ItemTypes.getName(item.itemTypeID) === typeName;
    } catch (error) {
      return false;
    }
  }

  function isActiveRegularItem(item) {
    return Boolean(item && !item.deleted && item.isRegularItem && item.isRegularItem());
  }

  async function chooseMasterArticle(items) {
    const strategy = String(getPref(BULK_MASTER_ITEM_PREF, getPref(MASTER_ITEM_PREF, "oldest")) || "oldest");
    if (strategy === "oldest") {
      return items.slice().sort((a, b) => compareDate(a.dateAdded, b.dateAdded) || a.id - b.id)[0];
    }
    if (strategy === "newest") {
      return items.slice().sort((a, b) => compareDate(b.dateAdded, a.dateAdded) || a.id - b.id)[0];
    }
    if (strategy === "modified") {
      return items.slice().sort((a, b) => compareDate(b.dateModified, a.dateModified) || a.id - b.id)[0];
    }
    const scored = [];
    for (const item of items) {
      scored.push({ item, score: await scoreItem(item) });
    }
    scored.sort((a, b) => b.score - a.score || String(a.item.dateAdded).localeCompare(String(b.item.dateAdded)));
    return scored[0].item;
  }

  function compareDate(a, b) {
    const aTime = Date.parse(a || "") || 0;
    const bTime = Date.parse(b || "") || 0;
    return aTime - bTime;
  }

  async function scoreItem(item) {
    let score = 0;
    try {
      score += (item.getUsedFields(false) || []).length * 10;
      score += (item.getCollections() || []).length * 2;
      score += (item.getTags() || []).length;
    } catch (error) {}
    try {
      const childCount = await Zotero.DB.valueQueryAsync(
        "SELECT COUNT(*) FROM itemAttachments WHERE parentItemID=?",
        [item.id]
      );
      score += Number(childCount || 0) * 20;
    } catch (error) {}
    return score;
  }

  async function mergeWebpageIntoArticle(master, webpage) {
    await copyMissingValidFields(master, webpage);
    copyCollections(master, webpage);
    copyTags(master, webpage);
    copyRelations(master, webpage);
    copyCreatorsIfMasterEmpty(master, webpage);
    await moveChildren(master, webpage);
    addReplacesRelation(master, webpage);
    await master.saveTx();
    webpage.deleted = true;
    await webpage.saveTx();
  }

  async function copyMissingValidFields(master, source) {
    let fields = [];
    try {
      fields = source.getUsedFields(false) || [];
    } catch (error) {
      return;
    }
    for (const fieldID of fields) {
      let fieldName;
      try {
        fieldName = Zotero.ItemFields.getName(fieldID);
      } catch (error) {
        continue;
      }
      if (!fieldName || fieldName === "title" || fieldName === "DOI") {
        continue;
      }
      const sourceValue = source.getField(fieldName);
      if (!sourceValue || master.getField(fieldName)) {
        continue;
      }
      try {
        if (Zotero.ItemFields.isValidForType(fieldID, master.itemTypeID)) {
          master.setField(fieldName, sourceValue);
        }
      } catch (error) {}
    }
  }

  function copyCollections(master, source) {
    const ids = unique([...(master.getCollections() || []), ...(source.getCollections() || [])]);
    master.setCollections(ids);
  }

  function copyTags(master, source) {
    const seen = new Set();
    const tags = [];
    for (const tag of [...(master.getTags() || []), ...(source.getTags() || [])]) {
      const key = `${tag.tag}::${tag.type || 0}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      tags.push(tag);
    }
    master.setTags(tags);
  }

  function copyRelations(master, source) {
    let relations = {};
    try {
      relations = source.getRelations() || {};
    } catch (error) {
      return;
    }
    for (const predicate of Object.keys(relations)) {
      for (const object of relations[predicate] || []) {
        try {
          master.addRelation(predicate, object);
        } catch (error) {}
      }
    }
  }

  function copyCreatorsIfMasterEmpty(master, source) {
    try {
      const masterCreators = master.getCreatorsJSON ? master.getCreatorsJSON() : [];
      const sourceCreators = source.getCreatorsJSON ? source.getCreatorsJSON() : [];
      if ((!masterCreators || masterCreators.length === 0) && sourceCreators && sourceCreators.length > 0 && master.setCreators) {
        master.setCreators(sourceCreators);
      }
    } catch (error) {}
  }

  function addReplacesRelation(master, source) {
    try {
      master.addRelation("dc:replaces", Zotero.URI.getItemURI(source));
    } catch (error) {}
  }

  async function moveChildren(master, source) {
    const childIDs = await Zotero.DB.columnQueryAsync(
      `SELECT itemID FROM itemAttachments WHERE parentItemID=?
        UNION
       SELECT itemID FROM itemNotes WHERE parentItemID=?`,
      [source.id, source.id]
    );
    for (const childID of childIDs) {
      const child = await Zotero.Items.getAsync(childID);
      if (!child || child.deleted) {
        continue;
      }
      child.parentID = master.id;
      await child.saveTx();
    }
  }

  function summarizeReport(report) {
    return [
      `Regular items scanned: ${report.totalRegularItems}`,
      `Same-DOI duplicate groups: ${report.sameDOIGroups.length}`,
      `Safe webpage -> journalArticle groups: ${report.sameDOIWebpageArticleGroups.length}`,
      `Same-type DOI groups for Zotero/Zoplicate/manual merge: ${report.sameDOISameTypeGroups.length}`,
      `Same-title manual-review groups: ${report.titleOnlyReviewGroups.length}`,
    ].join("\n");
  }

  function notify(headline, body) {
    if (!Boolean(getPref(SHOW_NOTIFICATIONS_PREF, true))) {
      Zotero.debug(`${headline}: ${body}`);
      return;
    }
    try {
      const progress = new Zotero.ProgressWindow();
      progress.changeHeadline(headline);
      progress.addDescription(body);
      progress.show();
      progress.startCloseTimer(5000);
    } catch (error) {
      Zotero.debug(`${headline}: ${body}`);
    }
  }

  function makeProgress(headline, initialText) {
    try {
      const progress = new Zotero.ProgressWindow({ closeOnClick: true });
      progress.changeHeadline(headline);
      const item = new progress.ItemProgress(null, initialText);
      item.setProgress(0);
      progress.show();
      return {
        set(text, percent) {
          item.setText(text);
          item.setProgress(percent);
        },
        done(text) {
          item.setText(text);
          item.setProgress(100);
          progress.startCloseTimer(6000);
        },
      };
    } catch (error) {
      return {
        set(text) {
          Zotero.debug(`Duplicate Doctor progress: ${text}`);
        },
        done(text) {
          Zotero.debug(`Duplicate Doctor done: ${text}`);
        },
      };
    }
  }

  function normalizeDOI(value) {
    if (!value) {
      return "";
    }
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
      .replace(/^doi:\s*/, "")
      .replace(/[.\s]+$/, "");
  }

  function extractIdentifiersFromRow(row) {
    const texts = [row.doi, row.url, row.extra].filter(Boolean);
    return {
      doi: unique(texts.flatMap(extractDOIsFromText)),
      isbn: unique([row.isbn, row.url, row.extra].flatMap(cleanISBNString)),
    };
  }

  function extractDOIsFromText(value) {
    if (!value) {
      return [];
    }
    const text = String(value);
    const values = [];
    try {
      const cleaned = Zotero.Utilities?.cleanDOI?.(text);
      if (cleaned) {
        values.push(cleaned);
      }
    } catch (error) {}
    const matches = text.match(/\b10\.\d{4,9}\/[^\s"'<>]+/gi) || [];
    for (const match of matches) {
      values.push(match);
    }
    return unique(values.map(normalizeDOI).filter(Boolean));
  }

  function cleanISBNString(value) {
    if (!value) {
      return [];
    }
    const normalized = String(value).toUpperCase().replace(/[\x2D\xAD\u2010-\u2015\u2043\u2212]+/g, "");
    const matches = normalized.match(/\b(?:97[89]\s*(?:\d\s*){9}\d|(?:\d\s*){9}[\dX])(?=\D|$)/g) || [];
    return unique(matches.map((isbn) => isbn.replace(/\s+/g, "").replace(/^978/, "")));
  }

  function normalizeTitle(value) {
    if (!value) {
      return "";
    }
    return String(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function truncate(value, maxLength) {
    value = value || "";
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength - 3) + "...";
  }
})();
