/* Shopping cart: localStorage-backed store + slide-in drawer + header badge.
   Loaded on every page. product-modal.js pushes items in through window.ALLEYA_CART.add().
   All copy is authored in Russian — i18n.js translates the live DOM when EN is active. */
(function () {
  const KEY = 'alleya.cart.v1';

  // Volume discounts, same tiers as the catalog page banner. Highest matching tier wins.
  const TIERS = [
    { from: 500000, rate: 0.15 },
    { from: 300000, rate: 0.1 },
    { from: 100000, rate: 0.05 }
  ];

  const fmt = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

  /* ---------- Store ---------- */
  let items = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(raw) ? raw.filter((x) => x && x.id && x.price) : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      /* private mode / quota — the cart still works for this page view */
    }
    listeners.forEach((fn) => fn(items));
  }

  const listeners = [];

  function itemId(x) {
    return [x.slug, x.variety, x.height, x.caliper, x.form].join('|');
  }

  function subtotal() {
    return items.reduce((s, x) => s + x.price * x.qty, 0);
  }
  function discountRate(sub) {
    const tier = TIERS.find((t) => sub >= t.from);
    return tier ? tier.rate : 0;
  }
  function totals() {
    const sub = subtotal();
    const rate = discountRate(sub);
    return { sub, rate, discount: sub * rate, total: sub - sub * rate };
  }
  function count() {
    return items.reduce((s, x) => s + x.qty, 0);
  }

  const CART = {
    items: () => items.map((x) => ({ ...x })),
    count,
    totals,
    add(item) {
      const id = itemId(item);
      const found = items.find((x) => x.id === id);
      if (found) found.qty += item.qty || 1;
      else items.push({ ...item, id, qty: item.qty || 1 });
      save();
      render();
      open();
    },
    setQty(id, qty) {
      const found = items.find((x) => x.id === id);
      if (!found) return;
      if (qty <= 0) return CART.remove(id);
      found.qty = qty;
      save();
      render();
    },
    remove(id) {
      items = items.filter((x) => x.id !== id);
      save();
      render();
    },
    clear() {
      items = [];
      save();
      render();
    },
    open: () => open(),
    close: () => close(),
    onChange(fn) {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    }
  };
  window.ALLEYA_CART = CART;

  /* ---------- Header badge ---------- */
  // Every page carries a .cart-btn in its header; keep its counter in sync.
  function syncBadges() {
    const n = count();
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = n;
      el.hidden = n === 0;
    });
    document.querySelectorAll('.cart-btn').forEach((b) => b.classList.toggle('has-items', n > 0));
  }

  /* ---------- Drawer ---------- */
  const drawer = document.createElement('div');
  drawer.className = 'cart-drawer';
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="cart-scrim"></div>
    <aside class="cart-panel" role="dialog" aria-modal="true" aria-label="Корзина">
      <header class="cart-head">
        <p class="cart-title">Корзина</p>
        <button class="cart-close" type="button" aria-label="Закрыть">&times;</button>
      </header>
      <div class="cart-scroll" data-lenis-prevent>
        <ul class="cart-items"></ul>
        <div class="cart-blank" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/><path d="M3 4h2l2.1 11a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6"/></svg>
          <p class="cart-blank-title">Корзина пуста</p>
          <p class="cart-blank-sub">Выберите растения в каталоге — сорт и размер можно подобрать прямо в карточке.</p>
          <a class="btn btn-dark btn-primary" href="catalog.html">В каталог</a>
        </div>
      </div>
      <footer class="cart-foot" hidden>
        <div class="cart-line"><span>Растения</span><span class="cart-sub"></span></div>
        <div class="cart-line cart-line--disc" hidden><span class="cart-disc-label"></span><span class="cart-disc"></span></div>
        <div class="cart-line cart-line--total"><span>Итого</span><span class="cart-total"></span></div>
        <p class="cart-next" hidden></p>
        <p class="cart-hint">Доставка и погрузка рассчитываются менеджером после оформления.</p>
        <a class="btn btn-dark btn-primary cart-checkout" href="checkout.html">Оформить заказ</a>
        <button class="cart-continue" type="button">Продолжить покупки</button>
      </footer>
    </aside>`;
  document.body.appendChild(drawer);

  const ui = {
    scrim: drawer.querySelector('.cart-scrim'),
    panel: drawer.querySelector('.cart-panel'),
    close: drawer.querySelector('.cart-close'),
    list: drawer.querySelector('.cart-items'),
    blank: drawer.querySelector('.cart-blank'),
    foot: drawer.querySelector('.cart-foot'),
    sub: drawer.querySelector('.cart-sub'),
    discLine: drawer.querySelector('.cart-line--disc'),
    discLabel: drawer.querySelector('.cart-disc-label'),
    disc: drawer.querySelector('.cart-disc'),
    total: drawer.querySelector('.cart-total'),
    next: drawer.querySelector('.cart-next'),
    continue: drawer.querySelector('.cart-continue')
  };

  function sizeLine(x) {
    const parts = [];
    if (x.height) parts.push(x.height);
    if (x.caliper) parts.push('⌀ ' + x.caliper);
    if (x.form) parts.push(x.form);
    return parts.join(' · ');
  }

  function itemNode(x) {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.dataset.id = x.id;
    const media = x.image
      ? `<img src="${x.image}" alt="${x.name}">`
      : '<span class="cart-item-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21c-5 0-9-4-9-9 5 0 9 1 11 5"/><path d="M20 4C10 4 5 9 5 17c8 0 15-4 15-13z"/></svg></span>';
    li.innerHTML = `
      <div class="cart-item-media">${media}</div>
      <div class="cart-item-body">
        <p class="cart-item-name">${x.name}</p>
        ${x.variety ? `<p class="cart-item-meta">${x.variety}</p>` : ''}
        <p class="cart-item-meta">${sizeLine(x)}</p>
        <div class="cart-item-foot">
          <div class="cart-qty">
            <button class="cart-step" type="button" data-step="-1" aria-label="Убрать один">&minus;</button>
            <span class="cart-qty-val">${x.qty}</span>
            <button class="cart-step" type="button" data-step="1" aria-label="Добавить один">+</button>
          </div>
          <span class="cart-item-price">${fmt(x.price * x.qty)}</span>
        </div>
      </div>
      <button class="cart-del" type="button" aria-label="Удалить из корзины">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>`;
    return li;
  }

  function render() {
    syncBadges();
    ui.list.innerHTML = '';
    items.forEach((x) => ui.list.appendChild(itemNode(x)));

    const empty = items.length === 0;
    ui.blank.hidden = !empty;
    ui.foot.hidden = empty;
    ui.list.hidden = empty;

    const t = totals();
    ui.sub.textContent = fmt(t.sub);
    ui.total.textContent = fmt(t.total);
    ui.discLine.hidden = t.rate === 0;
    if (t.rate) {
      ui.discLabel.textContent = 'Скидка ' + Math.round(t.rate * 100) + '%';
      ui.disc.textContent = '−' + fmt(t.discount);
    }

    // Nudge towards the next discount tier — the price list rewards volume orders.
    const next = [...TIERS].reverse().find((tier) => t.sub < tier.from);
    ui.next.hidden = !next || empty;
    if (next && !empty) {
      ui.next.textContent =
        'Ещё ' + fmt(next.from - t.sub) + ' до скидки ' + Math.round(next.rate * 100) + '%';
    }
    document.dispatchEvent(new CustomEvent('alleya:cartrender'));
  }

  function open() {
    if (!drawer.hidden) return;
    drawer.hidden = false;
    document.body.classList.add('cart-open');
    // Stopping Lenis makes it preventDefault every touchmove on the page, which would take
    // the drawer's own list with it — .cart-scroll carries data-lenis-prevent to opt out.
    if (window.__lenis) window.__lenis.stop();
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    ui.close.focus();
  }

  function close() {
    if (drawer.hidden) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('cart-open');
    if (window.__lenis) window.__lenis.start();
    const done = (e) => {
      if (e.target !== ui.panel) return;
      drawer.hidden = true;
      ui.panel.removeEventListener('transitionend', done);
    };
    ui.panel.addEventListener('transitionend', done);
  }

  /* ---------- Wiring ---------- */
  ui.close.addEventListener('click', close);
  ui.scrim.addEventListener('click', close);
  ui.continue.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.hidden) close();
  });

  ui.list.addEventListener('click', (e) => {
    const li = e.target.closest('.cart-item');
    if (!li) return;
    const step = e.target.closest('.cart-step');
    if (step) return CART.setQty(li.dataset.id, itemQty(li.dataset.id) + Number(step.dataset.step));
    if (e.target.closest('.cart-del')) CART.remove(li.dataset.id);
  });
  function itemQty(id) {
    const found = items.find((x) => x.id === id);
    return found ? found.qty : 0;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.cart-btn')) open();
  });

  // Another tab changed the cart — keep this one honest.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    items = load();
    render();
  });

  render();
})();
