const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("chrome/content/duplicateDoctor.js", "utf8");
const sandbox = {
  DuplicateDoctor: {},
  Zotero: {
    locale: "en-US",
    debug() {},
  },
};

vm.runInNewContext(source, sandbox);

const { normalizeDOI, normalizeTitle, cleanISBNString, summarizeReport } = sandbox.DuplicateDoctor._test;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(normalizeDOI("https://doi.org/10.1056/NEJMOA2031054."), "10.1056/nejmoa2031054", "doi url");
assertEqual(normalizeDOI("doi: 10.1016/S0140-6736(25)01917-8"), "10.1016/s0140-6736(25)01917-8", "doi prefix");
assertEqual(normalizeTitle(" CRISPR-Cas9\u2014Gene   Editing "), "crispr cas9 gene editing", "title normalization");
assertEqual(cleanISBNString("ISBN 978-0-306-40615-7")[0], "0306406157", "isbn 13 normalization");
assertEqual(cleanISBNString("0-306-40615-2")[0], "0306406152", "isbn 10 normalization");

const summary = summarizeReport({
  totalRegularItems: 10,
  sameDOIGroups: [1, 2],
  sameDOIWebpageArticleGroups: [1],
  sameDOISameTypeGroups: [],
  titleOnlyReviewGroups: [1, 2, 3],
});

if (!summary.includes("Safe webpage -> journalArticle groups: 1")) {
  throw new Error("summary missing safe group count");
}

console.log("helpers.test.js passed");
