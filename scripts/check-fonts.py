#!/usr/bin/env python3
"""Fails if a bundled font lacks any character Spanish text needs.
Usage: python3 scripts/check-fonts.py   (needs: pip install fonttools brotli)"""
import glob, sys
from fontTools.ttLib import TTFont

SPANISH = "áéíóúüñÁÉÍÓÚÜÑ¿¡«»ªº€—–“”‘’…·"
fonts = sorted(glob.glob("static/fonts/**/*.woff*", recursive=True))
for pkg in glob.glob("node_modules/@fontsource*/*/"):
    fonts += sorted(f for f in glob.glob(pkg + "files/*-latin-*.woff2") if "latin-ext" not in f)
bad = 0
for path in fonts:
    cmap = TTFont(path).getBestCmap()
    missing = "".join(c for c in SPANISH if ord(c) not in cmap)
    if missing:
        bad += 1
        print(f"MISSING {missing!r} in {path}")
print(f"{len(fonts)} font files checked, {bad} incomplete for Spanish")
sys.exit(1 if bad or not fonts else 0)
