const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const localDriveNames = ["Users", "Roaming", "Zotero", "Sys" + "dok", "Downloads", "Documents"];
const localDriveAlternation = localDriveNames.join("|");
const blocked = [
  new RegExp(`[A-Z]:\\\\(?:${localDriveAlternation})\\\\`, "i"),
  new RegExp(`[A-Z]:/(?:${localDriveAlternation})/`, "i"),
  /C:\\Users\\/i,
  /C:\/Users\//i,
  new RegExp("xbg" + "08ctm", "i"),
  /\bWHO\b/,
  new RegExp("your" + "-name", "i"),
  new RegExp("duplicate-doctor@zotero" + "\\.local", "i"),
  /E:\\Zotero\\/i,
  /E:\/Zotero\//i,
  new RegExp("Sys" + "dok", "i"),
];
const ignoredDirs = new Set(["dist", "node_modules", "__pycache__", ".git", ".codex-local"]);
const checkedSuffixes = new Set([".js", ".json", ".md", ".py", ".xhtml", ".ftl", ".txt"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (checkedSuffixes.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

const violations = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of blocked) {
    if (pattern.test(text)) {
      violations.push(`${rel}: ${pattern}`);
    }
  }
}

assert.deepStrictEqual(violations, [], "privacy scan found local or placeholder data");
console.log("privacy-scan.test.js passed");
