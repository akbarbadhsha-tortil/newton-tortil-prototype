/* =====================================================================
   Tortil - DEMO MODE prototype (Phase 2)

   Simulates the Tortil side of the Newton Cinema handoff:
     #/start?intent=<id>  transition from Newton, stores pending intent
     #/register           sign-up (fields mirror app.tortil.com/register/new)
     #/verify             email OTP step (demo code shown on screen)
     #/login              existing account holders
     #/apply/<intent>     multi-step application form (forms.js)
     #/done/<intent>      confirmation with demo reference
     #/choose             recovery when the intent was lost or expired

   Nothing leaves the browser. Accounts, session, drafts and submissions
   live in localStorage/sessionStorage under "tortil_demo_*" keys.
   Uploaded files are never read - only name/size/type are kept.
   ===================================================================== */
(function () {
  'use strict';

  var F = window.TORTIL_FORMS;
  var INTENTS = F.intents;
  var NEWTON_RETURN = '../index.html#your-next-step';
  var PENDING_TTL_MS = 30 * 60 * 1000;
  var DEMO_OTP = '246810';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var KEY = {
    session: 'tortil_demo_session',
    accounts: 'tortil_demo_accounts',
    pending: 'tortil_demo_pending_intent',
    signup: 'tortil_demo_pending_signup',
    last: 'tortil_demo_last_submission',
    submissions: 'tortil_demo_submissions',
    draft: function (email, intent) { return 'tortil_demo_draft:' + email + ':' + intent; }
  };

  /* ------------------------------------------------------------ storage */
  function read(storage, k) { try { var v = storage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(storage, k, v) { try { storage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function drop(storage, k) { try { storage.removeItem(k); } catch (e) {} }
  var LS = window.localStorage, SS = window.sessionStorage;

  function session() { return read(SS, KEY.session); }
  function accounts() { return read(LS, KEY.accounts) || {}; }

  function setPending(intent) { write(SS, KEY.pending, { intent: intent, source: 'newton_contact', at: Date.now() }); }
  function takePending() {
    var p = read(SS, KEY.pending);
    drop(SS, KEY.pending);
    if (!p || INTENTS.indexOf(p.intent) === -1) return { intent: null, reason: 'lost' };
    if (Date.now() - p.at > PENDING_TTL_MS) return { intent: null, reason: 'expired' };
    return { intent: p.intent };
  }
  function peekPending() { var p = read(SS, KEY.pending); return p && INTENTS.indexOf(p.intent) > -1 ? p.intent : null; }

  /* ------------------------------------------------------------ helpers */
  var app = document.getElementById('app');
  var chrome = document.getElementById('t-chrome');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function words(s) { s = (s || '').trim(); return s ? s.split(/\s+/).length : 0; }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function maskEmail(e) { var p = e.split('@'); return p[0].slice(0, 1) + '•••@' + p[1]; }
  function go(path) { if (location.hash === '#' + path) route(); else location.hash = path; }

  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var i = h.indexOf('?');
    var path = i > -1 ? h.slice(0, i) : h;
    return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(i > -1 ? h.slice(i + 1) : '') };
  }

  function render(html, opts) {
    opts = opts || {};
    chrome.hidden = !!opts.bare;
    document.body.classList.toggle('t-is-auth', !!opts.bare);
    app.innerHTML = html;
    window.scrollTo(0, 0);
    var target = app.querySelector('[data-autofocus]') || app.querySelector('h1');
    if (target) { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  }

  function updateChrome() {
    var s = session();
    var who = document.getElementById('t-user');
    if (s) {
      who.hidden = false;
      who.querySelector('.t-user-name').textContent = s.first + ' ' + s.last;
    } else {
      who.hidden = true;
    }
  }

  function intentBadge(intent) {
    var f = F.forms[intent];
    return '<p class="t-context"><span class="t-context-from">From Newton Cinema</span>' +
      '<span class="t-context-sep" aria-hidden="true">→</span><span>' + esc(f.title) + '</span></p>';
  }

  /* ------------------------------------------------------------ router */
  function route() {
    var r = parseHash();
    var p = r.parts;
    updateChrome();
    switch (p[0]) {
      case 'start': return viewStart(r.q.get('intent'));
      case 'register': return viewRegister();
      case 'verify': return viewVerify();
      case 'login': return viewLogin();
      case 'apply': return viewApply(p[1]);
      case 'done': return viewDone(p[1]);
      case 'choose': return viewChoose(r.q.get('reason'));
      default:
        return peekPending() ? go(session() ? '/apply/' + peekPending() : '/register') : viewChoose();
    }
  }

  function afterAuth() {
    var t = takePending();
    if (t.intent) go('/apply/' + t.intent);
    else go('/choose?reason=' + t.reason);
  }

  /* ------------------------------------------------------------ #/start */
  var startTimer;
  function viewStart(intent) {
    clearTimeout(startTimer);
    if (INTENTS.indexOf(intent) === -1) return go('/choose?reason=invalid');
    setPending(intent);
    var f = F.forms[intent];
    var next = session() ? '/apply/' + intent : '/register';
    render(
      '<section class="t-transition" aria-labelledby="t-tr-title">' +
        '<div class="t-transition-brands" aria-hidden="true">' +
          '<img src="../assets/tortil/newton-logo.svg" alt="" class="t-tr-newton">' +
          '<span class="t-tr-line"><span></span></span>' +
          '<img src="../assets/tortil/tortil-logo.svg" alt="" class="t-tr-tortil">' +
        '</div>' +
        '<h1 id="t-tr-title">Taking you to Tortil</h1>' +
        '<p class="t-tr-url">app.tortil.com</p>' +
        '<div class="t-tr-card">' +
          '<p class="t-tr-label">You’re continuing</p>' +
          '<p class="t-tr-form">' + esc(f.card) + ' · ' + esc(f.title) + '</p>' +
          '<p class="t-tr-hint">' + (session()
            ? 'You’re already signed in, so we’ll take you straight to the form.'
            : 'Create a Tortil account or sign in, and we’ll take you straight to this form.') + '</p>' +
        '</div>' +
        '<a class="t-btn t-btn-primary" href="#' + next + '">Continue now</a>' +
        '<p class="t-tr-note" role="status">Continuing automatically…</p>' +
      '</section>',
      { bare: true }
    );
    startTimer = setTimeout(function () { if (parseHash().parts[0] === 'start') go(next); }, REDUCED ? 2600 : 1800);
  }

  /* ------------------------------------------------------------ auth shell */
  function authShell(inner) {
    var intent = peekPending();
    return '<div class="t-auth">' +
      '<div class="t-auth-photo" aria-hidden="true"></div>' +
      '<div class="t-auth-panel">' +
        '<div class="t-auth-brand">' +
          '<img src="../assets/tortil/tortil-logo.svg" alt="Tortil" class="t-auth-tortil">' +
          '<img src="../assets/tortil/newton-logo.svg" alt="Newton Cinema" class="t-auth-newton">' +
        '</div>' +
        '<div class="t-auth-body">' + (intent ? intentBadge(intent) : '') + inner + '</div>' +
      '</div>' +
    '</div>';
  }

  function authField(id, label, type, attrs) {
    return '<div class="t-afield"><label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" name="' + id + '" type="' + type + '" ' + (attrs || '') + ' aria-describedby="' + id + '-err">' +
      '<p class="t-err" id="' + id + '-err"></p></div>';
  }

  function setErr(form, id, msg) {
    var input = form.querySelector('#' + id);
    var err = form.querySelector('#' + id + '-err');
    if (err) err.textContent = msg || '';
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    return !msg;
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ------------------------------------------------------------ #/register */
  function viewRegister() {
    if (session()) return afterAuth();
    render(authShell(
      '<h1>Sign Up</h1><p class="t-auth-sub">Please enter your details</p>' +
      '<form class="t-auth-form" novalidate>' +
        '<div class="t-arow">' + authField('first', 'First Name', 'text', 'autocomplete="given-name" placeholder="firstname"') +
        authField('last', 'Last Name', 'text', 'autocomplete="family-name" placeholder="lastname"') + '</div>' +
        authField('email', 'Email', 'email', 'autocomplete="email" placeholder="you@email.com"') +
        '<div class="t-afield"><label for="phone">Phone Number</label><div class="t-phone">' +
          '<select id="dial" aria-label="Country code"><option value="+91">🇮🇳 +91</option><option value="+94">🇱🇰 +94</option><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option><option value="+971">🇦🇪 +971</option></select>' +
          '<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="phone number" aria-describedby="phone-err"></div>' +
          '<p class="t-err" id="phone-err"></p></div>' +
        authField('password', 'Password', 'password', 'autocomplete="new-password" placeholder="password"') +
        authField('password2', 'Re-type Password', 'password', 'autocomplete="new-password" placeholder="confirm password"') +
        '<button class="t-btn t-btn-primary t-btn-block" type="submit">Continue</button>' +
        '<button class="t-btn t-btn-ghost t-btn-block t-demo-fill" type="button">Fill with demo details</button>' +
      '</form>' +
      '<p class="t-auth-legal">By continuing, you agree to Tortil’s <a href="https://app.tortil.com/legal/tos" target="_blank" rel="noopener">Terms</a>, <a href="https://app.tortil.com/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a>, and <a href="https://app.tortil.com/legal/cookie" target="_blank" rel="noopener">Cookie Policy</a>.</p>' +
      '<p class="t-auth-switch">Already have an account? <a href="#/login">Log in</a></p>'
    ), { bare: true });

    var form = app.querySelector('form');
    form.querySelector('.t-demo-fill').addEventListener('click', function () {
      form.first.value = 'Asha'; form.last.value = 'Menon';
      form.email.value = 'asha.menon@example.test'; form.phone.value = '9876543210';
      form.password.value = form.password2.value = 'demo-pass-123';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      ok = setErr(form, 'first', form.first.value.trim() ? '' : 'Enter your first name.') && ok;
      ok = setErr(form, 'last', form.last.value.trim() ? '' : 'Enter your last name.') && ok;
      ok = setErr(form, 'email', EMAIL_RE.test(form.email.value.trim()) ? '' : 'Enter a valid email address, like name@example.com.') && ok;
      var digits = form.phone.value.replace(/\D/g, '');
      ok = setErr(form, 'phone', digits.length >= 6 && digits.length <= 15 ? '' : 'Enter a valid phone number.') && ok;
      ok = setErr(form, 'password', form.password.value.length >= 8 ? '' : 'Use at least 8 characters.') && ok;
      ok = setErr(form, 'password2', !form.password2.value ? 'Re-type your password.' : form.password2.value === form.password.value ? '' : 'Passwords don’t match.') && ok;
      var email = form.email.value.trim().toLowerCase();
      if (ok && accounts()[email]) {
        ok = setErr(form, 'email', 'An account with this email already exists. Log in instead.');
      }
      if (!ok) { var bad = form.querySelector('[aria-invalid]'); if (bad) bad.focus(); return; }
      write(SS, KEY.signup, {
        first: form.first.value.trim(), last: form.last.value.trim(), email: email,
        phone: form.dial.value + ' ' + digits
      });
      go('/verify');
    });
  }

  /* ------------------------------------------------------------ #/verify */
  function viewVerify() {
    var pending = read(SS, KEY.signup);
    if (!pending) return go('/register');
    render(authShell(
      '<h1>Verify your email</h1>' +
      '<p class="t-auth-sub">Enter the 6-digit code sent to <strong>' + esc(maskEmail(pending.email)) + '</strong>.</p>' +
      '<p class="t-demo-hint"><strong>Demo</strong> · No email is sent. Use code <code>' + DEMO_OTP + '</code>.</p>' +
      '<form class="t-auth-form" novalidate>' +
        authField('otp', 'Verification code', 'text', 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="t-otp" data-autofocus') +
        '<button class="t-btn t-btn-primary t-btn-block" type="submit">Verify and continue</button>' +
      '</form>' +
      '<p class="t-auth-switch"><button type="button" class="t-link t-resend">Resend code</button> · <a href="#/register">Use a different email</a></p>' +
      '<p class="t-auth-status" role="status"></p>'
    ), { bare: true });
    var form = app.querySelector('form');
    app.querySelector('.t-resend').addEventListener('click', function () {
      app.querySelector('.t-auth-status').textContent = 'Demo: a new code would be sent. Use ' + DEMO_OTP + '.';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = form.otp.value.replace(/\D/g, '');
      if (v.length !== 6) { setErr(form, 'otp', 'Enter the 6-digit code.'); form.otp.focus(); return; }
      if (v !== DEMO_OTP) { setErr(form, 'otp', 'That code isn’t right. Check the code and try again.'); form.otp.focus(); return; }
      var all = accounts();
      var acct = { first: pending.first, last: pending.last, email: pending.email, phone: pending.phone, id: 'demo-' + Date.now().toString(36) };
      all[acct.email] = acct;
      write(LS, KEY.accounts, all);
      drop(SS, KEY.signup);
      write(SS, KEY.session, acct);
      afterAuth();
    });
  }

  /* ------------------------------------------------------------ #/login */
  function viewLogin() {
    if (session()) return afterAuth();
    render(authShell(
      '<h1>Login</h1><p class="t-auth-sub">Please enter your details</p>' +
      '<form class="t-auth-form" novalidate>' +
        authField('email', 'Email', 'email', 'autocomplete="email" placeholder="you@email.com"') +
        authField('password', 'Password', 'password', 'autocomplete="current-password" placeholder="password"') +
        '<button class="t-btn t-btn-primary t-btn-block" type="submit">Login</button>' +
        '<button class="t-btn t-btn-ghost t-btn-block t-demo-login" type="button">Use demo account</button>' +
      '</form>' +
      '<p class="t-auth-switch">New to Tortil? <a href="#/register">Create New Account</a></p>'
    ), { bare: true });
    var form = app.querySelector('form');
    form.querySelector('.t-demo-login').addEventListener('click', function () {
      var acct = { first: 'Asha', last: 'Menon', email: 'asha.menon@example.test', phone: '+91 9876543210', id: 'demo-account' };
      var all = accounts(); all[acct.email] = all[acct.email] || acct; write(LS, KEY.accounts, all);
      write(SS, KEY.session, all[acct.email]);
      afterAuth();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim().toLowerCase();
      var ok = setErr(form, 'email', EMAIL_RE.test(email) ? '' : 'Enter a valid email address.');
      ok = setErr(form, 'password', form.password.value ? '' : 'Enter your password.') && ok;
      if (ok && !accounts()[email]) ok = setErr(form, 'email', 'We couldn’t find a demo account with this email. Sign up first, or use the demo account.');
      if (!ok) { form.querySelector('[aria-invalid]').focus(); return; }
      write(SS, KEY.session, accounts()[email]);
      afterAuth();
    });
  }

  /* ------------------------------------------------------------ #/choose */
  function viewChoose(reason) {
    var msg = {
      lost: 'We couldn’t tell which application you were starting. Choose one to continue.',
      expired: 'Your session took a while, so we didn’t keep your selection. Choose the application to continue.',
      invalid: 'That link didn’t include a valid application. Choose one to continue.'
    }[reason] || 'Choose the application you’d like to start.';
    render(
      '<section class="t-page t-narrow">' +
        '<p class="t-eyebrow">Newton Cinema · Applications</p>' +
        '<h1>Which application were you starting?</h1>' +
        '<p class="t-lead"' + (reason ? ' role="status"' : '') + '>' + esc(msg) + '</p>' +
        '<ul class="t-choose">' + INTENTS.map(function (id) {
          var f = F.forms[id];
          return '<li><a href="#/start?intent=' + id + '"><span class="t-choose-num">' + f.card + '</span>' +
            '<span class="t-choose-body"><span class="t-choose-title">' + esc(f.title) + '</span>' +
            '<span class="t-choose-desc">' + esc(f.cardLabel) + '</span></span><span aria-hidden="true">→</span></a></li>';
        }).join('') + '</ul>' +
        '<p><a class="t-link" href="' + NEWTON_RETURN + '">← Return to Newton Cinema</a></p>' +
      '</section>'
    );
  }

  /* ================================================================
     APPLICATION WIZARD
     ================================================================ */
  var W = null; // current wizard state

  function cond(c, v) {
    if (!c) return true;
    if (c.any) return c.any.some(function (x) { return cond(x, v); });
    var val = v[c.field];
    var arr = Array.isArray(val) ? val : [val == null ? '' : val];
    if (c.in) return arr.some(function (x) { return c.in.indexOf(x) > -1; });
    if (c.notIn) return arr.length > 0 && !arr.some(function (x) { return c.notIn.indexOf(x) > -1; });
    if (c.filled) return arr.some(function (x) { return x !== ''; });
    return true;
  }
  function visibleSteps() { return W.form.steps.filter(function (s) { return cond(s.showIf, W.values); }); }
  function isVisible(f) { return cond(f.showIf, W.values); }
  function isRequired(f) { return !!f.required || (f.requiredIf ? cond(f.requiredIf, W.values) : false); }
  function optionsFor(f) {
    var list = f.optionsBy ? (f.optionsBy.map[W.values[f.optionsBy.field]] || []) : (f.options || []);
    return f.other && (list.length || !f.optionsBy) ? list.concat([{ value: 'other', label: 'Other' }]) : list;
  }
  function optLabel(f, value) {
    if (value === 'other') return W.values[f.name + '__other'] || 'Other';
    var all = f.optionsBy ? [].concat.apply([], Object.keys(f.optionsBy.map).map(function (k) { return f.optionsBy.map[k]; })) : (f.options || []);
    var o = all.filter(function (x) { return x.value === value; })[0];
    return o ? o.label : value;
  }

  /* ---------------- drafts */
  var saveTimer;
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var files = {};
      Object.keys(W.files).forEach(function (k) { files[k] = W.files[k].filter(function (x) { return x.status === 'ready'; }); });
      var ok = write(LS, KEY.draft(W.account.email, W.intent), { values: W.values, files: files, step: W.step, savedAt: Date.now() });
      var s = app.querySelector('.t-draft-status');
      if (s) s.textContent = ok ? 'Draft saved in this browser' : 'Draft couldn’t be saved in this browser';
    }, 400);
  }

  function viewApply(intent) {
    if (INTENTS.indexOf(intent) === -1) return go('/choose?reason=invalid');
    var s = session();
    if (!s) { setPending(intent); return go('/register'); }
    drop(SS, KEY.pending);
    var draft = read(LS, KEY.draft(s.email, intent));
    W = {
      intent: intent, form: F.forms[intent], account: s,
      values: draft ? draft.values : {}, files: draft ? draft.files : {},
      step: draft ? draft.step : 0, touched: {}, returnToReview: false,
      restored: draft ? draft.savedAt : null
    };
    renderWizard(true);
  }

  function stepsWithReview() { return visibleSteps().concat([{ id: 'review', title: 'Review' }]); }

  function progressHtml(steps) {
    var step = steps[W.step];
    var items = steps.map(function (st, i) {
      var state = i < W.step ? 'done' : i === W.step ? 'current' : 'todo';
      var inner = '<span class="t-prog-num">' + (state === 'done' ? '\u2713' : i + 1) + '</span><span class="t-prog-label">' + esc(st.title) + '</span>';
      return '<li class="is-' + state + '"' + (state === 'current' ? ' aria-current="step"' : '') + '>' +
        (state === 'done' ? '<button type="button" class="t-prog-btn" data-goto="' + i + '">' + inner + '<span class="t-sr"> (completed, edit)</span></button>' : '<span class="t-prog-btn">' + inner + '</span>') +
        '</li>';
    }).join('');
    return '<nav class="t-progress" aria-label="Application progress"><ol>' + items + '</ol></nav>' +
      '<div class="t-progress-mobile" aria-hidden="true"><span>Step ' + (W.step + 1) + ' of ' + steps.length + ' \u00b7 ' + esc(step.title) + '</span>' +
      '<span class="t-bar"><span style="width:' + Math.round(((W.step + 1) / steps.length) * 100) + '%"></span></span></div>';
  }

  function renderWizard(first) {
    var steps = stepsWithReview();
    if (W.step > steps.length - 1) W.step = steps.length - 1;
    var step = steps[W.step];
    var f = W.form;

    render(
      '<div class="t-page">' +
        '<header class="t-form-head">' +
          '<p class="t-eyebrow">Newton Cinema · ' + esc(f.card) + ' ' + esc(f.cardLabel) + '</p>' +
          '<h1>' + esc(f.title) + '</h1>' +
          '<p class="t-lead">' + esc(f.intro) + '</p>' +
          (W.restored && first ? '<p class="t-restored" role="status">We restored your draft from ' + new Date(W.restored).toLocaleString() + '. <button type="button" class="t-link t-start-over">Start over</button></p>' : '') +
        '</header>' +
        '<div class="t-prog-wrap">' + progressHtml(steps) + '</div>' +
        '<form class="t-step" novalidate>' +
          '<div class="t-error-summary" role="alert" tabindex="-1" hidden></div>' +
          '<h2 class="t-step-title" tabindex="-1">' + esc(step.title) + '</h2>' +
          (step.intro ? '<p class="t-step-intro">' + esc(step.intro) + '</p>' : '') +
          (step.id === 'review' ? renderReview() : '<div class="t-fields">' + step.fields.map(renderField).join('') + '</div>') +
          '<div class="t-nav">' +
            (W.step > 0 ? '<button type="button" class="t-btn t-btn-secondary t-back">Back</button>' : '<a class="t-btn t-btn-secondary" href="' + NEWTON_RETURN + '">Cancel</a>') +
            '<span class="t-draft-status" role="status" aria-live="polite"></span>' +
            (step.id === 'review'
              ? '<button type="submit" class="t-btn t-btn-primary t-submit">Submit application</button>'
              : '<button type="submit" class="t-btn t-btn-primary">' + (W.returnToReview ? 'Save and return to review' : 'Continue') + '</button>') +
          '</div>' +
        '</form>' +
      '</div>'
    );
    if (!first) { var h = app.querySelector('.t-step-title'); h.focus({ preventScroll: true }); }
    bindWizard();
    refreshStep();
  }

  /* ---------------- field rendering */
  function describedBy(f) {
    return ' aria-describedby="' + ['f-' + f.name + '-help', 'f-' + f.name + '-err', f.maxWords || f.maxLength ? 'f-' + f.name + '-count' : ''].filter(Boolean).join(' ') + '"';
  }
  function labelHtml(f, forId) {
    var req = isRequired(f);
    return '<label class="t-label" ' + (forId ? 'for="' + forId + '"' : '') + '>' + esc(f.label) +
      '<span class="t-req ' + (req ? 'is-req' : 'is-opt') + '">' + (req ? 'Required' : 'Optional') + '</span>' +
      (f.private ? '<span class="t-private">Private</span>' : '') + '</label>';
  }
  function helpHtml(f) {
    var help = [f.help, f.example].filter(Boolean).map(esc).join(' ');
    return '<p class="t-help" id="f-' + f.name + '-help">' + help + '</p>';
  }
  function otherHtml(f) {
    if (!f.other) return '';
    return '<div class="t-other" data-other-for="' + f.name + '" hidden><label class="t-sublabel" for="f-' + f.name + '__other">Please specify</label>' +
      '<input class="t-input" id="f-' + f.name + '__other" data-name="' + f.name + '__other" type="text" maxlength="120" value="' + esc(W.values[f.name + '__other'] || '') + '"></div>';
  }
  function noteHtml(f) {
    return f.note ? '<p class="t-note" data-note-for="' + f.name + '" hidden>' + esc(f.note.text) + '</p>' : '';
  }

  function renderField(f) {
    var v = W.values[f.name];
    var id = 'f-' + f.name;
    var wrap = function (inner, isGroup) {
      return '<div class="t-field' + (f.half ? ' is-half' : '') + '" data-field="' + f.name + '">' + inner +
        '<p class="t-err" id="' + id + '-err"></p></div>';
    };
    switch (f.type) {
      case 'account':
        var a = W.account;
        return '<div class="t-field t-account" data-field="_account"><p class="t-account-title">From your Tortil account</p>' +
          '<dl><div><dt>Full name</dt><dd>' + esc(a.first + ' ' + a.last) + '</dd></div><div><dt>Email</dt><dd>' + esc(a.email) + '</dd></div>' +
          '<div><dt>Contact number</dt><dd>' + esc(a.phone) + '</dd></div></dl>' +
          '<p class="t-help">These come from your account, so you don’t need to enter them again. You can change them in Tortil account settings.</p></div>';
      case 'textarea':
        return wrap(labelHtml(f, id) + helpHtml(f) +
          '<textarea class="t-input t-textarea" id="' + id + '" data-name="' + f.name + '" rows="' + (f.rows || 4) + '"' + describedBy(f) + '>' + esc(v || '') + '</textarea>' +
          '<p class="t-count" id="' + id + '-count" aria-live="off"></p>');
      case 'select':
        var list = optionsFor(f);
        var disabled = f.optionsBy && !W.values[f.optionsBy.field];
        var empty = !f.optionsBy && !(f.options || []).length;
        return wrap(labelHtml(f, id) + helpHtml(f) +
          (empty && f.emptyText ? '<p class="t-note is-shown" id="' + id + '-empty">' + esc(f.emptyText) + '</p>' : '') +
          '<select class="t-input t-select" id="' + id + '" data-name="' + f.name + '"' + describedBy(f) + (disabled || empty ? ' disabled' : '') + '>' +
          '<option value="">' + (disabled ? 'Answer “' + optLabelOfSource(f) + '” first' : empty ? 'No positions available' : 'Select…') + '</option>' +
          list.map(function (o) { return '<option value="' + esc(o.value) + '"' + (o.value === v ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') +
          '</select>' + otherHtml(f) + noteHtml(f));
      case 'radio':
      case 'checkboxes':
        var multi = f.type === 'checkboxes';
        var sel = multi ? (v || []) : [v];
        return '<fieldset class="t-field t-group' + (f.half ? ' is-half' : '') + '" data-field="' + f.name + '"' + describedBy(f) + '>' +
          '<legend class="t-label">' + esc(f.label) + '<span class="t-req ' + (isRequired(f) ? 'is-req' : 'is-opt') + '">' + (isRequired(f) ? 'Required' : 'Optional') + '</span>' +
          (multi ? '<span class="t-req is-opt">Select all that apply</span>' : '') + '</legend>' + helpHtml(f) +
          '<div class="t-choices' + (optionsFor(f).length > 4 || multi ? ' is-wrap' : '') + '">' + optionsFor(f).map(function (o, i) {
            var cid = id + '-' + i;
            return '<label class="t-choice" for="' + cid + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" id="' + cid + '" name="' + id + '" data-name="' + f.name + '" value="' + esc(o.value) + '"' +
              (sel.indexOf(o.value) > -1 ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>';
          }).join('') + '</div>' + otherHtml(f) + noteHtml(f) +
          '<p class="t-err" id="' + id + '-err"></p></fieldset>';
      case 'file':
        var accept = f.accept.join(',');
        var kinds = f.accept.map(function (m) { return m === 'application/pdf' ? 'PDF' : m === 'image/png' ? 'PNG' : 'JPG'; }).join(', ');
        return wrap(labelHtml(f, id) + helpHtml(f) +
          '<div class="t-drop" data-drop="' + f.name + '">' +
            '<input class="t-file-input" type="file" id="' + id + '" data-name="' + f.name + '" accept="' + accept + '"' + (f.maxFiles ? ' multiple' : '') + describedBy(f) + '>' +
            '<span class="t-drop-text"><span class="t-drop-cta">Choose file' + (f.maxFiles ? 's' : '') + '</span> or drag and drop</span>' +
            '<span class="t-drop-hint">' + kinds + ' · up to ' + f.maxMB + ' MB' + (f.maxFiles ? ' each · max ' + f.maxFiles + ' files' : '') + '</span>' +
          '</div>' +
          '<ul class="t-files" data-files="' + f.name + '"></ul>');
      case 'repeater':
        var items = v && v.length ? v : [];
        return wrap('<p class="t-label">' + esc(f.label) + '<span class="t-req is-opt">Optional</span></p>' + helpHtml(f) +
          '<ol class="t-repeater" data-repeater="' + f.name + '">' + items.map(function (it, idx) {
            return '<li class="t-rep-item"><p class="t-rep-head">Project ' + (idx + 1) +
              ' <button type="button" class="t-link t-rep-remove" data-rep-remove="' + idx + '">Remove<span class="t-sr"> project ' + (idx + 1) + '</span></button></p>' +
              '<div class="t-rep-grid">' + f.item.map(function (sub) {
                var sid = id + '-' + idx + '-' + sub.name;
                return '<div class="t-rep-field"><label class="t-sublabel" for="' + sid + '">' + esc(sub.label) + (sub.required ? '' : ' <span class="t-muted">(optional)</span>') + '</label>' +
                  '<input class="t-input" id="' + sid + '" type="' + (sub.type === 'number' ? 'number' : 'text') + '" data-rep="' + f.name + '" data-idx="' + idx + '" data-sub="' + sub.name + '" value="' + esc(it[sub.name] || '') + '"' +
                  (sub.min ? ' min="' + sub.min + '" max="' + sub.max + '"' : '') + (sub.maxLength ? ' maxlength="' + sub.maxLength + '"' : '') + '></div>';
              }).join('') + '</div></li>';
          }).join('') + '</ol>' +
          (items.length < (f.maxItems || 6) ? '<button type="button" class="t-btn t-btn-ghost t-rep-add" data-rep-add="' + f.name + '">+ Add ' + (items.length ? 'another project' : 'a project') + '</button>' : ''));
      default:
        var type = { email: 'email', url: 'url', number: 'number', date: 'date' }[f.type] || 'text';
        var extra = (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
          (f.maxLength ? ' maxlength="' + f.maxLength + '"' : '') +
          (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
          (type === 'url' ? ' inputmode="url"' : '') + (type === 'number' ? ' inputmode="numeric"' : '');
        return wrap(labelHtml(f, id) + helpHtml(f) +
          '<input class="t-input" id="' + id + '" type="' + type + '" data-name="' + f.name + '" value="' + esc(v || '') + '"' + extra + describedBy(f) + '>');
    }
  }
  function optLabelOfSource(f) {
    var src = allFields().filter(function (x) { return x.name === f.optionsBy.field; })[0];
    return src ? src.label : 'an option';
  }
  function allFields() {
    return [].concat.apply([], W.form.steps.map(function (s) { return s.fields; }));
  }
  function currentFields() {
    var st = stepsWithReview()[W.step];
    return st.fields || [];
  }

  /* ---------------- dynamic refresh (conditions, counters, files) */
  function refreshStep() {
    var form = app.querySelector('.t-step');
    if (!form) return;
    var wrap = app.querySelector('.t-prog-wrap');
    var stepsNow = stepsWithReview();
    if (wrap && wrap.querySelectorAll('.t-progress li').length !== stepsNow.length) wrap.innerHTML = progressHtml(stepsNow);
    currentFields().forEach(function (f) {
      var el = form.querySelector('[data-field="' + f.name + '"]');
      if (!el) return;
      el.hidden = !isVisible(f);
      var o = el.querySelector('[data-other-for]');
      if (o) {
        var v = W.values[f.name];
        o.hidden = !(Array.isArray(v) ? v.indexOf('other') > -1 : v === 'other');
      }
      var n = el.querySelector('[data-note-for]');
      if (n) n.hidden = !cond({ field: f.name, in: f.note.in }, W.values);
      // required badge can change with requiredIf
      var badge = el.querySelector('.t-req');
      if (badge && f.requiredIf) {
        var r = isRequired(f);
        badge.className = 't-req ' + (r ? 'is-req' : 'is-opt');
        badge.textContent = r ? 'Required' : 'Optional';
      }
      var cnt = el.querySelector('.t-count');
      if (cnt) {
        var val = W.values[f.name] || '';
        if (f.maxWords) { var w = words(val); cnt.textContent = w + ' / ' + f.maxWords + ' words'; cnt.classList.toggle('is-over', w > f.maxWords); }
        else if (f.maxLength) { cnt.textContent = val.length + ' / ' + f.maxLength + ' characters'; }
      }
      if (f.type === 'file') renderFiles(f);
    });
    form.querySelectorAll('[data-decl]').forEach(function (el) {
      var d = W.form.declarations.filter(function (x) { return x.name === el.getAttribute('data-decl'); })[0];
      el.hidden = !cond(d.showIf, W.values);
    });
  }

  function rerenderField(f) {
    var el = app.querySelector('[data-field="' + f.name + '"]');
    if (!el) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = renderField(f);
    el.replaceWith(tmp.firstChild);
  }

  /* ---------------- files (simulated upload, contents never read) */
  var EXT = { 'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'] };
  function fileAllowed(f, file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    return f.accept.some(function (m) { return file.type === m || (EXT[m] || []).indexOf(ext) > -1; });
  }
  function addFiles(f, fileList) {
    var list = W.files[f.name] = W.files[f.name] || [];
    var max = f.maxFiles || 1;
    var err = '';
    Array.prototype.forEach.call(fileList, function (file) {
      if (!fileAllowed(f, file)) { err = '“' + file.name + '” isn’t an accepted file type.'; return; }
      if (file.size > f.maxMB * 1048576) { err = '“' + file.name + '” is larger than ' + f.maxMB + ' MB.'; return; }
      if (max === 1) list.length = 0;
      if (list.length >= max) { err = 'You can upload up to ' + max + ' files.'; return; }
      var item = { name: file.name, size: file.size, type: file.type || 'unknown', status: 'uploading', progress: 0, id: Math.random().toString(36).slice(2, 9) };
      list.push(item);
      simulateUpload(f, item);
    });
    W.touched[f.name] = true;
    showFieldError(f, err || validateField(f));
    renderFiles(f);
  }
  function simulateUpload(f, item) {
    var t = setInterval(function () {
      item.progress = Math.min(100, item.progress + 12 + Math.random() * 18);
      if (item.progress >= 100) { item.status = 'ready'; clearInterval(t); saveDraft(); if (W.touched[f.name]) showFieldError(f, validateField(f)); }
      renderFiles(f);
    }, REDUCED ? 60 : 160);
  }
  function renderFiles(f) {
    var ul = app.querySelector('[data-files="' + f.name + '"]');
    if (!ul) return;
    var list = W.files[f.name] || [];
    ul.innerHTML = list.map(function (it) {
      var pct = Math.round(it.progress || 100);
      return '<li class="t-file is-' + it.status + '"><span class="t-file-name">' + esc(it.name) + '</span>' +
        '<span class="t-file-meta">' + fmtSize(it.size) + ' · ' + (it.status === 'ready' ? 'Ready' : 'Uploading ' + pct + '%') + '</span>' +
        (it.status === 'uploading' ? '<span class="t-file-bar" role="progressbar" aria-label="Uploading ' + esc(it.name) + '" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></span>' : '') +
        '<button type="button" class="t-link t-file-remove" data-file-remove="' + f.name + '" data-id="' + it.id + '">Remove<span class="t-sr"> ' + esc(it.name) + '</span></button></li>';
    }).join('');
  }

  /* ---------------- validation */
  var URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
  function requiredMsg(f) {
    if (f.requiredMessage) return f.requiredMessage;
    if (/^(tell|add|share|describe)\b/i.test(f.label)) return f.label.replace(/[.?]$/, '') + '.';
    if (f.type === 'file') return 'Upload ' + lowerFirst(f.label) + '.';
    if (f.type === 'checkboxes') return 'Select at least one option.';
    if (/\?$/.test(f.label)) return 'Choose an answer.';
    if (f.type === 'select' || f.type === 'radio') return 'Choose ' + lowerFirst(f.label) + '.';
    return 'Enter ' + lowerFirst(f.label) + '.';
  }
  function validateField(f) {
    if (f.type === 'account' || f.type === 'info' || !isVisible(f)) return '';
    var req = isRequired(f);
    var v = W.values[f.name];
    if (f.type === 'file') {
      var list = W.files[f.name] || [];
      if (req && !list.length) return requiredMsg(f);
      if (list.some(function (x) { return x.status === 'uploading'; })) return 'Wait for the upload to finish.';
      return '';
    }
    if (f.type === 'checkboxes') {
      var arr = v || [];
      if (req && !arr.length) return requiredMsg(f);
      if (arr.indexOf('other') > -1 && !(W.values[f.name + '__other'] || '').trim()) return 'Tell us what “Other” is.';
      return '';
    }
    if (f.type === 'repeater') {
      var bad = (v || []).some(function (it) { return f.item.some(function (s) { return s.required && !(it[s.name] || '').toString().trim(); }); });
      return bad ? 'Add a title and role for each project, or remove the empty ones.' : '';
    }
    var s = (v == null ? '' : String(v)).trim();
    if (!s) return req ? requiredMsg(f) : '';
    if (s === 'other' && f.other && !(W.values[f.name + '__other'] || '').trim()) return 'Please specify.';
    if (f.invalidIf && f.invalidIf.in.indexOf(s) > -1) return f.invalidIf.message;
    if (f.type === 'email' && !EMAIL_RE.test(s)) return 'Enter a valid email address, like name@example.com.';
    if (f.type === 'url' && !URL_RE.test(s)) return 'Enter a full link starting with https://';
    if (f.pattern && !new RegExp(f.pattern, 'i').test(s)) return f.patternMessage || 'Check the format.';
    if (f.type === 'number') {
      var n = Number(s);
      if (isNaN(n)) return 'Enter a number.';
      if (f.min != null && n < f.min) return 'Enter a number of at least ' + f.min + '.';
      if (f.max != null && n > f.max) return 'Enter a number no larger than ' + f.max + '.';
    }
    if (f.maxWords && words(s) > f.maxWords) return 'Keep this to ' + f.maxWords + ' words or fewer (currently ' + words(s) + ').';
    if (f.maxLength && s.length > f.maxLength) return 'Keep this to ' + f.maxLength + ' characters or fewer.';
    return '';
  }
  function showFieldError(f, msg) {
    var el = app.querySelector('[data-field="' + f.name + '"]');
    if (!el) return;
    var err = el.querySelector('#f-' + f.name + '-err');
    if (err) err.textContent = msg || '';
    el.classList.toggle('has-error', !!msg);
    el.querySelectorAll('input, select, textarea').forEach(function (i) {
      if (i.closest('.t-other') || i.hasAttribute('data-rep')) return;
      if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
    });
  }

  function validateStep(fields) {
    var errors = [];
    fields.forEach(function (f) {
      W.touched[f.name] = true;
      var m = validateField(f);
      showFieldError(f, m);
      if (m) errors.push({ f: f, m: m });
    });
    return errors;
  }

  function showSummary(errors, extra) {
    var box = app.querySelector('.t-error-summary');
    if (!errors.length && !extra) { box.hidden = true; return; }
    box.innerHTML = '<p class="t-es-title">' + (errors.length === 1 ? 'There’s 1 thing to fix' : 'There are ' + errors.length + ' things to fix') + '</p><ul>' +
      errors.map(function (e) {
        var target = e.target || ('f-' + e.f.name + (e.f.type === 'radio' || e.f.type === 'checkboxes' ? '-0' : ''));
        return '<li><a href="#' + target + '" data-focus="' + target + '"' + (e.step != null ? ' data-step="' + e.step + '"' : '') + '>' + esc((e.label || e.f.label).replace(/[?:.]$/, '') + ' — ' + e.m) + '</a></li>';
      }).join('') + '</ul>';
    box.hidden = false;
    box.focus();
  }

  /* ---------------- review */
  function displayValue(f) {
    var v = W.values[f.name];
    if (f.type === 'file') {
      var list = W.files[f.name] || [];
      return list.length ? list.map(function (x) { return esc(x.name); }).join('<br>') : '';
    }
    if (f.type === 'repeater') {
      return (v || []).map(function (it) { return esc([it.title, it.role, it.year, it.company].filter(Boolean).join(' · ')); }).join('<br>');
    }
    if (f.type === 'checkboxes') return (v || []).map(function (x) { return esc(optLabel(f, x)); }).join(', ');
    if (f.type === 'select' || f.type === 'radio') return v ? esc(optLabel(f, v)) : '';
    if (f.type === 'date' && v) return esc(new Date(v + 'T00:00:00').toLocaleDateString());
    return esc(v || '').replace(/\n/g, '<br>');
  }

  function renderReview() {
    var steps = visibleSteps();
    var terms = F.submissionTerms;
    return '<p class="t-step-intro">Check your answers before you submit. You can edit any section.</p>' +
      steps.map(function (st, i) {
        var rows = st.fields.filter(function (f) { return f.type !== 'account' && isVisible(f); }).map(function (f) {
          var d = displayValue(f);
          return '<div class="t-rev-row"><dt>' + esc(f.label) + (f.private ? ' <span class="t-private">Private</span>' : '') + '</dt><dd>' + (d || '<span class="t-muted">Not provided</span>') + '</dd></div>';
        }).join('');
        if (st.fields[0] && st.fields[0].type === 'account') {
          var a = W.account;
          rows = '<div class="t-rev-row"><dt>Name, email, phone</dt><dd>' + esc(a.first + ' ' + a.last) + '<br>' + esc(a.email) + '<br>' + esc(a.phone) + ' <span class="t-muted">(from your Tortil account)</span></dd></div>' + rows;
        }
        return '<section class="t-rev"><div class="t-rev-head"><h3>' + esc(st.title) + '</h3><button type="button" class="t-link" data-edit="' + i + '">Edit<span class="t-sr"> ' + esc(st.title) + '</span></button></div><dl>' + rows + '</dl></section>';
      }).join('') +
      '<fieldset class="t-decl"><legend class="t-label">Before you submit</legend>' +
        (W.intent === 'new_project'
          ? '<details class="t-terms"><summary>Read the Project Submission Terms</summary><p class="t-terms-status">' + esc(terms.status) + ' · version ' + esc(terms.version) + '</p><ul>' +
            terms.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></details>'
          : '') +
        W.form.declarations.map(function (d) {
          var id = 'd-' + d.name;
          var req = d.required || (d.requiredIf && cond(d.requiredIf, W.values));
          return '<div class="t-decl-item" data-decl="' + d.name + '"><label class="t-check" for="' + id + '"><input type="checkbox" id="' + id + '" data-decl-input="' + d.name + '"' +
            (W.values['decl_' + d.name] ? ' checked' : '') + ' aria-describedby="' + id + '-err"><span>' +
            (d.privacy ? esc(d.label).replace('Privacy Policy', '<a href="https://app.tortil.com/legal/privacy" target="_blank" rel="noopener">Privacy Policy<span class="t-sr"> (opens in a new tab)</span></a>') : esc(d.label)) +
            (req ? '' : '') + '</span></label><p class="t-err" id="' + id + '-err"></p></div>';
        }).join('') +
        '<p class="t-help">Submitting doesn’t give consent to anything beyond the boxes you’ve ticked above.</p>' +
      '</fieldset>';
  }

  function validateAll() {
    var errors = [];
    visibleSteps().forEach(function (st, i) {
      st.fields.forEach(function (f) {
        var m = validateField(f);
        if (m) errors.push({ f: f, m: m, step: i, label: st.title + ' — ' + f.label });
      });
    });
    W.form.declarations.forEach(function (d) {
      var shown = cond(d.showIf, W.values);
      var req = d.required || (d.requiredIf && cond(d.requiredIf, W.values));
      var el = app.querySelector('#d-' + d.name + '-err');
      var input = app.querySelector('#d-' + d.name);
      var bad = shown && req && !W.values['decl_' + d.name];
      if (el) el.textContent = bad ? 'Tick this box to submit.' : '';
      if (input) { if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
      if (bad) {
        var short = d.label.length > 64 ? d.label.slice(0, 61).replace(/\s+\S*$/, '') + '…' : d.label;
        errors.push({ f: { name: d.name, label: short }, m: 'Tick this box to submit.', target: 'd-' + d.name, label: '“' + short + '”' });
      }
    });
    return errors;
  }

  /* ---------------- submit */
  function submit() {
    var btn = app.querySelector('.t-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    setTimeout(function () {
      var f = W.form;
      var ref = 'DEMO-NC-' + f.code + '-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      var answers = {};
      var attachments = [];
      visibleSteps().forEach(function (st) {
        st.fields.forEach(function (fld) {
          if (fld.type === 'account' || !isVisible(fld)) return;
          if (fld.type === 'file') {
            (W.files[fld.name] || []).forEach(function (x) { attachments.push({ field: fld.name, file_name: x.name, size_bytes: x.size, mime_type: x.type, scan_status: 'pending' }); });
            return;
          }
          var v = W.values[fld.name];
          if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
          answers[fld.name] = v;
          if (W.values[fld.name + '__other']) answers[fld.name + '_other'] = W.values[fld.name + '__other'];
        });
      });
      var payload = {
        _demo: 'Prototype only. This payload was NOT sent anywhere.',
        reference_code: ref,
        application_type: W.intent,
        organization: 'newton_cinema',
        source: 'newton_contact',
        source_card: f.card,
        status: f.statuses[f.statuses[0] === 'draft' || f.statuses[0] === 'profile_draft' ? 1 : 0],
        submitted_at: new Date().toISOString(),
        applicant: { user_id: W.account.id, prefilled_from_account: ['full_name', 'email', 'phone'] },
        answers: answers,
        attachments: attachments,
        consents: f.declarations.filter(function (d) { return cond(d.showIf, W.values); }).map(function (d) {
          return { key: d.name, granted: !!W.values['decl_' + d.name], text_version: d.terms ? F.submissionTerms.version : 'v1-draft' };
        })
      };
      var log = read(LS, KEY.submissions) || [];
      log.push(payload);
      write(LS, KEY.submissions, log);
      write(SS, KEY.last, payload);
      drop(LS, KEY.draft(W.account.email, W.intent));
      go('/done/' + W.intent);
    }, REDUCED ? 200 : 900);
  }

  /* ---------------- events */
  function bindWizard() {
    var form = app.querySelector('.t-step');
    var byName = {};
    allFields().forEach(function (f) { byName[f.name] = f; });

    function onValue(e) {
      var t = e.target;
      if (t.hasAttribute('data-decl-input')) { W.values['decl_' + t.getAttribute('data-decl-input')] = t.checked; saveDraft(); return; }
      if (t.hasAttribute('data-rep')) {
        var arr = W.values[t.getAttribute('data-rep')];
        arr[+t.getAttribute('data-idx')][t.getAttribute('data-sub')] = t.value;
        saveDraft(); return;
      }
      var name = t.getAttribute('data-name');
      if (!name || t.type === 'file') return;
      if (/__other$/.test(name)) { W.values[name] = t.value; saveDraft(); return; }
      var f = byName[name];
      if (t.type === 'checkbox') {
        W.values[name] = Array.prototype.filter.call(form.querySelectorAll('[data-name="' + name + '"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
      } else {
        W.values[name] = t.value;
      }
      // dependent option lists
      currentFields().forEach(function (d) {
        if (d.optionsBy && d.optionsBy.field === name) { W.values[d.name] = ''; rerenderField(d); }
      });
      if (W.touched[name] || e.type === 'change') { W.touched[name] = true; showFieldError(f, validateField(f)); }
      refreshStep();
      saveDraft();
    }
    form.addEventListener('input', onValue);
    form.addEventListener('change', onValue);
    form.addEventListener('focusout', function (e) {
      var name = e.target.getAttribute && e.target.getAttribute('data-name');
      if (name && byName[name] && e.target.type !== 'file') { W.touched[name] = true; showFieldError(byName[name], validateField(byName[name])); }
    });

    form.addEventListener('change', function (e) {
      if (e.target.type === 'file') { addFiles(byName[e.target.getAttribute('data-name')], e.target.files); e.target.value = ''; }
    });
    form.addEventListener('dragover', function (e) { var d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('is-over'); } });
    form.addEventListener('dragleave', function (e) { var d = e.target.closest('[data-drop]'); if (d) d.classList.remove('is-over'); });
    form.addEventListener('drop', function (e) {
      var d = e.target.closest('[data-drop]');
      if (!d) return;
      e.preventDefault(); d.classList.remove('is-over');
      addFiles(byName[d.getAttribute('data-drop')], e.dataTransfer.files);
    });

    form.addEventListener('click', function (e) {
      var t = e.target.closest('button, a');
      if (!t) return;
      if (t.matches('[data-file-remove]')) {
        var fname = t.getAttribute('data-file-remove');
        W.files[fname] = (W.files[fname] || []).filter(function (x) { return x.id !== t.getAttribute('data-id'); });
        renderFiles(byName[fname]); showFieldError(byName[fname], W.touched[fname] ? validateField(byName[fname]) : '');
        app.querySelector('#f-' + fname).focus(); saveDraft();
      } else if (t.matches('[data-rep-add]')) {
        var rn = t.getAttribute('data-rep-add');
        (W.values[rn] = W.values[rn] || []).push({});
        rerenderField(byName[rn]);
        var inputs = app.querySelectorAll('[data-rep="' + rn + '"][data-sub="title"]');
        inputs[inputs.length - 1].focus(); saveDraft();
      } else if (t.matches('[data-rep-remove]')) {
        var rr = t.closest('[data-field]').getAttribute('data-field');
        W.values[rr].splice(+t.getAttribute('data-rep-remove'), 1);
        rerenderField(byName[rr]);
        app.querySelector('[data-rep-add="' + rr + '"]').focus(); saveDraft();
      } else if (t.matches('[data-edit]')) {
        W.step = +t.getAttribute('data-edit'); W.returnToReview = true; renderWizard();
      } else if (t.matches('.t-back')) {
        W.step--; W.returnToReview = false; renderWizard(); saveDraft();
      } else if (t.matches('[data-focus]')) {
        e.preventDefault();
        if (t.hasAttribute('data-step') && +t.getAttribute('data-step') !== W.step) {
          W.step = +t.getAttribute('data-step'); W.returnToReview = true; renderWizard();
          validateStep(currentFields());
        }
        var target = app.querySelector('#' + t.getAttribute('data-focus'));
        if (target) target.focus();
      }
    });

    var over = app.querySelector('.t-start-over');
    if (over) over.addEventListener('click', function () {
      drop(LS, KEY.draft(W.account.email, W.intent));
      W.values = {}; W.files = {}; W.step = 0; W.restored = null; renderWizard(true);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var steps = stepsWithReview();
      if (steps[W.step].id === 'review') {
        var errs = validateAll();
        if (errs.length) return showSummary(errs);
        return submit();
      }
      var errors = validateStep(currentFields());
      if (errors.length) return showSummary(errors);
      if (W.returnToReview) { W.step = stepsWithReview().length - 1; W.returnToReview = false; }
      else W.step++;
      renderWizard();
      saveDraft();
    });
  }

  /* ------------------------------------------------------------ #/done */
  function viewDone(intent) {
    var p = read(SS, KEY.last);
    if (!p || p.application_type !== intent) return go('/choose');
    var f = F.forms[intent];
    render(
      '<section class="t-page t-narrow t-done">' +
        '<div class="t-done-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M5 11.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<p class="t-eyebrow">Newton Cinema · ' + esc(f.card) + ' ' + esc(f.cardLabel) + '</p>' +
        '<h1>' + esc(f.confirmation.title) + '</h1>' +
        '<p class="t-lead">' + esc(f.confirmation.body) + '</p>' +
        '<dl class="t-ref"><div><dt>Reference</dt><dd>' + esc(p.reference_code) + '</dd></div>' +
          '<div><dt>Status</dt><dd>' + esc(f.applicantStatusLabel || 'Submitted') + '</dd></div>' +
          '<div><dt>Submitted</dt><dd>' + esc(new Date(p.submitted_at).toLocaleString()) + '</dd></div></dl>' +
        '<p class="t-demo-hint"><strong>Demo</strong> · This is a sample reference. Nothing was sent to Newton Cinema or Tortil.</p>' +
        '<div class="t-done-actions">' +
          '<a class="t-btn t-btn-primary" href="' + NEWTON_RETURN + '">Return to Newton Cinema</a>' +
          '<a class="t-btn t-btn-secondary" href="#/choose">Start another application</a>' +
        '</div>' +
        '<details class="t-dev"><summary>For developers: the record this would create</summary><pre>' + esc(JSON.stringify(p, null, 2)) + '</pre></details>' +
      '</section>'
    );
  }

  /* ------------------------------------------------------------ chrome */
  document.getElementById('t-signout').addEventListener('click', function () {
    drop(SS, KEY.session);
    updateChrome();
    go('/login');
  });
  document.getElementById('t-reset').addEventListener('click', function () {
    Object.keys(LS).filter(function (k) { return k.indexOf('tortil_demo') === 0; }).forEach(function (k) { drop(LS, k); });
    Object.keys(SS).filter(function (k) { return k.indexOf('tortil_demo') === 0; }).forEach(function (k) { drop(SS, k); });
    location.href = NEWTON_RETURN;
  });

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-goto]');
    if (!b || !W) return;
    W.step = +b.getAttribute('data-goto'); W.returnToReview = false; renderWizard();
  });

  window.addEventListener('hashchange', route);
  route();
})();
