from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import Counter, defaultdict


def normalize_doi(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip().lower()
    value = re.sub(r"^https?://(dx\.)?doi\.org/", "", value)
    value = re.sub(r"^doi:\s*", "", value)
    return re.sub(r"[.\s]+$", "", value)


def normalize_title(value: str | None) -> str:
    if not value:
        return ""
    value = value.lower().strip()
    value = re.sub(r"[^\w]+", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only audit for Duplicate Doctor candidate groups.")
    parser.add_argument("--db", required=True, help="Path to zotero.sqlite. The database is opened read-only.")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    con = sqlite3.connect(f"file:{args.db}?mode=ro&immutable=1", uri=True)
    con.row_factory = sqlite3.Row
    fields = {row["fieldName"]: row["fieldID"] for row in con.execute("select fieldID, fieldName from fieldsCombined")}
    rows = con.execute(
        """
        SELECT i.itemID, i.libraryID, i.key, it.typeName AS itemType,
               doiValues.value AS doi,
               titleValues.value AS title
          FROM items i
          JOIN itemTypesCombined it ON it.itemTypeID = i.itemTypeID
          LEFT JOIN itemData doiData ON doiData.itemID = i.itemID AND doiData.fieldID = ?
          LEFT JOIN itemDataValues doiValues ON doiValues.valueID = doiData.valueID
          LEFT JOIN itemData titleData ON titleData.itemID = i.itemID AND titleData.fieldID = ?
          LEFT JOIN itemDataValues titleValues ON titleValues.valueID = titleData.valueID
         WHERE i.itemID NOT IN (SELECT itemID FROM deletedItems)
           AND i.itemID NOT IN (SELECT itemID FROM itemAttachments)
           AND i.itemID NOT IN (SELECT itemID FROM itemNotes)
        """,
        (fields["DOI"], fields["title"]),
    ).fetchall()

    doi_groups = defaultdict(list)
    title_groups = defaultdict(list)
    for row in rows:
        doi = normalize_doi(row["doi"])
        title = normalize_title(row["title"])
        if doi:
            doi_groups[(row["libraryID"], doi)].append(dict(row))
        if title:
            title_groups[(row["libraryID"], title)].append(dict(row))

    same_doi = [group for group in doi_groups.values() if len(group) > 1]
    safe = []
    same_type = []
    for group in same_doi:
        counts = Counter(row["itemType"] for row in group)
        if counts["journalArticle"] and counts["webpage"]:
            safe.append(group)
        elif len(counts) == 1:
            same_type.append(group)

    title_review = []
    for group in title_groups.values():
        if len(group) < 2:
            continue
        dois = {normalize_doi(row["doi"]) for row in group if normalize_doi(row["doi"])}
        if len(dois) != 1:
            title_review.append(group)

    summary = {
        "regular_items": len(rows),
        "same_doi_groups": len(same_doi),
        "safe_webpage_article_groups": len(safe),
        "same_type_doi_groups": len(same_type),
        "same_title_manual_review_groups": len(title_review),
        "safe_examples": safe[:25],
    }
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({k: v for k, v in summary.items() if k != "safe_examples"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
