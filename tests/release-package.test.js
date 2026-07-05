const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const buildScript = fs.readFileSync(path.join(root, "scripts/build_xpi.py"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

const zotero = manifest.applications.zotero;

assert.strictEqual(zotero.id, "duplicate-doctor@pandaaigc.github.io", "public builds should use the stable public add-on ID");
assert(!zotero.id.includes("local"), "public add-on ID must not use a local-only domain");
assert(manifest.homepage_url === "https://github.com/pandaAIGC/zotero-duplicate-doctor", "homepage should point to the public repository");
assert(zotero.update_url === "https://raw.githubusercontent.com/pandaAIGC/zotero-duplicate-doctor/main/updates.json", "update_url should match the DOI Fix raw GitHub update manifest pattern");
assert(buildScript.includes('XPI_NAME = "duplicate-doctor.xpi"'), "release XPI should have a portable generic file name");
assert(buildScript.includes('UPDATES_NAME = "updates.json"'), "build should produce a root updates.json release manifest");
assert(buildScript.includes("releases/download/{release_tag}"), "update_link should target a versioned GitHub release asset");
assert(!manifest.homepage_url.includes("your" + "-name"), "manifest must not contain placeholder GitHub owner");
assert(!zotero.update_url.includes("your" + "-name"), "update_url must not contain placeholder GitHub owner");
assert(!readme.includes("duplicate-doctor@" + "zotero." + "local" + ".xpi"), "README should not instruct users to install the local-test XPI name");

console.log("release-package.test.js passed");
