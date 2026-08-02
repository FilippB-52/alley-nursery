/* Vanilla port of the React Bits <DomeGallery /> component.
   Same CSS (dome-gallery.css) and behaviour: a draggable 3D sphere of image tiles
   with inertia and click-to-enlarge. Drag replaces @use-gesture with pointer events. */
(function () {
  const DEFAULTS = {
    images: [],
    fit: 0.5,
    fitBasis: 'auto',
    minRadius: 600,
    maxRadius: Infinity,
    padFactor: 0.25,
    overlayBlurColor: '#120F17',
    maxVerticalRotationDeg: 5,
    dragSensitivity: 20,
    enlargeTransitionMs: 300,
    segments: 35,
    dragDampening: 2,
    openedImageWidth: '400px',
    openedImageHeight: '400px',
    imageBorderRadius: '30px',
    openedImageBorderRadius: '30px',
    grayscale: true
  };

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const normalizeAngle = d => ((d % 360) + 360) % 360;
  const wrapAngleSigned = deg => {
    const a = (((deg + 180) % 360) + 360) % 360;
    return a - 180;
  };
  const getDataNumber = (el, name, fallback) => {
    const attr = el.dataset[name] ?? el.getAttribute(`data-${name}`);
    const n = attr == null ? NaN : parseFloat(attr);
    return Number.isFinite(n) ? n : fallback;
  };

  function buildItems(pool, seg) {
    const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
    const evenYs = [-4, -2, 0, 2, 4];
    const oddYs = [-3, -1, 1, 3, 5];
    const coords = xCols.flatMap((x, c) => {
      const ys = c % 2 === 0 ? evenYs : oddYs;
      return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
    });
    const totalSlots = coords.length;
    if (pool.length === 0) return coords.map(c => ({ ...c, src: '', alt: '' }));
    const normalizedImages = pool.map(image =>
      typeof image === 'string' ? { src: image, alt: '' } : { src: image.src || '', alt: image.alt || '' }
    );
    const usedImages = Array.from({ length: totalSlots }, (_, i) => normalizedImages[i % normalizedImages.length]);
    for (let i = 1; i < usedImages.length; i++) {
      if (usedImages[i].src === usedImages[i - 1].src) {
        for (let j = i + 1; j < usedImages.length; j++) {
          if (usedImages[j].src !== usedImages[i].src) {
            const tmp = usedImages[i];
            usedImages[i] = usedImages[j];
            usedImages[j] = tmp;
            break;
          }
        }
      }
    }
    return coords.map((c, i) => ({ ...c, src: usedImages[i].src, alt: usedImages[i].alt }));
  }

  function computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments) {
    const unit = 360 / segments / 2;
    const rotateY = unit * (offsetX + (sizeX - 1) / 2);
    const rotateX = unit * (offsetY - (sizeY - 1) / 2);
    return { rotateX, rotateY };
  }

  window.initDomeGallery = function initDomeGallery(root, options) {
    if (!root) return;
    const cfg = Object.assign({}, DEFAULTS, options || {});
    const {
      fit, fitBasis, minRadius, maxRadius, padFactor, overlayBlurColor,
      maxVerticalRotationDeg, dragSensitivity, enlargeTransitionMs, segments,
      dragDampening, openedImageWidth, openedImageHeight, imageBorderRadius,
      openedImageBorderRadius, grayscale
    } = cfg;

    const items = buildItems(cfg.images, segments);

    /* ---- build DOM ---- */
    root.classList.add('sphere-root');
    root.style.setProperty('--segments-x', segments);
    root.style.setProperty('--segments-y', segments);
    root.style.setProperty('--overlay-blur-color', overlayBlurColor);
    root.style.setProperty('--tile-radius', imageBorderRadius);
    root.style.setProperty('--enlarge-radius', openedImageBorderRadius);
    root.style.setProperty('--image-filter', grayscale ? 'grayscale(1)' : 'none');

    const main = document.createElement('main');
    main.className = 'sphere-main';
    const stage = document.createElement('div');
    stage.className = 'stage';
    const sphere = document.createElement('div');
    sphere.className = 'sphere';
    stage.appendChild(sphere);
    main.appendChild(stage);

    items.forEach((it, i) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.dataset.src = it.src;
      item.dataset.offsetX = it.x;
      item.dataset.offsetY = it.y;
      item.dataset.sizeX = it.sizeX;
      item.dataset.sizeY = it.sizeY;
      item.style.setProperty('--offset-x', it.x);
      item.style.setProperty('--offset-y', it.y);
      item.style.setProperty('--item-size-x', it.sizeX);
      item.style.setProperty('--item-size-y', it.sizeY);
      const imageDiv = document.createElement('div');
      imageDiv.className = 'item__image';
      imageDiv.setAttribute('role', 'button');
      imageDiv.tabIndex = 0;
      imageDiv.setAttribute('aria-label', it.alt || 'Открыть изображение');
      const img = document.createElement('img');
      img.src = it.src;
      img.draggable = false;
      img.alt = it.alt || '';
      img.loading = 'lazy';
      imageDiv.appendChild(img);
      item.appendChild(imageDiv);
      sphere.appendChild(item);
      imageDiv.addEventListener('click', onTileClick);
      imageDiv.addEventListener('pointerup', onTilePointerUp);
    });

    main.insertAdjacentHTML(
      'beforeend',
      '<div class="overlay"></div><div class="overlay overlay--blur"></div>' +
        '<div class="edge-fade edge-fade--top"></div><div class="edge-fade edge-fade--bottom"></div>'
    );
    const viewer = document.createElement('div');
    viewer.className = 'viewer';
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const frame = document.createElement('div');
    frame.className = 'frame';
    viewer.appendChild(scrim);
    viewer.appendChild(frame);
    main.appendChild(viewer);
    root.appendChild(main);

    /* ---- state ---- */
    let rotation = { x: 0, y: 0 };
    let startRot = { x: 0, y: 0 };
    let startPos = null;
    let dragging = false;
    let moved = false;
    let inertiaRAF = null;
    let opening = false;
    let openStartedAt = 0;
    let lastDragEndAt = 0;
    let focusedEl = null;
    let originalTilePosition = null;
    let scrollLocked = false;
    let lockedRadius = null;
    let velX = 0, velY = 0, lastMoveT = 0, lastMoveX = 0, lastMoveY = 0;

    const applyTransform = (xDeg, yDeg) => {
      sphere.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
    };

    const lockScroll = () => {
      if (scrollLocked) return;
      scrollLocked = true;
      document.body.classList.add('dg-scroll-lock');
      if (window.__lenis) window.__lenis.stop();
    };
    const unlockScroll = () => {
      if (!scrollLocked) return;
      if (root.getAttribute('data-enlarging') === 'true') return;
      scrollLocked = false;
      document.body.classList.remove('dg-scroll-lock');
      if (window.__lenis) window.__lenis.start();
    };

    /* ---- sizing ---- */
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width), h = Math.max(1, cr.height);
      const minDim = Math.min(w, h), maxDim = Math.max(w, h), aspect = w / h;
      let basis;
      switch (fitBasis) {
        case 'min': basis = minDim; break;
        case 'max': basis = maxDim; break;
        case 'width': basis = w; break;
        case 'height': basis = h; break;
        default: basis = aspect >= 1.3 ? w : minDim;
      }
      let radius = basis * fit;
      radius = Math.min(radius, h * 1.35);
      radius = clamp(radius, minRadius, maxRadius);
      lockedRadius = Math.round(radius);
      const viewerPad = Math.max(8, Math.round(minDim * padFactor));
      root.style.setProperty('--radius', `${lockedRadius}px`);
      root.style.setProperty('--viewer-pad', `${viewerPad}px`);
      root.style.setProperty('--overlay-blur-color', overlayBlurColor);
      root.style.setProperty('--tile-radius', imageBorderRadius);
      root.style.setProperty('--enlarge-radius', openedImageBorderRadius);
      root.style.setProperty('--image-filter', grayscale ? 'grayscale(1)' : 'none');
      applyTransform(rotation.x, rotation.y);

      const enlargedOverlay = viewer.querySelector('.enlarge');
      if (enlargedOverlay && frame && main) {
        const frameR = frame.getBoundingClientRect();
        const mainR = main.getBoundingClientRect();
        if (openedImageWidth && openedImageHeight) {
          const tempDiv = document.createElement('div');
          tempDiv.style.cssText = `position:absolute;width:${openedImageWidth};height:${openedImageHeight};visibility:hidden;`;
          document.body.appendChild(tempDiv);
          const tempRect = tempDiv.getBoundingClientRect();
          document.body.removeChild(tempDiv);
          enlargedOverlay.style.left = `${frameR.left - mainR.left + (frameR.width - tempRect.width) / 2}px`;
          enlargedOverlay.style.top = `${frameR.top - mainR.top + (frameR.height - tempRect.height) / 2}px`;
        } else {
          enlargedOverlay.style.left = `${frameR.left - mainR.left}px`;
          enlargedOverlay.style.top = `${frameR.top - mainR.top}px`;
          enlargedOverlay.style.width = `${frameR.width}px`;
          enlargedOverlay.style.height = `${frameR.height}px`;
        }
      }
    });
    ro.observe(root);
    applyTransform(0, 0);

    /* ---- inertia ---- */
    const stopInertia = () => {
      if (inertiaRAF) { cancelAnimationFrame(inertiaRAF); inertiaRAF = null; }
    };
    const startInertia = (vx, vy) => {
      const MAX_V = 1.4;
      let vX = clamp(vx, -MAX_V, MAX_V) * 80;
      let vY = clamp(vy, -MAX_V, MAX_V) * 80;
      let frames = 0;
      const d = clamp(dragDampening ?? 0.6, 0, 1);
      const frictionMul = 0.94 + 0.055 * d;
      const stopThreshold = 0.015 - 0.01 * d;
      const maxFrames = Math.round(90 + 270 * d);
      const step = () => {
        vX *= frictionMul;
        vY *= frictionMul;
        if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) { inertiaRAF = null; return; }
        if (++frames > maxFrames) { inertiaRAF = null; return; }
        const nextX = clamp(rotation.x - vY / 200, -maxVerticalRotationDeg, maxVerticalRotationDeg);
        const nextY = wrapAngleSigned(rotation.y + vX / 200);
        rotation = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        inertiaRAF = requestAnimationFrame(step);
      };
      stopInertia();
      inertiaRAF = requestAnimationFrame(step);
    };

    /* ---- drag (pointer events) ---- */
    const onPointerDown = e => {
      if (focusedEl) return;
      stopInertia();
      dragging = true;
      moved = false;
      startRot = { ...rotation };
      startPos = { x: e.clientX, y: e.clientY };
      velX = velY = 0;
      lastMoveT = performance.now();
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
    };
    const onPointerMove = e => {
      if (focusedEl || !dragging || !startPos) return;
      const dxTotal = e.clientX - startPos.x;
      const dyTotal = e.clientY - startPos.y;
      if (!moved && dxTotal * dxTotal + dyTotal * dyTotal > 16) moved = true;
      const nextX = clamp(startRot.x - dyTotal / dragSensitivity, -maxVerticalRotationDeg, maxVerticalRotationDeg);
      const nextY = wrapAngleSigned(startRot.y + dxTotal / dragSensitivity);
      if (rotation.x !== nextX || rotation.y !== nextY) {
        rotation = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
      }
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      velX = (e.clientX - lastMoveX) / dt;
      velY = (e.clientY - lastMoveY) / dt;
      lastMoveT = now;
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(velX) > 0.005 || Math.abs(velY) > 0.005) startInertia(velX, velY);
      if (moved) lastDragEndAt = performance.now();
      moved = false;
    };
    main.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    /* ---- open / enlarge ---- */
    function openItemFromElement(el) {
      if (opening) return;
      opening = true;
      openStartedAt = performance.now();
      lockScroll();
      const parent = el.parentElement;
      focusedEl = el;
      el.setAttribute('data-focused', 'true');
      const offsetX = getDataNumber(parent, 'offsetX', 0);
      const offsetY = getDataNumber(parent, 'offsetY', 0);
      const sizeX = getDataNumber(parent, 'sizeX', 2);
      const sizeY = getDataNumber(parent, 'sizeY', 2);
      const parentRot = computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments);
      const parentY = normalizeAngle(parentRot.rotateY);
      const globalY = normalizeAngle(rotation.y);
      let rotY = -(parentY + globalY) % 360;
      if (rotY < -180) rotY += 360;
      const rotX = -parentRot.rotateX - rotation.x;
      parent.style.setProperty('--rot-y-delta', `${rotY}deg`);
      parent.style.setProperty('--rot-x-delta', `${rotX}deg`);
      const refDiv = document.createElement('div');
      refDiv.className = 'item__image item__image--reference';
      refDiv.style.opacity = '0';
      refDiv.style.transform = `rotateX(${-parentRot.rotateX}deg) rotateY(${-parentRot.rotateY}deg)`;
      parent.appendChild(refDiv);
      void refDiv.offsetHeight;
      const tileR = refDiv.getBoundingClientRect();
      const mainR = main.getBoundingClientRect();
      const frameR = frame.getBoundingClientRect();
      if (!mainR || !frameR || tileR.width <= 0 || tileR.height <= 0) {
        opening = false;
        focusedEl = null;
        parent.removeChild(refDiv);
        unlockScroll();
        return;
      }
      originalTilePosition = { left: tileR.left, top: tileR.top, width: tileR.width, height: tileR.height };
      el.style.visibility = 'hidden';
      el.style.zIndex = 0;
      const overlay = document.createElement('div');
      overlay.className = 'enlarge';
      overlay.style.position = 'absolute';
      overlay.style.left = frameR.left - mainR.left + 'px';
      overlay.style.top = frameR.top - mainR.top + 'px';
      overlay.style.width = frameR.width + 'px';
      overlay.style.height = frameR.height + 'px';
      overlay.style.opacity = '0';
      overlay.style.zIndex = '30';
      overlay.style.willChange = 'transform, opacity';
      overlay.style.transformOrigin = 'top left';
      overlay.style.transition = `transform ${enlargeTransitionMs}ms ease, opacity ${enlargeTransitionMs}ms ease`;
      const rawSrc = parent.dataset.src || el.querySelector('img')?.src || '';
      const img = document.createElement('img');
      img.src = rawSrc;
      overlay.appendChild(img);
      viewer.appendChild(overlay);
      const tx0 = tileR.left - frameR.left;
      const ty0 = tileR.top - frameR.top;
      const sx0 = tileR.width / frameR.width;
      const sy0 = tileR.height / frameR.height;
      const validSx0 = isFinite(sx0) && sx0 > 0 ? sx0 : 1;
      const validSy0 = isFinite(sy0) && sy0 > 0 ? sy0 : 1;
      overlay.style.transform = `translate(${tx0}px, ${ty0}px) scale(${validSx0}, ${validSy0})`;
      setTimeout(() => {
        if (!overlay.parentElement) return;
        overlay.style.opacity = '1';
        overlay.style.transform = 'translate(0px, 0px) scale(1, 1)';
        root.setAttribute('data-enlarging', 'true');
      }, 16);
      const wantsResize = openedImageWidth || openedImageHeight;
      if (wantsResize) {
        const onFirstEnd = ev => {
          if (ev.propertyName !== 'transform') return;
          overlay.removeEventListener('transitionend', onFirstEnd);
          const prevTransition = overlay.style.transition;
          overlay.style.transition = 'none';
          const tempWidth = openedImageWidth || `${frameR.width}px`;
          const tempHeight = openedImageHeight || `${frameR.height}px`;
          overlay.style.width = tempWidth;
          overlay.style.height = tempHeight;
          const newRect = overlay.getBoundingClientRect();
          overlay.style.width = frameR.width + 'px';
          overlay.style.height = frameR.height + 'px';
          void overlay.offsetWidth;
          overlay.style.transition = `left ${enlargeTransitionMs}ms ease, top ${enlargeTransitionMs}ms ease, width ${enlargeTransitionMs}ms ease, height ${enlargeTransitionMs}ms ease`;
          const centeredLeft = frameR.left - mainR.left + (frameR.width - newRect.width) / 2;
          const centeredTop = frameR.top - mainR.top + (frameR.height - newRect.height) / 2;
          requestAnimationFrame(() => {
            overlay.style.left = `${centeredLeft}px`;
            overlay.style.top = `${centeredTop}px`;
            overlay.style.width = tempWidth;
            overlay.style.height = tempHeight;
          });
          const cleanupSecond = () => {
            overlay.removeEventListener('transitionend', cleanupSecond);
            overlay.style.transition = prevTransition;
          };
          overlay.addEventListener('transitionend', cleanupSecond, { once: true });
        };
        overlay.addEventListener('transitionend', onFirstEnd);
      }
    }

    function closeEnlarged() {
      if (performance.now() - openStartedAt < 250) return;
      const el = focusedEl;
      if (!el) return;
      const parent = el.parentElement;
      const overlay = viewer.querySelector('.enlarge');
      if (!overlay) return;
      const refDiv = parent.querySelector('.item__image--reference');
      const originalPos = originalTilePosition;
      if (!originalPos) {
        overlay.remove();
        if (refDiv) refDiv.remove();
        parent.style.setProperty('--rot-y-delta', '0deg');
        parent.style.setProperty('--rot-x-delta', '0deg');
        el.style.visibility = '';
        el.style.zIndex = 0;
        focusedEl = null;
        root.removeAttribute('data-enlarging');
        opening = false;
        unlockScroll();
        return;
      }
      const currentRect = overlay.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const originalPosRelativeToRoot = {
        left: originalPos.left - rootRect.left,
        top: originalPos.top - rootRect.top,
        width: originalPos.width,
        height: originalPos.height
      };
      const overlayRelativeToRoot = {
        left: currentRect.left - rootRect.left,
        top: currentRect.top - rootRect.top,
        width: currentRect.width,
        height: currentRect.height
      };
      const animatingOverlay = document.createElement('div');
      animatingOverlay.className = 'enlarge-closing';
      animatingOverlay.style.cssText = `position:absolute;left:${overlayRelativeToRoot.left}px;top:${overlayRelativeToRoot.top}px;width:${overlayRelativeToRoot.width}px;height:${overlayRelativeToRoot.height}px;z-index:9999;border-radius:var(--enlarge-radius, 32px);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:all ${enlargeTransitionMs}ms ease-out;pointer-events:none;margin:0;transform:none;`;
      const originalImg = overlay.querySelector('img');
      if (originalImg) {
        const img = originalImg.cloneNode();
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        animatingOverlay.appendChild(img);
      }
      overlay.remove();
      root.appendChild(animatingOverlay);
      void animatingOverlay.getBoundingClientRect();
      requestAnimationFrame(() => {
        animatingOverlay.style.left = originalPosRelativeToRoot.left + 'px';
        animatingOverlay.style.top = originalPosRelativeToRoot.top + 'px';
        animatingOverlay.style.width = originalPosRelativeToRoot.width + 'px';
        animatingOverlay.style.height = originalPosRelativeToRoot.height + 'px';
        animatingOverlay.style.opacity = '0';
      });
      const cleanup = () => {
        animatingOverlay.remove();
        originalTilePosition = null;
        if (refDiv) refDiv.remove();
        parent.style.transition = 'none';
        el.style.transition = 'none';
        parent.style.setProperty('--rot-y-delta', '0deg');
        parent.style.setProperty('--rot-x-delta', '0deg');
        requestAnimationFrame(() => {
          el.style.visibility = '';
          el.style.opacity = '0';
          el.style.zIndex = 0;
          focusedEl = null;
          root.removeAttribute('data-enlarging');
          requestAnimationFrame(() => {
            parent.style.transition = '';
            el.style.transition = 'opacity 300ms ease-out';
            requestAnimationFrame(() => {
              el.style.opacity = '1';
              setTimeout(() => {
                el.style.transition = '';
                el.style.opacity = '';
                opening = false;
                if (!dragging && root.getAttribute('data-enlarging') !== 'true') {
                  document.body.classList.remove('dg-scroll-lock');
                  if (window.__lenis) window.__lenis.start();
                }
              }, 300);
            });
          });
        });
      };
      animatingOverlay.addEventListener('transitionend', cleanup, { once: true });
    }

    scrim.addEventListener('click', closeEnlarged);
    const onKey = e => { if (e.key === 'Escape') closeEnlarged(); };
    window.addEventListener('keydown', onKey);

    /* ---- tile activation ---- */
    function onTileClick(e) {
      if (dragging || moved) return;
      if (performance.now() - lastDragEndAt < 80) return;
      if (opening) return;
      openItemFromElement(e.currentTarget);
    }
    function onTilePointerUp(e) {
      if (e.pointerType !== 'touch') return;
      if (dragging || moved) return;
      if (performance.now() - lastDragEndAt < 80) return;
      if (opening) return;
      openItemFromElement(e.currentTarget);
    }
  };
})();
