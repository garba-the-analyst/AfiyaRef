"""Apply AfiyaRef Android manifest patches idempotently.

`flet build` regenerates build/flutter from scratch on fresh clones, which drops
our manual edits (cleartext HTTP for the dev/LAN backend + location permissions).
Run this after the Flutter project exists and before/after `flet build apk` —
it is safe to run multiple times.

Usage: python3 ci_patch_manifest.py [path/to/AndroidManifest.xml]
"""
import sys
from pathlib import Path

DEFAULT = Path(__file__).parent / "build" / "flutter" / "android" / "app" / "src" / "main" / "AndroidManifest.xml"

CLEARTEXT = 'android:usesCleartextTraffic="true"'
PERMS = [
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
]
INTERNET = '<uses-permission android:name="android.permission.INTERNET" />'


def patch(path: Path) -> bool:
    text = path.read_text()
    changed = False
    if CLEARTEXT not in text:
        text = text.replace(
            'android:enableOnBackInvokedCallback="true"',
            'android:enableOnBackInvokedCallback="true"\n        ' + CLEARTEXT,
            1,
        )
        changed = True
    for perm in PERMS:
        if perm not in text:
            text = text.replace(INTERNET, INTERNET + "\n    " + perm, 1)
            changed = True
    if changed:
        path.write_text(text)
    return changed


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    if not target.exists():
        print(f"manifest not found: {target} (run flet build once first)")
        sys.exit(2)
    print("patched" if patch(target) else "already patched")
