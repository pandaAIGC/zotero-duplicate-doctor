from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
XPI = ROOT / "dist" / "duplicate-doctor.xpi"


def zotero_is_running() -> bool:
    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq zotero.exe", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception:
        return False
    return "zotero.exe" in result.stdout.lower()


def default_profile() -> Path | None:
    roots: list[Path] = []
    appdata = os.environ.get("APPDATA")
    if appdata:
        roots.append(Path(appdata) / "Zotero" / "Zotero" / "Profiles")
    for root in roots:
        if not root.exists():
            continue
        profiles = sorted(root.glob("*.default*"))
        if profiles:
            return profiles[0]
    return None


def file_uri(path: Path) -> str:
    return "file:///" + quote(str(path.resolve()).replace("\\", "/"), safe="/:!")


def jar_root_uri(path: Path) -> str:
    return f"jar:{file_uri(path)}!/"


def load_manifest(xpi: Path) -> dict:
    with zipfile.ZipFile(xpi) as zf:
        return json.loads(zf.read("manifest.json").decode("utf-8"))


def install(profile: Path, xpi: Path) -> None:
    if not xpi.exists():
        raise SystemExit(f"XPI not found: {xpi}. Run scripts/build_xpi.py first.")
    extensions_dir = profile / "extensions"
    extensions_json = profile / "extensions.json"
    if not extensions_json.exists():
        raise SystemExit(f"extensions.json not found: {extensions_json}")
    extensions_dir.mkdir(exist_ok=True)

    manifest = load_manifest(xpi)
    zotero_app = manifest["applications"]["zotero"]
    addon_id = zotero_app["id"]
    version = manifest["version"]
    target = extensions_dir / f"{addon_id}.xpi"
    shutil.copy2(xpi, target)

    timestamp = int(time.time() * 1000)
    backup = extensions_json.with_name(f"extensions.json.bak-duplicate-doctor-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(extensions_json, backup)
    data = json.loads(extensions_json.read_text(encoding="utf-8"))
    addons = data.setdefault("addons", [])
    addons[:] = [addon for addon in addons if addon.get("id") != addon_id]
    addons.append(
        {
            "id": addon_id,
            "syncGUID": data.get("syncGUID") or "{b98eb879-497a-4b09-9f7b-71ec8ce9941d}",
            "version": version,
            "type": "extension",
            "loader": None,
            "updateURL": zotero_app.get("update_url"),
            "installOrigins": None,
            "manifestVersion": manifest.get("manifest_version", 2),
            "optionsURL": None,
            "optionsType": None,
            "optionsBrowserStyle": True,
            "aboutURL": None,
            "defaultLocale": {
                "name": manifest.get("name"),
                "description": manifest.get("description"),
                "creator": manifest.get("author"),
                "homepageURL": manifest.get("homepage_url"),
                "developers": None,
                "translators": None,
                "contributors": None,
            },
            "visible": True,
            "active": True,
            "userDisabled": False,
            "appDisabled": False,
            "embedderDisabled": False,
            "installDate": timestamp,
            "updateDate": timestamp,
            "applyBackgroundUpdates": 1,
            "path": str(target),
            "skinnable": False,
            "sourceURI": file_uri(xpi),
            "releaseNotesURI": None,
            "softDisabled": False,
            "foreignInstall": False,
            "strictCompatibility": True,
            "locales": [],
            "targetApplications": [
                {
                    "id": "zotero@zotero.org",
                    "minVersion": zotero_app.get("strict_min_version", "7.0"),
                    "maxVersion": zotero_app.get("strict_max_version", "10.*"),
                }
            ],
            "targetPlatforms": [],
            "signedState": 0,
            "signedTypes": [],
            "signedDate": None,
            "seen": True,
            "dependencies": [],
            "incognito": "spanning",
            "userPermissions": {"permissions": [], "origins": [], "data_collection": []},
            "optionalPermissions": {"permissions": [], "origins": [], "data_collection": []},
            "requestedPermissions": {"permissions": [], "origins": [], "data_collection": []},
            "icons": {},
            "iconURL": None,
            "blocklistAttentionDismissed": False,
            "blocklistState": 0,
            "blocklistURL": None,
            "startupData": None,
            "hidden": False,
            "installTelemetryInfo": {"source": "manual-profile-installer"},
            "recommendationState": None,
            "rootURI": jar_root_uri(target),
            "location": "app-profile",
        }
    )
    extensions_json.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Installed {addon_id}")
    print(f"Profile: {profile}")
    print(f"XPI: {target}")
    print(f"Backup: {backup}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Install Duplicate Doctor into a Zotero profile.")
    parser.add_argument("--profile", type=Path, default=default_profile())
    parser.add_argument("--xpi", type=Path, default=XPI)
    parser.add_argument("--allow-running", action="store_true", help="Do not abort if zotero.exe is running.")
    args = parser.parse_args()
    if args.profile is None:
        raise SystemExit("Could not find a Zotero profile. Pass --profile <path>.")
    if zotero_is_running() and not args.allow_running:
        raise SystemExit("Zotero is running. Close Zotero first, then rerun this installer.")
    install(args.profile, args.xpi)


if __name__ == "__main__":
    main()
