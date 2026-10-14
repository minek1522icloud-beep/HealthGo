#!/usr/bin/env python3
"""Verify a real iPhoneOS arm64 build, then package it as an UNSIGNED IPA.

This does not sign an app, provide provisioning profiles, or bypass Apple's
device installation and entitlement requirements. Intended for CI artifacts
that the app owner signs locally for testing.
"""
from __future__ import annotations

import argparse
import hashlib
import plistlib
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


REQUIRED_JS = (
    "public/index.html",
    "public/healthgo-apple-health53.js",
    "public/healthgo-devices-pro45.js",
    "public/healthgo-services.js",
    "public/healthgo-ai-bundle.js",
)


def verify_bundle(app: Path, entitlements: Path) -> None:
    if not app.is_dir() or not app.name.endswith(".app"):
        raise RuntimeError(f"Brak skompilowanej aplikacji .app: {app}")
    plist_path = app / "Info.plist"
    with plist_path.open("rb") as stream:
        info = plistlib.load(stream)

    if info.get("CFBundleIdentifier") != "com.healthgo.app":
        raise RuntimeError("Niepoprawny identyfikator: oczekiwano com.healthgo.app")
    executable = info.get("CFBundleExecutable")
    if not executable or not (app / executable).is_file():
        raise RuntimeError("Nie znaleziono pliku wykonywalnego aplikacji")
    platforms = info.get("CFBundleSupportedPlatforms", [])
    if "iPhoneOS" not in platforms or "iPhoneSimulator" in platforms:
        raise RuntimeError(f"To nie jest kompilacja na fizycznego iPhone'a: {platforms}")
    purpose = info.get("NSHealthShareUsageDescription", "")
    if not isinstance(purpose, str) or len(purpose.strip()) < 30:
        raise RuntimeError("Brak wyjasnienia zgody Apple Health")
    with entitlements.open("rb") as stream:
        enabled = plistlib.load(stream)
    if enabled.get("com.apple.developer.healthkit") is not True:
        raise RuntimeError("Brakuje HealthKit w konfiguracji uprawnien")

    for relative in REQUIRED_JS:
        file = app / relative
        if not file.is_file() or file.stat().st_size == 0:
            raise RuntimeError(f"Brak zasobu aplikacji: {relative}")

    result = subprocess.run(
        ["xcrun", "lipo", "-archs", str(app / executable)],
        check=True, capture_output=True, text=True,
    )
    architectures = result.stdout.strip().split()
    if "arm64" not in architectures or "x86_64" in architectures:
        raise RuntimeError(f"Niepoprawna architektura: {architectures}")

    if (app / "embedded.mobileprovision").exists():
        raise RuntimeError("To narzedzie tworzy tylko NIEPODPISANE pakiety testowe")
    print("Potwierdzono iPhoneOS arm64, Apple Health i wszystkie zasoby HealthGo.")


def pack(app: Path, output: Path) -> None:
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="healthgo-iphone-") as folder:
        payload = Path(folder) / "Payload"
        payload.mkdir()
        subprocess.run(
            ["ditto", str(app.resolve()), str(payload / app.name)],
            check=True,
        )
        # -y preserves symbolic links in Frameworks; the IPA must have a Payload root.
        subprocess.run(
            ["zip", "-qry", str(output), "Payload"],
            cwd=folder, check=True,
        )

    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("Archiwum IPA nie przeszlo kontroli CRC")
        names = set(archive.namelist())
        base = f"Payload/{app.name}/"
        if not {base + "Info.plist", base + "public/index.html",
                base + "public/healthgo-apple-health53.js"}.issubset(names):
            raise RuntimeError("IPA nie zawiera wymaganych plikow aplikacji")
        with archive.open(base + "Info.plist") as stream:
            info = plistlib.load(stream)
        if info.get("CFBundleIdentifier") != "com.healthgo.app":
            raise RuntimeError("Identyfikator IPA nie zgadza sie z projektem")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(f"Utworzono testowa NIEPODPISANA IPA: {output}")
    print(f"Wielkosc: {output.stat().st_size} bajtow, SHA-256: {digest}")
    print("NIE mozna zainstalowac przez samo otwarcie IPA w Plikach iPhone'a.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--entitlements", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        verify_bundle(args.app, args.entitlements)
        pack(args.app, args.output)
    except (OSError, RuntimeError, subprocess.CalledProcessError,
            plistlib.InvalidFileException, zipfile.BadZipFile) as error:
        print(f"BLAD weryfikacji IPA: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
