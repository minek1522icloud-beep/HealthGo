#!/usr/bin/env python3
"""Patch the generated Capacitor 8 iOS project with HealthGo's local HealthKit plugin.

Fails closed if the expected Xcode project format changes. Run AFTER cap add/sync.
"""
from __future__ import annotations

import argparse
import plistlib
import re
import shutil
from pathlib import Path


def once(text: str, needle: str, replacement: str) -> str:
    count = text.count(needle)
    if count != 1:
        raise RuntimeError(f"Xcode template changed: expected one {needle!r}, found {count}")
    return text.replace(needle, replacement, 1)


def apply(project: Path, templates: Path) -> None:
    app = project / "App"
    pbxpath = project / "App.xcodeproj" / "project.pbxproj"
    storyboard = app / "Base.lproj" / "Main.storyboard"
    infopath = app / "Info.plist"
    for path in [pbxpath, storyboard, infopath]:
        if not path.is_file():
            raise FileNotFoundError(path)

    files = ["HealthGoHealthPlugin.swift", "HealthGoBridgeViewController.swift"]
    for filename in files:
        shutil.copyfile(templates / filename, app / filename)

    pbx = pbxpath.read_text()
    if "HealthGoHealthPlugin.swift" in pbx:
        raise RuntimeError("HealthKit plugin was already added")

    refs = ["F0A100000000000000000001", "F0A100000000000000000002"]
    builds = ["F0A200000000000000000001", "F0A200000000000000000002"]

    for filename, ref, build in zip(files, refs, builds):
        pbx = once(
            pbx, "/* Begin PBXBuildFile section */\n",
            f"/* Begin PBXBuildFile section */\n"
            f"\t\t{build} /* {filename} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref} /* {filename} */; }};\n"
        )
        pbx = once(
            pbx, "/* Begin PBXFileReference section */\n",
            f"/* Begin PBXFileReference section */\n"
            f"\t\t{ref} /* {filename} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {filename}; sourceTree = \"<group>\"; }};\n"
        )

        group = re.search(r"(?m)^([ \t]+)([A-F0-9]{24}) /\* AppDelegate\.swift \*/,$", pbx)
        sources = re.search(r"(?m)^([ \t]+)([A-F0-9]{24}) /\* AppDelegate\.swift in Sources \*/,$", pbx)
        if group is None or sources is None:
            raise RuntimeError("Cannot find AppDelegate entries in generated Xcode project")
        pbx = once(pbx, group.group(0), group.group(0) + f"\n{group.group(1)}{ref} /* {filename} */,")
        pbx = once(pbx, sources.group(0), sources.group(0) + f"\n{sources.group(1)}{build} /* {filename} in Sources */,")

    plistSetting = "\t\t\t\tINFOPLIST_FILE = App/Info.plist;"
    if pbx.count(plistSetting) != 2:
        raise RuntimeError("Expected two app target configurations (Debug/Release)")
    pbx = pbx.replace(plistSetting, "\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/HealthGo.entitlements;\n" + plistSetting)
    pbxpath.write_text(pbx)

    story = storyboard.read_text()
    story = once(
        story,
        'customClass="CAPBridgeViewController" customModule="Capacitor"',
        'customClass="HealthGoBridgeViewController" customModule="App"'
    )
    storyboard.write_text(story)

    with infopath.open("rb") as f:
        info = plistlib.load(f)
    info["NSHealthShareUsageDescription"] = (
        "HealthGo odczytuje po Twojej zgodzie kroki, dystans, kalorie, sen i tętno z Apple Health. "
        "Dane są wyświetlane w Start i Aktywność."
    )
    with infopath.open("wb") as f:
        plistlib.dump(info, f)

    entitlements = {"com.apple.developer.healthkit": True}
    with (app / "HealthGo.entitlements").open("wb") as f:
        plistlib.dump(entitlements, f)

    # Ensure the files weren't accidentally added as mere resources instead of sources.
    for filename in files:
        if f"/* {filename} in Sources */" not in pbx:
            raise RuntimeError(f"{filename} not in Xcode Sources phase")
    print("HealthGo HealthKit plugin registered in Capacitor iOS project.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True, type=Path,
                        help="native-shell/ios/App (directory containing App.xcodeproj)")
    args = parser.parse_args()
    apply(args.project, Path(__file__).resolve().parent.parent / "native-shell" / "ios-healthkit")
