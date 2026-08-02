/* Checkout: three validated steps (contacts → delivery → payment) plus a live order
   summary fed by window.ALLEYA_CART. The payment step is where this build deliberately
   stops: no payment provider is connected, so the pay button only explains that. */
(function () {
  const form = document.getElementById('co-form');
  const CART = window.ALLEYA_CART;
  if (!form || !CART) return;

  const fmt = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

  const grid = document.getElementById('co-grid');
  const emptyMsg = document.getElementById('co-empty');
  const steps = Array.from(document.querySelectorAll('.co-step'));
  const panels = Array.from(document.querySelectorAll('.co-panel'));
  const address = document.getElementById('co-address');
  const list = document.getElementById('co-list');
  const subEl = document.getElementById('co-sub');
  const discLine = document.getElementById('co-disc-line');
  const discLabel = document.getElementById('co-disc-label');
  const discEl = document.getElementById('co-disc');
  const shipEl = document.getElementById('co-ship');
  const totalEl = document.getElementById('co-total');
  const paySum = document.getElementById('co-pay-sum');
  const payNote = document.getElementById('co-pay-note');

  /* ---------- Summary ---------- */
  function sizeLine(x) {
    const parts = [];
    if (x.variety) parts.push(x.variety);
    if (x.height) parts.push(x.height);
    if (x.caliper) parts.push('⌀ ' + x.caliper);
    if (x.form) parts.push(x.form);
    return parts.join(' · ');
  }

  function renderSummary() {
    const items = CART.items();
    const empty = items.length === 0;
    emptyMsg.hidden = !empty;
    grid.hidden = empty;
    if (empty) return;

    list.innerHTML = '';
    items.forEach((x) => {
      const li = document.createElement('li');
      li.className = 'co-item';
      const media = x.image ? `<img src="${x.image}" alt="${x.name}">` : '<span class="co-item-ph"></span>';
      li.innerHTML =
        `<div class="co-item-media">${media}<span class="co-item-qty">${x.qty}</span></div>` +
        `<div class="co-item-body"><p class="co-item-name">${x.name}</p><p class="co-item-meta">${sizeLine(x)}</p></div>` +
        `<span class="co-item-price">${fmt(x.price * x.qty)}</span>`;
      list.appendChild(li);
    });

    const t = CART.totals();
    subEl.textContent = fmt(t.sub);
    discLine.hidden = t.rate === 0;
    if (t.rate) {
      discLabel.textContent = 'Скидка ' + Math.round(t.rate * 100) + '%';
      discEl.textContent = '−' + fmt(t.discount);
    }
    totalEl.textContent = fmt(t.total);
    paySum.textContent = fmt(t.total);
  }

  CART.onChange(renderSummary);
  renderSummary();

  /* ---------- Delivery method ---------- */
  form.querySelectorAll('input[name="shipping"]').forEach((r) => {
    r.addEventListener('change', () => {
      const delivery = form.shipping.value === 'delivery';
      address.hidden = !delivery;
      shipEl.textContent = delivery ? 'По расчёту' : 'Самовывоз';
      if (!delivery) clearErrors(address);
    });
  });

  /* ---------- Steps ---------- */
  function show(n) {
    steps.forEach((s) => {
      const i = Number(s.dataset.step);
      s.classList.toggle('is-active', i === n);
      s.classList.toggle('is-done', i < n);
    });
    panels.forEach((p) => p.classList.toggle('is-active', Number(p.dataset.panel) === n));
    const top = document.getElementById('checkout');
    if (window.__lenis) window.__lenis.scrollTo(top, { offset: -100 });
    else top.scrollIntoView({ behavior: 'smooth' });
  }

  function clearErrors(scope) {
    scope.querySelectorAll('.co-field.is-bad').forEach((f) => f.classList.remove('is-bad'));
  }

  // Required inside a hidden block (e.g. the address when picking up) doesn't count.
  function visibleRequired(panel) {
    return Array.from(panel.querySelectorAll('input, textarea')).filter((el) => {
      if (el.type === 'radio' || el.offsetParent === null) return false;
      if (el.name === 'city' || el.name === 'address') return !address.hidden;
      return el.required;
    });
  }

  function validate(panel) {
    let ok = true;
    visibleRequired(panel).forEach((el) => {
      const field = el.closest('.co-field');
      const value = el.value.trim();
      let good = value.length > 1;
      if (el.type === 'email') good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      if (el.type === 'tel') good = value.replace(/\D/g, '').length >= 10;
      field.classList.toggle('is-bad', !good);
      if (!good && ok) el.focus();
      ok = ok && good;
    });
    return ok;
  }

  form.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    const prev = e.target.closest('[data-prev]');
    if (next) {
      const panel = next.closest('.co-panel');
      if (validate(panel)) show(Number(next.dataset.next));
    }
    if (prev) show(Number(prev.dataset.prev));
  });

  // Clear a field's error as soon as the person starts fixing it.
  form.addEventListener('input', (e) => {
    const field = e.target.closest('.co-field');
    if (field) field.classList.remove('is-bad');
  });

  // Steps are clickable backwards only — you can't skip ahead past validation.
  steps.forEach((s) => {
    s.addEventListener('click', () => {
      if (s.classList.contains('is-done')) show(Number(s.dataset.step));
    });
  });

  /* ---------- Payment (intentionally not wired to a provider) ---------- */
  document.getElementById('co-pay').addEventListener('click', () => {
    payNote.hidden = false;
    payNote.classList.remove('is-flash');
    void payNote.offsetWidth;
    payNote.classList.add('is-flash');
  });
})();
