# Аллея — питомник растений

Landing page, catalogue, cart and checkout for the Alleya plant nursery (Rostov-on-Don).

Static site: plain HTML/CSS/JS, no build step. GSAP + ScrollTrigger and Lenis load from CDN.

## Run locally

```bash
python3 devserver.py
```

Then open http://localhost:8756 — the server sends no-cache headers so edits show up on reload.

## Structure

| File | What it is |
|---|---|
| `index.html` | Landing page |
| `catalog.html` / `catalog.js` | Catalogue page and its filtering/rendering |
| `checkout.html` / `checkout.js` | Checkout form |
| `cart.js` | Cart state, shared across pages |
| `catalog-data.js` | Product data, generated from the price list |
| `products.js` | Product copy used by the card modal |
| `i18n.js` | Runtime RU → EN translation of the live DOM, driven by the header toggle |
| `script.js` | Landing page interactions |
| `dome-gallery.js` / `soft-aurora.js` / `popup.js` / `product-modal.js` | Individual components |
| `styles.css` / `dome-gallery.css` | Styles |
| `assets/` | Fonts, photos, video |
| `English Version/` | Superseded build-time English copy, kept for reference. New copy goes in `i18n.js` |

## Adding copy

Write it in Russian in the markup, then add the matching entry to the dictionary in `i18n.js`
so the EN toggle keeps working.
