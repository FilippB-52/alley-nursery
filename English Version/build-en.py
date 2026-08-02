#!/usr/bin/env python3
"""Generate en/index.html: an English copy of the Russian landing page.

Read-only with respect to the original — it only ever writes en/index.html.
Run from anywhere:  python3 en/build-en.py
"""
import json, re, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

src = (ROOT / "index.html").read_text(encoding="utf-8")
tr = json.loads((HERE / "translations.json").read_text(encoding="utf-8"))

# Patterns that compose with the dictionary above (applied by the same longest-first pass).
tr["В корзину: "] = "Add to cart: "
tr["— фото "] = "— photo "

# Longest first so "Клён остролистный" is never clipped by the shorter "Клён".
for ru in sorted(tr, key=len, reverse=True):
    src = src.replace(ru, tr[ru])

# Testimonial avatar initials must match the transliterated names.
initials = {"Ю": "Y", "М": "M", "А": "A", "В": "V", "П": "P", "С": "S"}
src = re.sub(
    r'(class="tm-av"[^>]*>)([А-ЯЁ])(</span>)',
    lambda m: m.group(1) + initials.get(m.group(2), m.group(2)) + m.group(3),
    src,
)

src = src.replace('<html lang="ru"', '<html lang="en"')

(HERE / "index.html").write_text(src, encoding="utf-8")

leftovers = sorted(set(re.findall(r"[^<>\"]*[А-Яа-яЁё][^<>\"]*", src)))
print(f"wrote {HERE / 'index.html'}")
print(f"untranslated fragments remaining: {len(leftovers)}")
for s in leftovers:
    print("  ·", s.strip()[:120])
