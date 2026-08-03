/* Single-product configurator modal. Opens when a .catalog-card is clicked (landing or
   full catalog). Pulls varieties/sizes/prices from window.ALLEYA_CATALOG and the
   description/category/badge from window.ALLEYA_INFO. Pick variety -> pick size -> price
   updates live. Built so a real cart can hook into addToCart(). */
(function () {
  const CATALOG = (window.ALLEYA_CATALOG || []).concat(window.ALLEYA_CATALOG_CONTAINER || []);
  const INFO = window.ALLEYA_INFO || {};
  const bySlug = {};
  CATALOG.forEach((s) => (bySlug[s.slug] = s));

  const fmt = (n) => Number(n).toLocaleString('ru-RU') + ' ₽';

  // ---- Build the modal shell once ----
  const overlay = document.createElement('div');
  overlay.className = 'pm-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="pm-dialog" role="dialog" aria-modal="true" aria-labelledby="pm-name" data-lenis-prevent>
      <button class="pm-close" type="button" aria-label="Закрыть">&times;</button>
      <div class="pm-media">
        <div class="pm-thumbs" id="pm-thumbs"></div>
        <div class="pm-main" id="pm-main">
          <span class="pm-badge" id="pm-badge" hidden></span>
        </div>
      </div>
      <div class="pm-info">
        <p class="pm-cat" id="pm-cat"></p>
        <h2 class="pm-name" id="pm-name"></h2>
        <p class="pm-price" id="pm-price"></p>
        <div class="pm-divider"></div>
        <p class="pm-desc" id="pm-desc"></p>
        <div class="pm-config">
          <div class="pm-field" id="pm-field-variety">
            <p class="pm-field-label">Сорт</p>
            <div class="pm-opts" id="pm-varieties"></div>
          </div>
          <div class="pm-field" id="pm-field-size">
            <p class="pm-field-label">Размер · высота и обхват ствола</p>
            <div class="pm-opts" id="pm-sizes"></div>
          </div>
        </div>
        <div class="pm-buy">
          <div class="pm-qty">
            <button class="pm-step pm-minus" type="button" aria-label="Убрать один">&minus;</button>
            <span class="pm-qty-val" id="pm-qty" aria-live="polite">1</span>
            <button class="pm-step pm-plus" type="button" aria-label="Добавить один">+</button>
          </div>
          <button class="pm-add" id="pm-add" type="button">В корзину</button>
        </div>
        <p class="pm-stock"><span class="pm-dot"></span><span>В наличии</span></p>
        <a class="pm-ship" href="#contact">Доставка, обмен и возврат</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const el = {
    close: overlay.querySelector('.pm-close'),
    thumbs: overlay.querySelector('#pm-thumbs'),
    main: overlay.querySelector('#pm-main'),
    badge: overlay.querySelector('#pm-badge'),
    cat: overlay.querySelector('#pm-cat'),
    name: overlay.querySelector('#pm-name'),
    price: overlay.querySelector('#pm-price'),
    desc: overlay.querySelector('#pm-desc'),
    fieldVariety: overlay.querySelector('#pm-field-variety'),
    varieties: overlay.querySelector('#pm-varieties'),
    sizes: overlay.querySelector('#pm-sizes'),
    qty: overlay.querySelector('#pm-qty'),
    minus: overlay.querySelector('.pm-minus'),
    plus: overlay.querySelector('.pm-plus'),
    add: overlay.querySelector('#pm-add')
  };

  let qty = 1;
  let current = null; // { slug, variety, variant }

  function setQty(n) {
    qty = Math.max(1, n);
    el.qty.textContent = qty;
    el.minus.disabled = qty <= 1;
  }

  function sizeLabel(v) {
    const parts = [];
    if (v.height) parts.push(v.height);
    if (v.caliper) parts.push('⌀ ' + v.caliper);
    let s = parts.join(' · ') || 'размер уточняется';
    if (v.form) s += ' · ' + v.form;
    return s;
  }

  function renderSizes(variety) {
    el.sizes.innerHTML = '';
    variety.variants.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pm-opt' + (i === 0 ? ' is-active' : '');
      b.textContent = sizeLabel(v);
      b.addEventListener('click', () => {
        el.sizes.querySelectorAll('.pm-opt').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        current.variant = v;
        updatePrice();
        resetAddButton();
      });
      el.sizes.appendChild(b);
    });
    current.variant = variety.variants[0]; // auto-select cheapest so price is concrete
    updatePrice();
  }

  function selectVariety(product, variety, chip) {
    el.varieties.querySelectorAll('.pm-opt').forEach((x) => x.classList.remove('is-active'));
    if (chip) chip.classList.add('is-active');
    current.variety = variety;
    renderSizes(variety);
    resetAddButton();
  }

  function updatePrice() {
    if (current && current.variant) el.price.textContent = fmt(current.variant.price);
  }

  function placeholder() {
    const w = document.createElement('div');
    w.className = 'ph-inner';
    w.innerHTML =
      '<svg class="ph-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21c-5 0-9-4-9-9 5 0 9 1 11 5"/><path d="M20 4C10 4 5 9 5 17c8 0 15-4 15-13z"/><path d="M12 15c2-3 5-5 8-6"/></svg>' +
      '<span class="ph-label">Фото скоро</span>';
    return w;
  }

  function populate(slug) {
    const product = bySlug[slug];
    if (!product) return false;
    const info = INFO[slug] || {};
    current = { slug, variety: null, variant: null };

    el.cat.textContent = info.cat || product.cat || '';
    el.name.textContent = product.name;
    el.desc.textContent = info.description || product.description || '';

    // media
    el.main.querySelectorAll('img, .ph-inner').forEach((n) => n.remove());
    el.thumbs.hidden = true;
    el.thumbs.innerHTML = '';
    if (product.image) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name;
      el.main.appendChild(img);
    } else {
      el.main.classList.add('pm-main--ph');
      el.main.appendChild(placeholder());
    }
    el.main.classList.toggle('pm-main--ph', !product.image);

    if (info.badge) {
      el.badge.textContent = info.badge.label;
      el.badge.className = 'pm-badge pm-badge--' + info.badge.type;
      el.badge.hidden = false;
    } else {
      el.badge.hidden = true;
    }

    // varieties
    el.varieties.innerHTML = '';
    const multi = product.varieties.length > 1;
    el.fieldVariety.style.display = multi ? '' : 'none';
    product.varieties.forEach((variety, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pm-opt' + (i === 0 ? ' is-active' : '');
      b.textContent = variety.name;
      b.addEventListener('click', () => selectVariety(product, variety, b));
      el.varieties.appendChild(b);
    });
    selectVariety(product, product.varieties[0], el.varieties.firstChild);

    setQty(1);
    resetAddButton();
    return true;
  }

  function open(slug) {
    if (!populate(slug)) return;
    overlay.hidden = false;
    document.body.classList.add('pm-open');
    // A stopped Lenis calls preventDefault() on every wheel and touchmove on the page, so
    // it silently kills native scrolling inside this dialog as well — the modal looked
    // frozen on a phone. data-lenis-prevent on .pm-dialog (see the template above) is the
    // documented opt-out; Lenis checks the composed path for it before it preventDefaults.
    if (window.__lenis) window.__lenis.stop();
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    el.close.focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('pm-open');
    if (window.__lenis) window.__lenis.start();
    const done = () => { overlay.hidden = true; overlay.removeEventListener('transitionend', done); };
    overlay.addEventListener('transitionend', done);
  }

  let addTimer;
  function resetAddButton() {
    clearTimeout(addTimer);
    el.add.classList.remove('is-added');
    el.add.textContent = 'В корзину';
  }
  function addToCart() {
    if (!current || !current.variant) return;
    const product = bySlug[current.slug];
    const v = current.variant;

    if (!window.ALLEYA_CART) {
      el.add.classList.add('is-added');
      el.add.textContent = 'Добавлено ✓';
      clearTimeout(addTimer);
      addTimer = setTimeout(resetAddButton, 1600);
      return;
    }

    // Hand over to the cart drawer — it opens itself, so the configurator steps aside first.
    close();
    window.ALLEYA_CART.add({
      slug: current.slug,
      name: product.name,
      image: product.image || '',
      variety: product.varieties.length > 1 ? current.variety.name : '',
      height: v.height || '',
      caliper: v.caliper || '',
      form: v.form || '',
      price: v.price,
      qty
    });
  }

  // ---- Wiring ----
  el.minus.addEventListener('click', () => setQty(qty - 1));
  el.plus.addEventListener('click', () => setQty(qty + 1));
  el.add.addEventListener('click', addToCart);
  el.close.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });

  // Any click on a card (including its cart button) opens the configurator modal.
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.catalog-card');
    if (!card) return;
    const slug = cardSlug(card);
    if (slug && bySlug[slug]) {
      e.preventDefault();
      open(slug);
    }
  });

  function cardSlug(card) {
    if (card.dataset.product) return card.dataset.product;
    const img = card.querySelector('.catalog-media img');
    const src = img && img.getAttribute('src');
    const m = src && src.match(/([^/]+)\.[a-z0-9]+$/i);
    return m ? m[1] : null;
  }
})();
