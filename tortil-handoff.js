/* =====================================================================
   Newton Cinema -> Tortil handoff (Phase 2)

   Intercepts the four "Your Next Step" cards and shows a personalised
   trust dialog before the visitor leaves for Tortil. Nothing navigates
   until the visitor presses the primary button.

   MODE
     'demo' (default) - continue to the local simulated Tortil app in
                        ./tortil/ (clearly labelled DEMO, sends nothing).
     'live'           - continue to app.tortil.com using Tortil's verified
                        register/new?redirect=&partner= mechanism. The
                        per-intent Tortil routes are PROPOSED and not live
                        yet, so live mode uses each intent's fallback path.
                        Details are in the project handoff docs.
   ===================================================================== */
(function () {
  'use strict';

  var HANDOFF = {
    mode: 'demo',
    demoEntry: 'tortil/index.html#/start',
    live: {
      register: 'https://app.tortil.com/register/new',
      partner: 'newton',
      // proposed: Tortil route per intent; confirmed:false until Tortil ships it
      routes: {
        new_project: { proposed: '/p/newton/apply/new_project', confirmed: false, fallback: '/projects' },
        cast:        { proposed: '/p/newton/apply/cast',        confirmed: false, fallback: '/p/campaigns/artreg' },
        crew:        { proposed: '/p/newton/apply/crew',        confirmed: false, fallback: '/projects' },
        career:      { proposed: '/p/newton/apply/career',      confirmed: false, fallback: '/projects' }
      }
    },
    terms: 'https://app.tortil.com/legal/tos',
    privacy: 'https://app.tortil.com/legal/privacy'
  };

  // Card order on the page -> intent. Allowlist: anything else is rejected.
  var INTENTS = ['new_project', 'cast', 'crew', 'career'];

  var COPY = {
    new_project: {
      label: 'Start a New Project',
      headline: 'Bring your story to Newton Cinema',
      body: 'Have a story, screenplay, or film project you’d like Newton Cinema to consider? We use Tortil to collect and manage project submissions. Create an account or sign in to share your idea with our team.',
      formStep: 'Continue to the project submission form.',
      cta: 'Continue to Project Submission'
    },
    cast: {
      label: 'Join as Cast',
      headline: 'Your next role could start here',
      body: 'Interested in acting opportunities with Newton Cinema? We use Tortil to organize cast profiles and applications. Create an account or sign in to share your experience, skills, and portfolio for relevant opportunities.',
      formStep: 'Continue to your cast profile form.',
      cta: 'Create Your Cast Profile'
    },
    crew: {
      label: 'Join as Crew',
      headline: 'Help bring great stories to life',
      body: 'Join the filmmaking professionals who support Newton Cinema productions. We use Tortil to organize crew profiles and production opportunities. Create an account or sign in to share your experience and professional skills.',
      formStep: 'Continue to your crew profile form.',
      cta: 'Create Your Crew Profile'
    },
    career: {
      label: 'Careers at Newton',
      headline: 'Build your career with Newton Cinema',
      body: 'Explore career opportunities with Newton Cinema. We use Tortil, part of our company family, to manage job applications. Create an account or sign in to submit your professional details and apply for a position.',
      formStep: 'Continue to the careers application form.',
      cta: 'Continue to Careers'
    }
  };

  // Shortened from the brief's general explanation: the card copy already says Newton uses
  // Tortil, and "keep track" was dropped because applicant status tracking isn't live yet.
  var SHARED_NOTE = 'You’ll create a Tortil account or sign in before completing your application, so your details and submission stay together and our team can manage them efficiently.';

  /* ---------------------------------------------------------- URLs */
  function destinationFor(intent) {
    if (INTENTS.indexOf(intent) === -1) return null;
    if (HANDOFF.mode === 'live') {
      var r = HANDOFF.live.routes[intent];
      var path = r.confirmed ? r.proposed : r.fallback;
      // Tortil's own gated pages double-encode the redirect path (verified).
      return HANDOFF.live.register +
        '?partner=' + encodeURIComponent(HANDOFF.live.partner) +
        '&redirect=' + encodeURIComponent(encodeURIComponent(path)) +
        '&redirectquery=';
    }
    return HANDOFF.demoEntry + '?intent=' + intent;
  }

  /* ---------------------------------------------------------- DOM */
  var dialog, panel, lastTrigger, currentIntent, closeTimer;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function build() {
    dialog = el('div', { class: 'nct-overlay', hidden: '' });
    dialog.innerHTML =
      '<div class="nct-backdrop" data-nct-close></div>' +
      '<div class="nct-panel" role="dialog" aria-modal="true" aria-labelledby="nct-title" aria-describedby="nct-body">' +
        '<button type="button" class="nct-close" data-nct-close aria-label="Close and stay on Newton Cinema">' +
          '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<div class="nct-brands" aria-hidden="true">' +
          '<img src="assets/tortil/newton-logo.svg" alt="" class="nct-brand-newton">' +
          '<span class="nct-brand-sep"></span>' +
          '<img src="assets/tortil/tortil-logo.svg" alt="" class="nct-brand-tortil">' +
        '</div>' +
        '<p class="nct-eyebrow"><span class="nct-eyebrow-num"></span><span class="nct-eyebrow-line"></span><span class="nct-eyebrow-text"></span></p>' +
        '<h2 class="nct-title" id="nct-title"></h2>' +
        '<div id="nct-body">' +
          '<p class="nct-lead"></p>' +
          '<p class="nct-note"></p>' +
        '</div>' +
        '<ol class="nct-steps" aria-label="How it works">' +
          '<li><span class="nct-step-num">1</span><span class="nct-step-title">One account</span><span class="nct-step-text">Create your Tortil account or sign in.</span></li>' +
          '<li><span class="nct-step-num">2</span><span class="nct-step-title">Your application</span><span class="nct-step-text nct-step-form"></span></li>' +
          '<li><span class="nct-step-num">3</span><span class="nct-step-title">Stay informed</span><span class="nct-step-text">View submission status and updates where supported.</span></li>' +
        '</ol>' +
        '<div class="nct-actions">' +
          '<a class="nct-btn nct-btn-primary" href="#"><span class="nct-cta"></span><span class="nct-arrow" aria-hidden="true">→</span></a>' +
          '<button type="button" class="nct-btn nct-btn-secondary" data-nct-close>Stay on Newton Cinema</button>' +
        '</div>' +
        '<p class="nct-fine">' +
          '<span class="nct-redirect">You’ll be redirected to app.tortil.com to continue.</span> ' +
          'Tortil is part of the Newton Cinema family. Your Tortil account is covered by Tortil’s ' +
          '<a href="' + HANDOFF.terms + '" target="_blank" rel="noopener">Terms<span class="nct-sr"> (opens in a new tab)</span></a> and ' +
          '<a href="' + HANDOFF.privacy + '" target="_blank" rel="noopener">Privacy Policy<span class="nct-sr"> (opens in a new tab)</span></a>.' +
        '</p>' +
        (HANDOFF.mode === 'demo'
          ? '<p class="nct-demo"><strong>Prototype</strong> · Continue opens a simulated Tortil preview. Nothing is sent to Tortil.</p>'
          : '') +
      '</div>';
    document.body.appendChild(dialog);
    panel = dialog.querySelector('.nct-panel');

    dialog.addEventListener('click', function (e) {
      if (e.target.closest('[data-nct-close]')) { e.preventDefault(); close(); }
    });
    dialog.querySelector('.nct-btn-primary').addEventListener('click', function (e) {
      var url = destinationFor(currentIntent);
      if (!url) { e.preventDefault(); close(); return; }
      this.setAttribute('href', url); // navigation only on explicit click
    });
    dialog.addEventListener('keydown', onKeydown);
  }

  function fill(intent, index) {
    var c = COPY[intent];
    dialog.querySelector('.nct-eyebrow-num').textContent = ('0' + (index + 1)).slice(-2);
    dialog.querySelector('.nct-eyebrow-text').textContent = c.label;
    dialog.querySelector('.nct-title').textContent = c.headline;
    dialog.querySelector('.nct-lead').textContent = c.body;
    dialog.querySelector('.nct-note').textContent = SHARED_NOTE;
    dialog.querySelector('.nct-step-form').textContent = c.formStep;
    dialog.querySelector('.nct-cta').textContent = c.cta;
    var primary = dialog.querySelector('.nct-btn-primary');
    primary.setAttribute('href', destinationFor(intent));
    primary.dataset.intent = intent;
  }

  /* ---------------------------------------------------------- open/close */
  var inerted = [];

  function setInert(on) {
    if (on) {
      inerted = Array.prototype.filter.call(document.body.children, function (n) {
        return n !== dialog && n.tagName !== 'SCRIPT' && !n.hasAttribute('inert');
      });
      inerted.forEach(function (n) { n.setAttribute('inert', ''); });
    } else {
      inerted.forEach(function (n) { n.removeAttribute('inert'); });
      inerted = [];
    }
  }

  function open(intent, index, trigger) {
    if (!dialog) build();
    clearTimeout(closeTimer);
    currentIntent = intent;
    lastTrigger = trigger;
    fill(intent, index);
    dialog.hidden = false;
    void dialog.offsetWidth;
    dialog.classList.add('is-open');
    setInert(true);
    if (window.lenis) window.lenis.stop();
    document.documentElement.classList.add('nct-lock');
    dialog.querySelector('.nct-btn-primary').focus();
  }

  function close() {
    if (!dialog || dialog.hidden) return;
    dialog.classList.remove('is-open');
    setInert(false);
    if (window.lenis) window.lenis.start();
    document.documentElement.classList.remove('nct-lock');
    closeTimer = setTimeout(function () { dialog.hidden = true; }, window.NC_REDUCED_MOTION ? 0 : 220);
    if (lastTrigger) lastTrigger.focus({ preventScroll: true });
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = panel.querySelectorAll('a[href], button:not([disabled])');
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------------------------------------------------------- wire cards */
  document.addEventListener('DOMContentLoaded', function () {
    var cards = document.querySelectorAll('.nc-paths .nc-path');
    Array.prototype.forEach.call(cards, function (card, i) {
      var intent = INTENTS[i];
      if (!intent) return;
      card.dataset.intent = intent;
      card.setAttribute('href', destinationFor(intent)); // no-JS fallback
      card.setAttribute('aria-haspopup', 'dialog');
      card.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let new-tab gestures through
        e.preventDefault();
        open(intent, i, card);
      });
    });
  });

  window.NCTortilHandoff = { config: HANDOFF, destinationFor: destinationFor, open: function (intent) {
    var i = INTENTS.indexOf(intent);
    var card = document.querySelectorAll('.nc-paths .nc-path')[i];
    if (i > -1) open(intent, i, card);
  } };
})();
