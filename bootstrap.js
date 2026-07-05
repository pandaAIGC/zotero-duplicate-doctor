var addonData = null;
var duplicateDoctor = {};
var chromeHandle = null;

function install(data, reason) {}

async function startup({ id, version, rootURI }, reason) {
  addonData = { id, version, rootURI };
  const aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"]
    .getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "duplicate_doctor", rootURI + "chrome/content/"],
  ]);

  await Zotero.initializationPromise;
  Services.scriptloader.loadSubScript(rootURI + "chrome/content/duplicateDoctor.js", {
    DuplicateDoctor: duplicateDoctor,
    Zotero,
    Services,
    ChromeUtils,
  });
  await duplicateDoctor.startup(addonData);

  if (Zotero.PreferencePanes?.register) {
    Zotero.PreferencePanes.register({
      pluginID: id,
      id: "zotero-prefpane-duplicate-doctor",
      label: "Duplicate Doctor",
      image: rootURI + "chrome/content/icons/icon.svg",
      src: rootURI + "chrome/content/preferences.xhtml",
      scripts: [rootURI + "chrome/content/preferences.js"],
    });
  }
}

async function shutdown(data, reason) {
  if (duplicateDoctor.shutdown) {
    await duplicateDoctor.shutdown();
  }
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
  duplicateDoctor = {};
  addonData = null;
}

function uninstall(data, reason) {}

async function onMainWindowLoad({ window }) {
  if (duplicateDoctor.onMainWindowLoad) {
    await duplicateDoctor.onMainWindowLoad(window);
  }
}

async function onMainWindowUnload({ window }) {
  if (duplicateDoctor.onMainWindowUnload) {
    await duplicateDoctor.onMainWindowUnload(window);
  }
}
