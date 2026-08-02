# English Version — Alleya landing page

> **Superseded.** The site now switches language at runtime: `i18n.js` in the project root
> translates the live DOM (every page, cart and checkout included) from the RU/EN toggle in
> the header. This folder is the older build-time copy of the landing page only; it is not
> loaded by the site and `build-en.py` no longer reflects what visitors see. Kept for
> reference — add new wording to `i18n.js`, not to `translations.json`.

An English copy of the **landing page only** ([../index.html](../index.html)).
Kept fully separate: nothing in this folder is loaded by the Russian site, and
nothing outside this folder was modified to create it. Russian stays the master copy.

## Switch to English

```bash
python3 "English Version/devserver-en.py"
```

Then open **http://localhost:8757**. The Russian site keeps running on its own
server at http://localhost:8756 — the two never touch.

Stop it when done:

```bash
pkill -f devserver-en.py
```

## Files

| File | What it is |
|---|---|
| `index.html` | The English page. **Generated — do not hand-edit**, it gets overwritten. |
| `translations.json` | The Russian → English string map. Edit wording here. |
| `build-en.py` | Regenerates `index.html` from `../index.html` + the map. |
| `devserver-en.py` | Serves this page at `/` on port 8757, all assets from the project root. |

## After changing the Russian page

The English copy does not update itself. Regenerate it:

```bash
python3 "English Version/build-en.py"
```

It prints `untranslated fragments remaining: N` and lists any Russian text it did
not recognise — add those to `translations.json` and run it again until N is 0.

## Known gaps

Deliberate, because only the landing page was needed:

- The header **Catalogue** link and **Open the full catalogue** button go to the
  Russian [../catalog.html](../catalog.html).
- Clicking a product card opens a modal whose text comes from
  [../products.js](../products.js) and is still Russian. The cards themselves are translated.
- The logo is untouched by design.
