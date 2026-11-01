#!/usr/bin/env python3
"""Create 1024px iOS primary and alternate app icon asset sets."""
from __future__ import annotations
import argparse, json, plistlib, io
from pathlib import Path
from PIL import Image
import cairosvg

NAMES = ["HalloweenIcon", "ChristmasIcon", "EasterIcon", "SummerIcon"]

def write_set(root: Path, name: str, image: Image.Image) -> None:
    folder = root / f"{name}.appiconset"
    folder.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS).save(folder / f"{name}.png", "PNG", optimize=True)
    payload = {"images":[{"filename":f"{name}.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}
    (folder / "Contents.json").write_text(json.dumps(payload, indent=2) + "\n")

def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--project", required=True, type=Path)
    args=parser.parse_args()
    app=args.project/"App"
    catalog=app/"Assets.xcassets"
    catalog.mkdir(parents=True, exist_ok=True)
    source=Path("icon.png")
    if not source.is_file(): raise FileNotFoundError(source)
    write_set(catalog, "AppIcon", Image.open(source).convert("RGBA"))
    icons=Path("native-shell/ios-seasonal/icons")
    for name in NAMES:
        svg=icons/f"{name}.svg"
        if not svg.is_file(): raise FileNotFoundError(svg)
        png=cairosvg.svg2png(url=str(svg), output_width=1024, output_height=1024)
        write_set(catalog, name, Image.open(io.BytesIO(png)).convert("RGBA"))
    plist=app/"Info.plist"
    with plist.open("rb") as f: info=plistlib.load(f)
    info["CFBundleIcons"]={"CFBundlePrimaryIcon":{"CFBundleIconName":"AppIcon","CFBundleIconFiles":["AppIcon"],"UIPrerenderedIcon":False},
        "CFBundleAlternateIcons":{name:{"CFBundleIconFiles":[name],"UIPrerenderedIcon":False} for name in NAMES}}
    info["CFBundleIcons~ipad"]=info["CFBundleIcons"]
    with plist.open("wb") as f: plistlib.dump(info,f,sort_keys=False)
    print("Generated primary + four alternate iOS icon sets and Info.plist declarations.")

if __name__=="__main__": main()
