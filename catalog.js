/* Catalog page: renders one card per species from window.ALLEYA_CATALOG (generated from
   the price list) + window.ALLEYA_INFO (category/badge/description), then filters and sorts
   them. Cards open the configurator modal (product-modal.js). No dependencies. */
(function () {
  const grid = document.getElementById('catalog-grid');
  const grunt = (window.ALLEYA_CATALOG || []).map((x) => ({ segment: 'grunt', ...x }));
  const container = window.ALLEYA_CATALOG_CONTAINER || [];
  const catalog = grunt.concat(container);
  if (!grid || !catalog.length) return;
  const INFO = window.ALLEYA_INFO || {};

  const fmt = (n) => Number(n).toLocaleString('ru-RU') + ' ₽';
  const maxNum = (s) => Math.max(...(String(s).match(/\d+/g) || [0]).map(Number));

  function heightBucket(cm) {
    const m = maxNum(cm);
    if (m <= 200) return '0-2';
    if (m <= 300) return '2-3';
    if (m <= 400) return '3-4';
    return '4+';
  }
  function caliperBucket(cm) {
    const m = maxNum(cm);
    if (m <= 8) return '0-8';
    if (m <= 12) return '8-12';
    return '12-99';
  }

  const CART_SVG =
    '<svg class="i-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/><path d="M3 4h2l2.1 11a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6"/></svg>' +
    '<svg class="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

  // ---- Build cards ----
  catalog.forEach((sp, i) => {
    const info = INFO[sp.slug] || {};
    const cat = info.cat || sp.cat || '';
    const prices = [];
    const heights = new Set();
    const calipers = new Set();
    sp.varieties.forEach((v) =>
      v.variants.forEach((x) => {
        prices.push(x.price);
        if (x.height) heights.add(heightBucket(x.height));
        if (x.caliper) calipers.add(caliperBucket(x.caliper));
      })
    );
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);

    const card = document.createElement('article');
    card.className = 'catalog-card';
    card.dataset.product = sp.slug;
    card.dataset.segment = sp.segment || 'grunt';
    card.dataset.type = cat;
    card.dataset.price = minP;
    card.dataset.maxprice = maxP;
    card.dataset.heights = [...heights].join(',');
    card.dataset.calipers = [...calipers].join(',');
    card.dataset.name = sp.name;
    card.dataset.order = i;

    // media (image or branded placeholder)
    const media = document.createElement('div');
    media.className = 'catalog-media';
    if (sp.image) {
      const img = document.createElement('img');
      img.src = sp.image;
      img.alt = sp.name;
      img.loading = 'lazy';
      media.appendChild(img);
    } else {
      media.classList.add('catalog-media--ph');
      media.appendChild(placeholderNode(sp.name));
    }
    if (info.badge) {
      const b = document.createElement('span');
      b.className = 'catalog-badge catalog-badge--' + info.badge.type;
      b.textContent = info.badge.label;
      media.appendChild(b);
    }

    const body = document.createElement('div');
    body.className = 'catalog-body';
    body.innerHTML =
      `<p class="catalog-cat">${cat}</p>` +
      `<h3 class="catalog-name">${sp.name}</h3>` +
      `<div class="catalog-foot"><span class="catalog-price">от ${fmt(minP)}</span>` +
      `<button class="catalog-buy" type="button" aria-label="В корзину: ${sp.name}">${CART_SVG}</button></div>`;

    card.appendChild(media);
    card.appendChild(body);
    grid.appendChild(card);
  });

  function placeholderNode(name) {
    const wrap = document.createElement('div');
    wrap.className = 'ph-inner';
    wrap.innerHTML =
      '<svg class="ph-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M11 21c-5 0-9-4-9-9 5 0 9 1 11 5"/><path d="M20 4C10 4 5 9 5 17c8 0 15-4 15-13z"/><path d="M12 15c2-3 5-5 8-6"/></svg>' +
      '<span class="ph-label">Фото скоро</span>';
    return wrap;
  }

  // ---- Filtering / sorting ----
  const cards = Array.from(grid.querySelectorAll('.catalog-card'));
  const lo = document.getElementById('price-lo');
  const hi = document.getElementById('price-hi');
  const fill = document.getElementById('range-fill');
  const minLabel = document.getElementById('price-min-label');
  const maxLabel = document.getElementById('price-max-label');
  const resultN = document.getElementById('result-n');
  const resultTotal = document.getElementById('result-total');
  const emptyMsg = document.getElementById('catalog-empty');
  const sortSel = document.getElementById('sort-select');

  const PMIN = +lo.min;
  const PMAX = +lo.max;
  const GAP = 1000;
  const state = { segment: 'grunt', type: new Set(), height: new Set(), caliper: new Set(), lo: PMIN, hi: PMAX };

  // ---- Segment filter (Грунтовые / Контейнерные) — single-select chip, always one active ----
  const segButtons = Array.from(document.querySelectorAll('.chip[data-segment]'));
  const segGroups = Array.from(document.querySelectorAll('.filter-group[data-seg]'));
  // Show only the filter groups that make sense for the active segment
  // (grunt keeps Тип/Высота/Обхват; container swaps in its own Тип, drops the tree-only ones).
  function updateFilterVisibility(seg) {
    segGroups.forEach((g) => (g.hidden = g.dataset.seg !== seg));
  }
  function switchSegment(seg) {
    if (seg === state.segment) return;
    state.segment = seg;
    resetFilters(); // clears every other filter + all chip.is-active, then re-applies for this segment
    segButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.segment === seg));
    updateFilterVisibility(seg);
  }
  segButtons.forEach((b) => b.addEventListener('click', () => switchSegment(b.dataset.segment)));

  document.querySelectorAll('.chip[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const set = state[chip.dataset.filter];
      const v = chip.dataset.value;
      if (set.has(v)) { set.delete(v); chip.classList.remove('is-active'); }
      else { set.add(v); chip.classList.add('is-active'); }
      apply();
    });
  });

  const pickChips = Array.from(document.querySelectorAll('.chip[data-price-pick]'));
  pickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const [a, b] = chip.dataset.pricePick.split('-').map(Number);
      if (chip.classList.contains('is-active')) {
        chip.classList.remove('is-active');
        lo.value = PMIN; hi.value = PMAX;
      } else {
        pickChips.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        lo.value = a; hi.value = b;
      }
      syncRange();
    });
  });

  function clearPicks() { pickChips.forEach((c) => c.classList.remove('is-active')); }

  function syncRange(changed) {
    let l = +lo.value, h = +hi.value;
    if (h - l < GAP) {
      if (changed === 'hi') l = Math.max(PMIN, h - GAP);
      else h = Math.min(PMAX, l + GAP);
      lo.value = l; hi.value = h;
    }
    state.lo = l; state.hi = h;
    fill.style.left = ((l - PMIN) / (PMAX - PMIN)) * 100 + '%';
    fill.style.right = 100 - ((h - PMIN) / (PMAX - PMIN)) * 100 + '%';
    minLabel.textContent = fmt(l);
    maxLabel.textContent = fmt(h);
    apply();
  }
  lo.addEventListener('input', () => { clearPicks(); syncRange('lo'); });
  hi.addEventListener('input', () => { clearPicks(); syncRange('hi'); });

  sortSel.addEventListener('change', apply);
  function sortCards(list) {
    const by = {
      'price-asc': (a, b) => a.dataset.price - b.dataset.price,
      'price-desc': (a, b) => b.dataset.price - a.dataset.price,
      name: (a, b) => a.dataset.name.localeCompare(b.dataset.name, 'ru'),
      pop: (a, b) => a.dataset.order - b.dataset.order
    }[sortSel.value];
    return list.slice().sort(by);
  }

  function resetFilters() {
    state.type.clear(); state.height.clear(); state.caliper.clear();
    // leave the segment chip alone — resetting filters shouldn't switch which segment you're viewing
    document.querySelectorAll('.chip.is-active:not([data-segment])').forEach((c) => c.classList.remove('is-active'));
    lo.value = PMIN; hi.value = PMAX;
    sortSel.value = 'pop';
    syncRange();
  }
  document.getElementById('filters-reset').addEventListener('click', resetFilters);

  function overlaps(set, csv) {
    if (!set.size) return true;
    const have = csv ? csv.split(',') : [];
    return have.some((x) => set.has(x));
  }

  function apply() {
    const inSegment = cards.filter((card) => card.dataset.segment === state.segment);
    const visible = inSegment.filter((card) => {
      if (state.type.size && !state.type.has(card.dataset.type)) return false;
      if (!overlaps(state.height, card.dataset.heights)) return false;
      if (!overlaps(state.caliper, card.dataset.calipers)) return false;
      const minP = +card.dataset.price, maxP = +card.dataset.maxprice;
      if (minP > state.hi || maxP < state.lo) return false; // range overlap
      return true;
    });
    cards.forEach((c) => (c.style.display = 'none'));
    sortCards(visible).forEach((c) => { c.style.display = ''; grid.appendChild(c); });
    resultN.textContent = visible.length;
    if (resultTotal) resultTotal.textContent = inSegment.length;
    emptyMsg.hidden = visible.length !== 0;
    syncMobileBar(visible.length);
  }

  /* ---- Phones: filters behind a button instead of a wall above the products ---- */
  // The sidebar rendered in full above the grid, so reaching a single tree meant scrolling
  // past every filter group. This is the usual e-commerce handling: the primary split
  // (грунтовые / контейнерные) stays on screen as tabs, everything else lives in a bottom
  // sheet behind one button that carries a count of what is active, and the sheet's
  // confirm button reports how many species the current selection leaves.
  const mq = window.matchMedia('(max-width: 860px)');
  const filtersEl = document.getElementById('filters');
  const scrim = document.getElementById('filters-scrim');
  const segHost = document.getElementById('cat-segwrap');
  const segGroup = document.getElementById('segment-group');
  const openBtn = document.getElementById('cat-filter-btn');
  const countEl = document.getElementById('cat-filter-count');
  const applyBtn = document.getElementById('filters-apply');
  const applyN = document.getElementById('apply-n');
  const closeBtn = document.getElementById('filters-close');
  const segHome = segGroup && segGroup.parentNode;

  function activeCount() {
    return state.type.size + state.height.size + state.caliper.size +
      (state.lo > PMIN || state.hi < PMAX ? 1 : 0);
  }
  function syncMobileBar(n) {
    if (applyN) applyN.textContent = n;
    if (!countEl) return;
    const c = activeCount();
    countEl.textContent = c;
    countEl.hidden = c === 0;
  }

  let sheetOpen = false;
  function setSheet(open) {
    sheetOpen = open;
    filtersEl.classList.toggle('is-open', open);
    if (scrim) scrim.hidden = !open;
    document.body.classList.toggle('filters-open', open);
    // Lenis keeps driving the page behind the sheet otherwise. Note that a stopped Lenis
    // preventDefaults every touchmove on the page, so the sheet itself carries
    // data-lenis-prevent (see catalog.html) or it would not scroll on a phone.
    if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
  }
  if (openBtn) openBtn.addEventListener('click', () => setSheet(true));
  if (closeBtn) closeBtn.addEventListener('click', () => setSheet(false));
  if (applyBtn) applyBtn.addEventListener('click', () => setSheet(false));
  if (scrim) scrim.addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) setSheet(false); });

  // Move the real segment chips between the sheet and the sticky bar rather than
  // duplicating them, so their existing click wiring and .is-active state carry over.
  function placeSegment() {
    if (!segGroup || !segHost || !segHome) return;
    const target = mq.matches ? segHost : segHome;
    if (segGroup.parentNode !== target) {
      if (target === segHome) segHome.insertBefore(segGroup, segHome.children[1] || null);
      else target.appendChild(segGroup);
    }
    if (!mq.matches && sheetOpen) setSheet(false);
  }
  placeSegment();
  mq.addEventListener('change', placeSegment);

  if (location.hash === '#container') switchSegment('container');
  syncRange(); // initial paint
})();
