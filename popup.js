/* Lead-capture popup for pros (озеленители / садоводы).
   Opens on the visitor's first scroll intent (wheel / touch / scroll) — fires immediately,
   even if the hero intro animation hasn't finished. Shows on every page load (no storage
   throttling for now). The card is non-blocking: the page keeps scrolling behind it and it
   only closes via the cross or Esc. Form has no backend yet — the email is validated
   client-side; wire the marked hook to a manager email / CRM so a real pro can be verified. */
(function () {
  var pop = document.getElementById('lead-pop');
  if (!pop) return;

  var closeBtn = document.getElementById('lead-pop-close');
  var form = document.getElementById('lead-pop-form');
  var email = document.getElementById('lead-pop-email');
  var formView = document.getElementById('lead-pop-form-view');
  var doneView = document.getElementById('lead-pop-done-view');
  var doneClose = document.getElementById('lead-pop-done-close');

  var opened = false;
  var closed = false;

  function open() {
    if (opened || closed) return;
    opened = true;
    removeTriggers();
    pop.hidden = false;
    requestAnimationFrame(function () { pop.classList.add('is-open'); });
  }

  function close() {
    closed = true; // stays closed until the page is reloaded
    pop.classList.remove('is-open');
    var end = function () { pop.hidden = true; pop.removeEventListener('transitionend', end); };
    pop.addEventListener('transitionend', end);
  }

  // Trigger on the first sign of scrolling — intent (wheel/touch) fires even before scrollY moves.
  function onScroll() { if (window.scrollY > 10) open(); }
  function onIntent() { open(); }
  function removeTriggers() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onIntent);
    window.removeEventListener('touchmove', onIntent);
  }
  // Arriving through a cross-page anchor (catalog.html → Партнёры) jumps the page for you.
  // That is the site scrolling, not the visitor, so on those loads only a real gesture
  // (wheel / touch) counts as intent — the position listener would fire instantly.
  if (!window.__deepLink) window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onIntent, { passive: true });
  window.addEventListener('touchmove', onIntent, { passive: true });

  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pop.classList.contains('is-open')) close();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = (email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      email.classList.add('is-invalid');
      email.focus();
      return;
    }
    // TODO(backend): deliver the lead so a manager can verify the professional.
    //   window.ALLEYA_LEADS?.submit({ email: val, source: 'pro-discount-popup' });
    formView.hidden = true;
    doneView.hidden = false;
  });
  email.addEventListener('input', function () { email.classList.remove('is-invalid'); });

  if (doneClose) doneClose.addEventListener('click', close);
})();
