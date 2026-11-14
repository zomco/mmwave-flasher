"""Assemble the website from published component release bundles."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import zipfile
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_contract import check

check()

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / '.component'
spec = importlib.util.spec_from_file_location('firmware_releases', COMPONENT / 'scripts/releases.py')
firmware = importlib.util.module_from_spec(spec)
spec.loader.exec_module(firmware)
read, write = firmware.read, firmware.write
validate_bundle, download_release, gh = firmware.validate_bundle, firmware.download_release, firmware.gh

def catalog():
    data = read(ROOT / 'static/device-catalog.json')
    return [r for r in data['radars'] if r['status'] == 'Completed'], data['boards']

def assemble(repo, output, local_releases=None):
    models, _ = catalog()
    eligible = {m["id"] for m in models}
    output = Path(output)
    # The pre-release test fleet has no legacy OTA retention requirement.
    # A fresh Vite build supplies the site; GitHub Releases supplies firmware.
    releases = []
    if local_releases:
        local_dir = Path(local_releases)
        release_dirs = []
        if (local_dir / "release.json").is_file():
            release_dirs.append(local_dir)
        elif local_dir.is_dir():
            for child in sorted(local_dir.iterdir()):
                if child.is_dir() and (child / "release.json").is_file():
                    release_dirs.append(child)
        for r_dir in release_dirs:
            meta = read(r_dir / "release.json")
            validate_bundle(meta, r_dir / "firmware-bundle.zip")
            tag = meta["version"]
            with zipfile.ZipFile(r_dir / "firmware-bundle.zip") as bundle:
                bundle.extractall(output / "firmware" / tag)
            meta["firmware"] = [f for f in meta["firmware"] if f["radarId"] in eligible]
            if meta["firmware"]:
                releases.append(meta)
    else:
        with tempfile.TemporaryDirectory() as temp:
            page = 1
            while True:
                batch = json.loads(gh("api", f"repos/{repo}/releases?per_page=100&page={page}"))
                for release in batch:
                    if release["draft"]:
                        continue
                    assets = {a["name"] for a in release["assets"]}
                    if not ({"release.json", "firmware-bundle.zip"} & assets):
                        continue  # Older releases remain outside the new channel index.
                    if not {"release.json", "firmware-bundle.zip"} <= assets:
                        raise ValueError("Incomplete release assets")
                    tag = release["tag_name"]
                    meta = download_release(repo, tag, Path(temp) / tag)
                    meta["publishedAt"] = release["published_at"]
                    with zipfile.ZipFile(Path(temp) / tag / "firmware-bundle.zip") as bundle:
                        bundle.extractall(output / "firmware" / tag)  # validated safe paths above
                    meta["firmware"] = [f for f in meta["firmware"] if f["radarId"] in eligible]
                    if meta["firmware"]:
                        releases.append(meta)
                if len(batch) < 100:
                    break
                page += 1
    releases.sort(key=lambda r: (r["publishedAt"], r["version"]), reverse=True)
    assigned = set()
    for release in releases:
        if release["channel"] != "beta":
            continue
        for target in release["firmware"]:
            model = target["radarId"]
            if model in assigned:
                continue
            assigned.add(model)
            folder = f"{model}-ESP32-C3"
            shutil.copytree(output / "firmware" / release["version"] / folder, output / folder, dirs_exist_ok=True)
    # Only validated Beta releases create stable OTA aliases.
    by_path = {}
    for model in sorted(assigned):
        path = f"{model}-ESP32-C3/manifest.json"
        by_path[path] = {"id": f"{model}-ESP32-C3", "manifest": path}
    write(output / "models.json", list(by_path.values()))
    write(output / "releases.json", {"schemaVersion": 1, "releases": releases})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repo', help='Firmware release repository, normally zomco/mmwave-component')
    parser.add_argument('output')
    parser.add_argument('--local-releases')
    assemble(**vars(parser.parse_args()))

if __name__ == '__main__':
    main()
