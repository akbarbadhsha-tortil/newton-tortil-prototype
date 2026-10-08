/* =====================================================================
   Newton Cinema - Contact page (local clone) - page scripts

   The Webflow runtime (jQuery + webflow.js IX2) is loaded before this file
   from assets/js/vendor and drives the original interactions: menu overlay,
   menu button morph, scroll-in reveals, map pin hovers, footer reveal.

   This file holds:
     1. The page's own custom code, copied from the live site
        (motion preference, Lenis smooth scroll, nav scrim, skip link).
     2. Local stand-ins for behaviour that depends on remote services:
        - Finsweet "modal" component (location contact popups)
        - Webflow form submission (blocked - nothing leaves the browser)
   ===================================================================== */

/* ---- 1a. a11y: single source of truth for the visitor's motion preference ---- */
window.NC_REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---- 1b. Lenis smooth scroll (same settings as live site) ---- */
window.addEventListener('load', function () {
  if (typeof Lenis === 'undefined') return;
  if (window.NC_REDUCED_MOTION) return;
  var lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  window.lenis = lenis;
});

/* ---- 1c. nav gradient: show on scroll, hide at top ---- */
document.addEventListener('DOMContentLoaded', function () {
  var nav = document.querySelector('.c-nav');
  if (!nav || nav.querySelector('.nc-nav-scrim')) return;

  var scrim = document.createElement('div');
  scrim.className = 'nc-nav-scrim';
  nav.insertBefore(scrim, nav.firstChild);

  var on = false, ticking = false;
  function update() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var want = y > 8;
    if (want !== on) { on = want; nav.classList.toggle('nc-scrolled', on); }
    ticking = false;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  update();
});

/* ---- 1d. a11y: keyboard skip link (WCAG 2.4.1) ---- */
document.addEventListener('DOMContentLoaded', function () {
  if (document.querySelector('.nc-skip')) return;
  var main = document.querySelector('main') || document.querySelectorAll('section')[0];
  if (!main) return;
  if (!main.id) main.id = 'nc-main';
  main.setAttribute('tabindex', '-1');
  var skip = document.createElement('a');
  skip.className = 'nc-skip';
  skip.href = '#' + main.id;
  skip.textContent = 'Skip to main content';
  document.body.insertBefore(skip, document.body.firstChild);
});

/* ---- 2a. Location contact popups (replaces Finsweet modal component) ----
   Each .popup_component holds a trigger ([aria-roledescription=open-modal-trigger])
   and its own .popup_window. Live behaviour: window fades in/out over ~200ms
   (opacity on .popup_window, display:flex), closes via the round close button,
   a click on the backdrop cover, or Escape; first field receives focus. */
document.addEventListener('DOMContentLoaded', function () {
  var FADE_MS = 200;
  var openWin = null;
  var lastTrigger = null;

  function triggerFor(win) {
    var comp = win.closest('.popup_component');
    return comp && comp.querySelector('[aria-roledescription="open-modal-trigger"]');
  }

  function open(win, trigger) {
    if (openWin) close(openWin, true);
    openWin = win;
    lastTrigger = trigger;
    win.style.display = 'flex';
    win.style.opacity = '0';
    win.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    void win.offsetWidth; // commit start state before fading
    win.style.opacity = '1';
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      var first = win.querySelector('form input:not([type=hidden]):not([type=submit]), form textarea');
      if (first && win.style.display === 'flex') first.focus({ preventScroll: true });
    }, FADE_MS);
  }

  function close(win, instant) {
    var trigger = triggerFor(win);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (openWin === win) openWin = null;
    function hide() { win.style.display = ''; win.style.opacity = ''; win.style.transition = ''; }
    if (instant) { hide(); return; }
    win.style.opacity = '0';
    setTimeout(function () { if (openWin !== win) hide(); }, FADE_MS);
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var trigger = t.closest('[aria-roledescription="open-modal-trigger"]');
    if (trigger) {
      e.preventDefault(); // trigger wraps <a href="#">; don't jump to top
      var win = trigger.closest('.popup_component').querySelector('.popup_window');
      if (win) open(win, trigger);
      return;
    }
    if (!openWin) return;
    if (t.closest('.fs_modal-1_close') || t.classList.contains('fs_modal-1_cover')) {
      e.preventDefault();
      close(openWin);
    }
  });

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('[aria-roledescription="open-modal-trigger"], .fs_modal-1_close')) {
      e.preventDefault();
      t.click();
      return;
    }
    if (e.key === 'Escape' && openWin) close(openWin);
  });
});

/* ---- 2b. Forms: block network submission, show the form's own success state ----
   Webflow's runtime would POST to webflow.com/api/v1/form/<site>. This clone
   never sends data; a capture-phase listener stops the event before Webflow's
   delegated handler sees it, then mimics the live success UI. */
window.addEventListener('submit', function (e) {
  var form = e.target;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (!form.checkValidity()) { form.reportValidity(); return; }

  var btn = form.querySelector('[type=submit]');
  var label = btn && btn.value;
  if (btn && btn.dataset.wait) btn.value = btn.dataset.wait;

  setTimeout(function () {
    var block = form.closest('.w-form');
    var done = block && block.querySelector('.w-form-done');
    if (btn) btn.value = label;
    form.reset();
    if (done) { form.style.display = 'none'; done.style.display = 'block'; }
    console.info('[prototype] Form submission blocked - no data was sent.');
  }, 600);
}, true);
