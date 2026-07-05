from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DEFAULT_REPOSITORY = "pandaAIGC/zotero-duplicate-doctor"
XPI_NAME = "duplicate-doctor.xpi"
UPDATES_NAME = "updates.json"
INCLUDE_SUFFIXES = {".json", ".js", ".ftl", ".md", ".txt", ".xhtml", ".svg"}
EXCLUDE_PARTS = {"dist", "tests", "__pycache__", ".codex-local"}
EXCLUDE_NAMES = {"package.json", "package-lock.json", UPDATES_NAME}
INCLUDE_NAMES = {"LICENSE"}


def iter_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        rel = path.relative_to(ROOT)
        if not path.is_file():
            continue
        if any(part in EXCLUDE_PARTS for part in rel.parts):
            continue
        if rel.parts[0] == "scripts":
            continue
        if path.name in EXCLUDE_NAMES:
            continue
        if path.name in INCLUDE_NAMES or path.suffix.lower() in INCLUDE_SUFFIXES:
            files.append(path)
    return sorted(files)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Duplicate Doctor XPI.")
    parser.add_argument("--repository", default=DEFAULT_REPOSITORY, help="GitHub repository in owner/name form.")
    parser.add_argument("--release-tag", help="Release tag for update_link. Defaults to v<manifest version>.")
    parser.add_argument("--update-link", help="Full public XPI URL. Overrides --repository and --release-tag.")
    args = parser.parse_args()

    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    addon_id = manifest["applications"]["zotero"]["id"]
    release_tag = args.release_tag or f"v{version}"
    update_link = args.update_link or f"https://github.com/{args.repository}/releases/download/{release_tag}/{XPI_NAME}"

    DIST.mkdir(exist_ok=True)
    xpi = ROOT / XPI_NAME
    with zipfile.ZipFile(xpi, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in iter_files():
            zf.write(path, path.relative_to(ROOT).as_posix())

    digest = hashlib.sha256(xpi.read_bytes()).hexdigest()
    updates = {
        "addons": {
            addon_id: {
                "updates": [
                    {
                        "version": version,
                        "update_link": update_link,
                        "update_hash": f"sha256:{digest}",
                        "applications": {
                            "zotero": {
                                "strict_min_version": manifest["applications"]["zotero"]["strict_min_version"],
                                "strict_max_version": manifest["applications"]["zotero"]["strict_max_version"],
                            }
                        },
                    }
                ]
            }
        }
    }
    updates_json = json.dumps(updates, indent=2) + "\n"
    (ROOT / UPDATES_NAME).write_text(updates_json, encoding="utf-8")
    shutil.copy2(xpi, DIST / XPI_NAME)
    (DIST / UPDATES_NAME).write_text(updates_json, encoding="utf-8")
    print(xpi)
    print(f"sha256:{digest}")


if __name__ == "__main__":
    main()
