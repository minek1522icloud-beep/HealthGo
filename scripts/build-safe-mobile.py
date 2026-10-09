#!/usr/bin/env python3
"""Build a low-resource diagnostic variant of the same HealthGo HTML shell.

safe.html is a temporary troubleshooting route for Safari WebContent crashes.
It must not alter accounts, session storage or normal index.html.
"""
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("Usage: build-safe-mobile.py SOURCE.html OUTPUT.html")

source = Path(sys.argv[1])
target = Path(sys.argv[2])
html = source.read_text(encoding="utf-8")

def replace_once(before, after=""):
    global html
    count = html.count(before)
    if count != 1:
        raise SystemExit(f"Safe mode build expected one match, got {count}: {before[:100]}")
    html = html.replace(before, after, 1)

# Keep the primary layout, Supabase authentication, account data and baseline
# app features. Avoid extra network requests and expensive decoration on iOS.
optional = (
    '<script src="./healthgo-pro.js"></script>',
    '<script src="./healthgo-v2-ui.js"></script>',
    '<script src="./healthgo-mobile-suite.js"></script>',
    '<script src="./healthgo-map-v2.js?v=1"></script>',
    '<script src="./healthgo-offline-ai.js"></script>',
    '<script src="./healthgo-devices.js"></script>',
    '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>',
    '<script src="https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js"></script>',
)
# Optional modules are installed or removed as the normal HealthGo chat evolves.
# Absence is valid; duplicates indicate a broken shell and must still fail loudly.
for tag in optional:
    occurrences = html.count(tag)
    if occurrences > 1:
        raise SystemExit(
            f"Safe mode build found {occurrences} duplicate optional tags: {tag[:100]}"
        )
    if occurrences == 1:
        html = html.replace(tag, "", 1)

replace_once("if (typeof setupMobilePWA === 'function') setupMobilePWA();",
             "// Safe diagnostics: do not register SW or poll/refresh this page.")

# A visible flag makes clear that some non-core parts are intentionally
# disabled, without modifying the user's installed HealthGo or preferences.
banner = """
<style>
#hg-safe-note{position:relative;z-index:9999;background:#eef4ff;color:#163a78;border:1px solid #a9c8fa;padding:10px 14px;font:700 13px -apple-system,BlinkMacSystemFont,Arial,sans-serif;line-height:1.45}
#hg-safe-note a{color:#1d4ed8}
</style>
<script>
window.addEventListener('DOMContentLoaded',function(){
 var note=document.createElement('div');
 note.id='hg-safe-note';
 note.textContent='Tryb bezpieczny HealthGo — część dodatkowych funkcji jest wyłączona. ';
 var link=document.createElement('a');
 link.href='./diagnostics.html';
 link.textContent='Wróć do diagnostyki';
 note.appendChild(link);
 document.body.insertBefore(note,document.body.firstChild);
});
</script>
"""
replace_once("</body>", banner + "</body>")
replace_once('<meta name="viewport"',
             '<meta name="healthgo-safe-mode" content="1">\n<meta name="viewport"')
target.write_text(html, encoding="utf-8")
print(f"Created {target}: {len(html)} bytes (iPhone diagnostic mode)")
