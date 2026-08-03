const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Always start a load at the very top: no scroll restoration, and drop any #anchor from the
// URL so the browser doesn't jump on its own. A link that asked for a section (the nav on
// catalog.html points at index.html#partners) is kept in __deepLink and scrolled to below,
// once Lenis and the layout are ready — the browser's native jump fights the smooth scroller.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (window.__deepLink === undefined) window.__deepLink = location.hash.length > 1 ? location.hash : '';
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
window.scrollTo(0, 0);

gsap.registerPlugin(ScrollTrigger);

/* ---------- Tree intro: staggered hero reveal after video ---------- */
const introVideo = document.getElementById('hero-intro-video');

// The source clip runs ~5s, which testers found too long before the hero text lands.
// Play it faster instead of re-encoding, so the whole intro fits this budget.
const INTRO_SECONDS = 3;

// Use actual DOM elements — GSAP selector string arrays can be unreliable.
// Navbar reveals first, then the hero content in sequence.
const heroEls = [
  document.querySelector('.site-header'),
  document.querySelector('.hero-content .eyebrow'),
  document.querySelector('.hero-headline'),
  document.querySelector('.hero-sub'),
  document.querySelector('.hero-actions'),
  document.querySelector('.scroll-cue')
].filter(Boolean);

// The scrim (readability overlay) is off during the growth video, fades in with the text.
const heroScrim = document.querySelector('.hero-scrim');

let heroRevealed = false;
// `instant` is used when the intro is skipped — the hero is simply already there.
// (Called as an event listener too, so only an explicit `true` counts.)
function revealHero(instant) {
  if (heroRevealed) return;
  heroRevealed = true;
  // Drop the CSS gate so only GSAP's inline styles control these elements from now on.
  document.documentElement.classList.remove('intro-pending');
  const now = instant === true;
  if (heroScrim) gsap.to(heroScrim, { opacity: 1, duration: now ? 0 : 1.1, ease: 'power2.out' });
  gsap.to(heroEls, {
    opacity: 1,
    y: 0,
    duration: now ? 0 : 0.9,
    ease: 'power3.out',
    stagger: now ? 0 : 0.13
  });
}

// Only run the hero-intro reveal on pages that actually have the intro video
// (so other pages, e.g. the full catalog, keep their header visible normally), and only
// when this load is meant to gate on it — see the decision made in the <head> of index.html.
if (introVideo && window.__gateHero) {
  // Elements are hidden by the .intro-pending gate in <head> (no flash before JS runs).
  // Mirror that hidden state as GSAP inline props so the reveal tween has a clean start.
  gsap.set(heroEls, { opacity: 0, y: 18 });
  if (heroScrim) gsap.set(heroScrim, { opacity: 0 });

  // Squeeze the ~5s source into the budget rather than re-encoding. Only while the copy
  // waits on it; when nothing is gated the growth is free to run at its natural pace.
  const fitIntro = () => {
    const d = introVideo.duration;
    if (d && isFinite(d) && d > INTRO_SECONDS) introVideo.playbackRate = d / INTRO_SECONDS;
  };
  if (introVideo.readyState >= 1) fitIntro();
  else introVideo.addEventListener('loadedmetadata', fitIntro);

  introVideo.addEventListener('ended', revealHero);
  introVideo.addEventListener('error', revealHero);
  // Failsafe: if autoplay is blocked and 'ended' never fires, reveal shortly after the budget.
  setTimeout(revealHero, INTRO_SECONDS * 1000 + 1000);
} else if (introVideo) {
  // Nothing to wait for: either the intro is skipped this load, or this is a phone, where
  // the hero reads immediately and the tree grows underneath it.
  revealHero(true);
}

/* ---------- Lenis smooth scroll, synced to ScrollTrigger ---------- */
let lenis;
if (!prefersReducedMotion) {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });

  lenis.scrollTo(0, { immediate: true });
  window.__lenis = lenis; // exposed so the dome gallery can pause scroll while enlarging
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  lenis.on('scroll', ScrollTrigger.update);
  ScrollTrigger.scrollerProxy(document.body, {
    scrollTop(value) {
      if (arguments.length) lenis.scrollTo(value, { immediate: true });
      return lenis.scroll;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    }
  });
}

/* ---------- Header solid-on-scroll ---------- */
const header = document.getElementById('site-header');
ScrollTrigger.create({
  start: 'top -80',
  onEnter: () => header.classList.add('is-solid'),
  onLeaveBack: () => header.classList.remove('is-solid')
});

/* ---------- Mobile nav dropdown ---------- */
// Same <nav> the desktop uses — CSS turns it into a panel under the bar, this only
// toggles the open class, so there is no second copy of the links to keep in sync.
const navToggle = document.getElementById('nav-toggle');
if (navToggle && header) {
  const setNav = (open) => {
    header.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  };
  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setNav(!header.classList.contains('nav-open'));
  });
  // Close on: picking a link, tapping the page, Escape, or growing past the breakpoint.
  header.querySelectorAll('.main-nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));
  document.addEventListener('click', (e) => {
    if (header.classList.contains('nav-open') && !header.contains(e.target)) setNav(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
  window.matchMedia('(min-width: 721px)').addEventListener('change', (e) => { if (e.matches) setNav(false); });
}

/* ---------- Section entrance reveals ---------- */
const revealConfigs = [
  { selector: '.intro-left', y: 30, x: 0 },
  { selector: '.intro-right', y: 0, x: 30 },
  { selector: '.stats > .eyebrow', y: 24, x: 0 },
  { selector: '.catalog-heading', y: 28, x: 0 },
  { selector: '.geography-heading', y: 24, x: 0 },
  { selector: '.partners-heading', y: 28, x: 0 },
  { selector: '.cta-heading', y: 0, scale: 0.97 }
];

revealConfigs.forEach(({ selector, y = 0, x = 0, scale }) => {
  const el = document.querySelector(selector);
  if (!el) return;
  gsap.from(el, {
    scrollTrigger: { trigger: el, start: 'top 85%' },
    opacity: 0,
    y,
    x,
    scale: scale ?? 1,
    duration: 0.9,
    ease: 'power3.out'
  });
});

// Reveal the catalog row by row (stagger down the grid's vertical axis). Triggered a
// little later and with more travel so it clearly animates in as you reach it.
gsap.from('.catalog-card', {
  scrollTrigger: { trigger: '.catalog-grid', start: 'top 72%' },
  opacity: 0,
  y: 64,
  duration: 0.85,
  ease: 'power3.out',
  stagger: { each: 0.16, grid: 'auto', axis: 'y' },
  clearProps: 'transform'
});

gsap.from('.geography-map', {
  scrollTrigger: { trigger: '.geography-map', start: 'top 85%' },
  opacity: 0,
  y: 40,
  duration: 1,
  ease: 'power3.out'
});

gsap.from('.partner-card', {
  scrollTrigger: { trigger: '.partners-grid', start: 'top 80%' },
  opacity: 0,
  y: 30,
  stagger: 0.1,
  duration: 0.8,
  ease: 'power2.out'
});

/* ---------- Stat counters ---------- */
document.querySelectorAll('.stat-number').forEach((el) => {
  const target = Number(el.dataset.target);

  if (prefersReducedMotion) {
    el.textContent = target.toLocaleString('ru-RU');
    return;
  }

  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: target,
        duration: 1.6,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = Math.round(counter.value).toLocaleString('ru-RU');
        }
      });
    }
  });
});

/* ---------- Sales map: cursor saturation reveal ---------- */
// The map sits muted; a soft circle around the cursor grows in and follows it,
// revealing full colour. Only the mask position/radius change (cheap to composite).
const geoMap = document.querySelector('.geo-map');
if (geoMap && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReducedMotion) {
  const REVEAL = 360; // radius of the colour-reveal circle
  const setX = gsap.quickSetter(geoMap, '--x', 'px');
  const setY = gsap.quickSetter(geoMap, '--y', 'px');
  const setR = gsap.quickSetter(geoMap, '--r', 'px');
  const st = { x: 0, y: 0, r: 0 };
  const apply = () => { setX(st.x); setY(st.y); setR(st.r); };

  geoMap.addEventListener('pointerenter', (e) => {
    const r = geoMap.getBoundingClientRect();
    st.x = e.clientX - r.left;
    st.y = e.clientY - r.top;
    apply();
    gsap.to(st, { r: REVEAL, duration: 0.4, ease: 'power2.out', overwrite: 'auto', onUpdate: apply });
  });
  geoMap.addEventListener('pointermove', (e) => {
    const r = geoMap.getBoundingClientRect();
    gsap.to(st, {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      duration: 0.3,
      ease: 'power3.out',
      overwrite: 'auto',
      onUpdate: apply
    });
  });
  geoMap.addEventListener('pointerleave', () => {
    gsap.to(st, { r: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto', onUpdate: apply });
  });
}

/* ---------- Partner photo carousels ---------- */
// Every gallery waits for its own scroll-in before it starts cycling, and resets to the
// first image at that moment, so each partner is met on her first photo.
//
// These used to be paired — two cards sharing one timer, gated on the first card of the
// pair. On a phone .partners-grid is a single column, so the second card of each pair
// (ODU, Еремеева) was several photos deep by the time you scrolled to it. Watching each
// gallery separately fixes that; on desktop the two cards in a row still come into view
// together, so they stay in step anyway.
document.querySelectorAll('.partner-gallery').forEach((gal) => {
  const slides = Array.from(gal.querySelectorAll('.pg-slide'));
  if (!slides.length) return;

  let step = 0;
  const render = () => {
    slides.forEach((s) => s.classList.remove('is-active'));
    slides[step % slides.length].classList.add('is-active');
  };

  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    if (prefersReducedMotion) return;
    step = 0;
    render(); // the first image is the one on screen the moment it arrives
    if (slides.length > 1) setInterval(() => { step += 1; render(); }, 4000);
  }, { threshold: 0.4 });
  io.observe(gal);
});

/* ---------- Sales map: connector line from Rostov HQ to a hovered pin ---------- */
const geoMapForLines = document.querySelector('.geo-map');
if (geoMapForLines) {
  const hqPin = geoMapForLines.querySelector('.geo-pin--hq');
  const cityPins = Array.from(geoMapForLines.querySelectorAll('.geo-pin:not(.geo-pin--hq)'));
  if (hqPin && cityPins.length) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'geo-lines');
    svg.setAttribute('aria-hidden', 'true');
    // small, slim dart arrowhead sized in px (userSpaceOnUse) so stroke-width doesn't inflate it
    svg.innerHTML =
      '<defs><marker id="geo-arrow" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="11" refX="10.5" refY="5.5" orient="auto">' +
      '<path d="M1,0.8 L12,5.5 L1,10.2 L4.4,5.5 Z" fill="#d23b26"/></marker></defs>';
    geoMapForLines.appendChild(svg);

    const centerIn = (el, mapRect) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - mapRect.left, y: r.top + r.height / 2 - mapRect.top };
    };
    const curveD = (a, b) => {
      // gentle arc: bow the midpoint out perpendicular to the A→B direction
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const bow = dist * 0.18;
      const cx = (a.x + b.x) / 2 + (-dy / dist) * bow;
      const cy = (a.y + b.y) / 2 + (dx / dist) * bow;
      return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
    };

    let paths = [];
    const clear = () => { paths.forEach((p) => p.remove()); paths = []; svg.classList.remove('is-on'); };
    // Draw a curved arrow from Rostov to each target pin (single pin on city hover,
    // all pins on HQ hover — the latter at lower opacity, drawn in a quick sequence).
    const drawTo = (targets, extraClass) => {
      const m = geoMapForLines.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${m.width} ${m.height}`);
      svg.setAttribute('width', m.width);
      svg.setAttribute('height', m.height);
      const a = centerIn(hqPin, m);
      clear();
      targets.forEach((pin, idx) => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('class', 'geo-line' + (extraClass ? ' ' + extraClass : ''));
        p.setAttribute('marker-end', 'url(#geo-arrow)');
        p.setAttribute('d', curveD(a, centerIn(pin, m)));
        svg.appendChild(p);
        const len = p.getTotalLength();
        p.style.transition = 'none';
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        p.getBoundingClientRect(); // reflow
        p.style.transition = 'stroke-dashoffset 0.55s ease';
        p.style.transitionDelay = (idx * 0.035) + 's';
        p.style.strokeDashoffset = 0;
        paths.push(p);
      });
      svg.classList.add('is-on');
    };

    // On a touch screen pointerenter/pointerleave bracket the tap itself, so the route
    // only existed while a finger stayed pressed on the pin. Tap to latch instead:
    // one tap draws, tapping the same pin again (or anywhere else) clears.
    const coarsePointer = window.matchMedia('(hover: none)').matches;
    const allPins = [hqPin].concat(cityPins);
    const targetsFor = (pin) => (pin === hqPin ? cityPins : [pin]);
    const classFor = (pin) => (pin === hqPin ? 'geo-line--all' : undefined);

    if (coarsePointer) {
      let latched = null;
      const unlatch = () => {
        if (latched) latched.classList.remove('is-on');
        latched = null;
        clear();
      };
      allPins.forEach((pin) => {
        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasLatched = latched === pin;
          unlatch();
          if (wasLatched) return;
          drawTo(targetsFor(pin), classFor(pin));
          pin.classList.add('is-on');
          latched = pin;
        });
      });
      document.addEventListener('click', (e) => {
        if (latched && !geoMapForLines.contains(e.target)) unlatch();
      });
    } else {
      allPins.forEach((pin) => {
        pin.addEventListener('pointerenter', () => drawTo(targetsFor(pin), classFor(pin)));
        pin.addEventListener('pointerleave', clear);
        pin.addEventListener('focus', () => drawTo(targetsFor(pin), classFor(pin)));
        pin.addEventListener('blur', clear);
      });
    }
  }
}

/* ---------- In-page links: smooth-scroll without leaving a #hash in the URL ---------- */
// Keeps the address bar clean so a reload always starts at the top.
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  const id = a.getAttribute('href');
  if (!id || id.length < 2) return;
  a.addEventListener('click', (e) => {
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target);
    else target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });
});

/* ---------- Testimonials: endless column carousel (one column per arrow) ---------- */
const tmTrack = document.querySelector('.tm-track');
const tmPrev = document.querySelector('.tm-prev');
const tmNext = document.querySelector('.tm-next');
if (tmTrack && tmPrev && tmNext) {
  const GAP = 30;
  const EASE = 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
  let animating = false;
  const colStep = () => {
    const col = tmTrack.firstElementChild;
    return (col ? col.getBoundingClientRect().width : 400) + GAP;
  };

  // slide left, then recycle the first column to the end → looks endless
  const goNext = () => {
    if (animating) return;
    animating = true;
    tmTrack.style.transition = EASE;
    tmTrack.style.transform = `translateX(${-colStep()}px)`;
    const done = (e) => {
      if (e.propertyName !== 'transform') return;
      tmTrack.removeEventListener('transitionend', done);
      tmTrack.style.transition = 'none';
      tmTrack.appendChild(tmTrack.firstElementChild);
      tmTrack.style.transform = 'translateX(0)';
      void tmTrack.offsetWidth; // flush the reset before re-enabling
      animating = false;
    };
    tmTrack.addEventListener('transitionend', done);
  };

  // put the last column in front (shifted), then slide back to 0 → looks endless
  const goPrev = () => {
    if (animating) return;
    animating = true;
    const step = colStep();
    tmTrack.style.transition = 'none';
    tmTrack.insertBefore(tmTrack.lastElementChild, tmTrack.firstElementChild);
    tmTrack.style.transform = `translateX(${-step}px)`;
    void tmTrack.offsetWidth; // reflow so the next change animates
    tmTrack.style.transition = EASE;
    tmTrack.style.transform = 'translateX(0)';
    const done = (e) => {
      if (e.propertyName !== 'transform') return;
      tmTrack.removeEventListener('transitionend', done);
      animating = false;
    };
    tmTrack.addEventListener('transitionend', done);
  };

  tmNext.addEventListener('click', goNext);
  tmPrev.addEventListener('click', goPrev);
}

/* ---------- Video testimonials: click-to-play YouTube facade ---------- */
// Load the real iframe only on click so the page isn't slowed by two embeds up front.
document.querySelectorAll('.vt-frame').forEach((frame) => {
  frame.addEventListener('click', () => {
    if (frame.dataset.loaded) return;
    frame.dataset.loaded = '1';
    const id = frame.dataset.yt;
    const start = frame.dataset.start ? `&start=${frame.dataset.start}` : '';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${start}`;
    iframe.title = 'Видео-отзыв о питомнике «Аллея»';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    frame.innerHTML = '';
    frame.appendChild(iframe);
  });
});

/* ---------- Cross-page anchors (catalog.html → index.html#partners) ---------- */
// Land on the requested section straight away instead of at the hero. Done twice: once now,
// and again after fonts/images settle, because lazy media above the target shifts it down.
const deepTarget = window.__deepLink ? document.querySelector(window.__deepLink) : null;
function jumpToDeepTarget() {
  if (!deepTarget) return;
  ScrollTrigger.refresh();
  if (lenis) lenis.scrollTo(deepTarget, { immediate: true, force: true });
  else deepTarget.scrollIntoView({ behavior: 'auto' });
}
if (deepTarget) {
  jumpToDeepTarget();
  window.addEventListener('load', () => requestAnimationFrame(jumpToDeepTarget));
}

/* ---------- Finalize ---------- */
document.fonts.ready.then(() => {
  ScrollTrigger.refresh();
  jumpToDeepTarget();
});
ScrollTrigger.refresh();

/* ---------- Interaction lock ---------- */
// The CSS half of this lives at the bottom of styles.css. These two are the parts CSS
// cannot cover, and both are deliberately narrow so nothing draggable or typable breaks.

// Safari on iOS has ignored the viewport's user-scalable=no since iOS 10, so pinch-zoom
// has to be refused at the gesture events themselves. Only pinch fires these — taps,
// scrolls and the gallery's own pointer drags are untouched.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
});

// -webkit-user-drag is WebKit-only, so refuse image drags directly for everything else.
// Scoped to images: the dome gallery drags a container, not an <img>, so it still spins.
document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});
