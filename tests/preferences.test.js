const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const preferences = fs.readFileSync(path.join(root, "chrome/content/preferences.xhtml"), "utf8");
const controlIDs = [...preferences.matchAll(/<(?:checkbox|radio|button)\b[^>]*\bdata-l10n-id="([^"]+)"/g)].map((match) => match[1]);

assert(controlIDs.length > 0, "preferences.xhtml should contain localized controls");

for (const locale of ["en-US", "zh-CN"]) {
  const ftl = fs.readFileSync(path.join(root, "locale", locale, "duplicate-doctor-preferences.ftl"), "utf8");
  for (const id of controlIDs) {
    const pattern = new RegExp(`^${id}\\s*=\\s*\\n(?:[ \\t]+\\.[\\w-]+\\s*=.*\\n)*[ \\t]+\\.label\\s*=`, "m");
    assert(pattern.test(ftl), `${locale} ${id} must define a Fluent .label attribute`);
  }
}

console.log("preferences.test.js passed");
