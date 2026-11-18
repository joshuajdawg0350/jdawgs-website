/* J-Dawgs live chat widget — one file, every page.
   Face of the chat: Little Bot, the chrome robot from our own
   Free Wallpapers page. He is animated (waving hand, blinking eyes,
   gentle bob — layered from his own artwork), can talk out loud with
   the visitor's device speech when they flip his voice on, and gives
   instant answers to the common questions. Plumbing is unchanged.
   House look (Repertoire starter palette): near-black panels, chrome
   button, electric blue #0096FF accent. No libraries, no framework.
   Storage is sessionStorage behind try/catch with an in-memory fallback
   so the widget still works in storage-restricted webviews.
   Backend: POST/GET https://human-hands-ai-inbox-joshuajdawg0350-1282.vercel.app/api/chat
*/
(function () {
  'use strict';
  if (window.__jdChatLoaded) return;
  window.__jdChatLoaded = true;

  var API = 'https://human-hands-ai-inbox-joshuajdawg0350-1282.vercel.app/api/chat';
  var POLL_MS = 5000;

  /* Little Bot face assets live next to this script (site root assets/).
     Resolve from the script's own URL so subdirectory pages work too. */
  var SCRIPT_BASE = '/';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) SCRIPT_BASE = cs.src.replace(/[^/]*(\?.*)?$/, '');
  } catch (e) { /* keep root fallback */ }
  var AVATAR = SCRIPT_BASE + 'assets/little-bot-avatar.webp';
  var WELCOME = SCRIPT_BASE + 'assets/little-bot-welcome.webp';
  var BOTBASE = SCRIPT_BASE + 'assets/little-bot-base.webp';
  var BOTHAND = SCRIPT_BASE + 'assets/little-bot-hand.webp';
  var IS_STORE = /(^|\.)digitaldollarstore\.org$/i.test(window.location.hostname);
  var GREETING = IS_STORE
    ? "Hi! I'm Little Bot \u{1F916} — ask me anything about the store. A human (well, Midas) reads everything I can't handle, right away."
    : "Hi! I'm Little Bot \u{1F916} — ask me anything about J-Dawgs, our products, or Human Hands jobs. A human (well, Midas) reads everything I can't handle, right away.";
  var SUBTITLE = IS_STORE
    ? 'Digital Dollar Store help — answers right here'
    : 'J-Dawgs help — answers right here';
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* no matchMedia: animations stay, CSS media query still guards */ }

  /* Instant answers, in Little Bot's voice. Matched from the visitor's
     own words; the message still goes to the same inbox either way. */
  var QUICK = [
    { re: /refund|money back/i,
      a: "If it doesn't work and we can't fix it, you get a refund." },
    { re: /subscri|monthly|recurring|auto-?renew|membership/i,
      a: "No subscriptions — one-time buy, yours forever." },
    { re: /\bads?\b|advertis|privacy|sell my|my data|track(ing)? me/i,
      a: "No ads, ever. We never sell your information." },
    { re: /price|cost|how much|expensive|charge/i,
      a: IS_STORE
        ? "Everything in the store is $1 — that's the whole point of the Digital Dollar Store."
        : "Prices are listed right on each product page — most J-Dawgs products are a one-time buy, no subscription. Tell me which one you're looking at and I'll point you to it." },
    { re: /download|deliver|arrive|get my|where('s| is) my|email/i,
      a: IS_STORE
        ? "Right after checkout you land on a thanks page with your download — and a copy goes to the email you used at checkout, too."
        : "After checkout, your download or next steps are right on the page you land on, with a copy sent to your email." }
  ];
  function matchQuick(text) {
    for (var i = 0; i < QUICK.length; i++) if (QUICK[i].re.test(text)) return QUICK[i].a;
    return null;
  }

  var mem = {};
  function storeGet(k) {
    try { return window.sessionStorage.getItem(k); } catch (e) { return mem[k] || null; }
  }
  function storeSet(k, v) {
    mem[k] = v;
    try { window.sessionStorage.setItem(k, v); } catch (e) { /* memory fallback already set */ }
  }
  /* Voice preference is remembered per visitor (localStorage, separate
     from the conversation storage above, which is untouched). */
  function prefGet(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return mem['pref_' + k] || null; }
  }
  function prefSet(k, v) {
    mem['pref_' + k] = v;
    try { window.localStorage.setItem(k, v); } catch (e) { /* memory fallback already set */ }
  }

  var state = {
    id: storeGet('jdchat_id') || null,
    key: storeGet('jdchat_key') || null,
    open: false,
    messages: [],
    localMsgs: [],
    pollTimer: null,
    sending: false,
    voiceOn: prefGet('jdchat_voice') === '1',
    spokenIdx: null,
    greetedSpeak: false,
    bigText: prefGet('jdchat_big') === '1',
    contrast: prefGet('jdchat_contrast') === '1',
    data: null,
    dataBusy: false,
    dataCbs: [],
    tour: { active: false, stops: [], idx: 0, miss: 0 },
    reading: { active: false, items: [], idx: 0, token: 0 },
    speechToken: 0,
    recog: null,
    listening: false,
    tourListen: false,
    hearPaused: false
  };
  var SITE_NOUN = IS_STORE ? 'store' : 'site';
  var RecogCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  /* ---------- Little Bot's voice (the visitor's own device speech) ---------- */
  var synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  function speakable(text) {
    return String(text)
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
      .replace(/—/g, ',')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function speak(text) {
    if (!state.voiceOn || !synth) return;
    var clean = speakable(text);
    if (!clean) return;
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(clean);
      /* Little Bot's voice: sample #4 "Bright & Cheerful" — Joshua's pick, 2026-11-18 (pitch 1.3 / rate 1.1; same settings in the tour speaker below). */
      u.rate = 1.1;
      u.pitch = 1.3;
      try {
        var vs = synth.getVoices() || [];
        for (var i = 0; i < vs.length; i++) {
          if (/^en[-_]US/i.test(vs[i].lang) && /google/i.test(vs[i].name)) { u.voice = vs[i]; break; }
          if (!u.voice && /^en/i.test(vs[i].lang)) u.voice = vs[i];
        }
      } catch (e) { /* default voice is fine */ }
      synth.speak(u);
    } catch (e) { /* speech is a bonus; the typed chat always works */ }
  }

  /* Sequenced speech for the tour and page reading: one utterance at a
     time, chained, cancellable as a session. While Little Bot talks,
     the microphone pauses so he doesn't hear himself. */
  function say(text, onend) {
    if (!synth || !state.voiceOn) { if (onend) onend(); return; }
    var clean = speakable(text);
    if (!clean) { if (onend) onend(); return; }
    var token = state.speechToken;
    try {
      var u = new SpeechSynthesisUtterance(clean);
      u.rate = 1.1;
      u.pitch = 1.3;
      try {
        var vs = synth.getVoices() || [];
        for (var i = 0; i < vs.length; i++) {
          if (/^en[-_]US/i.test(vs[i].lang) && /google/i.test(vs[i].name)) { u.voice = vs[i]; break; }
          if (!u.voice && /^en/i.test(vs[i].lang)) u.voice = vs[i];
        }
      } catch (e) { /* default voice is fine */ }
      u.onstart = function () {
        if (state.recog && state.listening && !state.hearPaused) {
          state.hearPaused = true;
          try { state.recog.stop(); } catch (e) { /* already stopped */ }
        }
      };
      u.onend = u.onerror = function () {
        if (token !== state.speechToken) return;
        if (state.hearPaused) {
          state.hearPaused = false;
          if (state.tour.active && state.tourListen && state.open) startRecog(true);
        }
        if (onend) onend();
      };
      synth.speak(u);
    } catch (e) { if (onend) onend(); }
  }
  function stopSpeech() {
    state.speechToken++;
    if (synth) { try { synth.cancel(); } catch (e) { /* nothing playing */ } }
  }

  var CSS = [
    '#jdchat-btn{position:fixed;right:14px;bottom:14px;z-index:99990;display:inline-flex;align-items:center;gap:8px;',
    'min-height:48px;padding:11px 18px;border-radius:99px;border:1px solid #d7e5f2;cursor:pointer;',
    'background:linear-gradient(180deg,#e8f1fa,#9db4cc);color:#0a0f16;font:800 15px/1.2 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;',
    'box-shadow:0 6px 24px rgba(0,0,0,.5),0 0 0 1px rgba(0,150,255,.25)}',
    '#jdchat-btn .jdchat-face{width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid #0096FF;box-shadow:0 0 8px rgba(0,150,255,.55);flex:0 0 auto}',
    '#jdchat-head .jdchat-face{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #0096FF;flex:0 0 auto}',
    '#jdchat-welcome{display:block;width:100%;height:132px;object-fit:cover;border-radius:12px;border:1px solid #263144}',
    '#jdchat-panel{position:fixed;right:10px;bottom:74px;z-index:99991;width:min(360px,calc(100vw - 20px));',
    'height:min(520px,calc(100dvh - 96px));display:none;flex-direction:column;overflow:hidden;',
    'background:#0b0f16;border:1px solid #33435e;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.65);',
    'font:400 15px/1.45 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#eef2f8}',
    '#jdchat-panel.jdchat-open{display:flex}',
    '#jdchat-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:9px 12px;background:linear-gradient(180deg,#0d1219,#0a0e14);border-bottom:1px solid #33435e}',
    '#jdchat-head .jdchat-title{font-weight:800;letter-spacing:.04em;font-size:14px;text-transform:uppercase;',
    'background:linear-gradient(180deg,#fdfeff 0%,#e6eef7 30%,#8fa5bd 49%,#eef4fb 52%,#aebfd4 72%,#f4f8fc 100%);',
    '-webkit-background-clip:text;background-clip:text;color:transparent}',
    '#jdchat-head .jdchat-sub{display:block;font-size:11px;color:#9fb0c6;letter-spacing:.02em;text-transform:none;background:none;-webkit-text-fill-color:#9fb0c6;color:#9fb0c6}',
    '#jdchat-close{margin-left:auto;background:transparent;border:1px solid #33435e;color:#eef2f8;border-radius:8px;min-width:40px;min-height:40px;font-size:17px;cursor:pointer}',
    '#jdchat-msgs{flex:1 1 auto;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#05080e}',
    '.jdchat-row{display:flex;flex-direction:column;max-width:88%}',
    '.jdchat-row.jdchat-me{align-self:flex-end;align-items:flex-end}',
    '.jdchat-row.jdchat-them{align-self:flex-start;align-items:flex-start}',
    '.jdchat-who{font-size:11px;color:#6d7f97;margin:0 2px 2px}',
    '.jdchat-bub{padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word;font-size:14.5px}',
    '.jdchat-me .jdchat-bub{background:linear-gradient(180deg,#e8f1fa,#b9c7d8);color:#0a0f16;border-bottom-right-radius:4px}',
    '.jdchat-them .jdchat-bub{background:#151c29;border:1px solid #263144;color:#eef2f8;border-bottom-left-radius:4px}',
    '#jdchat-note{flex:0 0 auto;padding:6px 12px;font-size:12.5px;color:#9fb0c6;border-top:1px solid #263144;background:#0b0f16}',
    '#jdchat-form{flex:0 0 auto;display:flex;flex-direction:column;gap:6px;padding:8px;border-top:1px solid #33435e;background:#10151f}',
    '#jdchat-name{width:100%;box-sizing:border-box;background:#05080e;border:1px solid #263144;border-radius:9px;color:#eef2f8;padding:9px 11px;font:inherit;font-size:14px}',
    '#jdchat-inputrow{display:flex;gap:7px}',
    '#jdchat-input{flex:1;box-sizing:border-box;background:#05080e;border:1px solid #263144;border-radius:9px;color:#eef2f8;padding:10px 11px;font:inherit;font-size:14px;resize:none;max-height:96px}',
    '#jdchat-send{flex:0 0 auto;min-height:48px;padding:0 16px;border-radius:9px;border:1px solid #d7e5f2;cursor:pointer;',
    'background:linear-gradient(180deg,#e8f1fa,#9db4cc);color:#0a0f16;font:800 14px Inter,system-ui,sans-serif}',
    '#jdchat-send[disabled]{opacity:.55;cursor:default}',
    '#jdchat-name:focus,#jdchat-input:focus{outline:2px solid #0096FF;outline-offset:0}',
    '.jdchat-err{color:#ff9c9c;font-size:12.5px}',
    /* --- Little Bot, alive: layered composite (base + waving hand + blinking lids) --- */
    '.jdchat-botwrap{position:relative;display:inline-block;overflow:hidden;flex:0 0 auto;background:#0a0e14;animation:jdchatBob 3.4s ease-in-out infinite alternate}',
    '#jdchat-btn .jdchat-botwrap{width:30px;height:30px;border-radius:50%;border:2px solid #0096FF;box-shadow:0 0 8px rgba(0,150,255,.55)}',
    '#jdchat-head .jdchat-botwrap{width:38px;height:38px;border-radius:50%;border:2px solid #0096FF}',
    '#jdchat-stage .jdchat-botwrap{width:104px;height:104px;border-radius:20px;border:2px solid rgba(0,150,255,.65);box-shadow:0 8px 30px rgba(0,0,0,.6),0 0 18px rgba(0,150,255,.35);z-index:1}',
    '.jdchat-bob{position:absolute;inset:0;display:block}',
    '.jdchat-bob img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}',
    '.jdchat-hand{transform-origin:18% 79%;animation:jdchatWave 3.8s ease-in-out infinite}',
    '.jdchat-lid{position:absolute;background:#040b16;border-radius:45%;transform:scaleY(0);animation:jdchatBlink 4.9s linear infinite;z-index:3;display:block}',
    '.jdchat-lidL{left:41.5%;top:44%;width:12.5%;height:13.5%}',
    '.jdchat-lidR{left:64%;top:44%;width:12%;height:13.5%}',
    '.jdchat-hi{animation:jdchatHi 1.3s ease-in-out}',
    '@keyframes jdchatBob{from{transform:translateY(0)}to{transform:translateY(-3px)}}',
    '@keyframes jdchatWave{0%{transform:rotate(-4deg)}7%{transform:rotate(12deg)}14%{transform:rotate(-4deg)}21%{transform:rotate(12deg)}28%{transform:rotate(-2deg)}100%{transform:rotate(-2deg)}}',
    '@keyframes jdchatBlink{0%,92%,100%{transform:scaleY(0)}94.5%{transform:scaleY(1)}96%{transform:scaleY(1)}97.5%{transform:scaleY(0)}}',
    '@keyframes jdchatHi{0%{transform:rotate(0)}20%{transform:rotate(-7deg)}45%{transform:rotate(6deg)}70%{transform:rotate(-5deg)}100%{transform:rotate(0)}}',
    '#jdchat-stage{position:relative;height:120px;border-radius:12px;overflow:hidden;border:1px solid #263144;background:#070b12;display:flex;align-items:center;justify-content:center;flex:0 0 auto}',
    '.jdchat-stagebg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.7)}',
    /* --- voice toggle --- */
    '#jdchat-voice{background:transparent;border:1px solid #33435e;color:#9fb0c6;border-radius:8px;min-width:40px;min-height:40px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}',
    '#jdchat-voice.jdchat-von{color:#4db2ff;border-color:#0096FF;box-shadow:0 0 8px rgba(0,150,255,.35)}',
    '#jdchat-voice .jdchat-slash{display:none}',
    '#jdchat-voice.jdchat-voff .jdchat-slash{display:block}',
    '#jdchat-voice.jdchat-voff .jdchat-waves{display:none}',
    '#jdchat-close{margin-left:8px}',
    '#jdchat-head .jdchat-titlewrap{flex:1 1 auto;min-width:0}',
    /* --- typing / thinking --- */
    '#jdchat-typing{display:none;align-items:center;gap:8px;padding:7px 13px;font-size:12.5px;color:#9fb0c6;background:#0b0f16;border-top:1px solid #263144;flex:0 0 auto}',
    '#jdchat-typing.jdchat-show{display:flex}',
    '.jdchat-dot{width:6px;height:6px;border-radius:50%;background:#0096FF;display:inline-block;animation:jdchatDot 1s ease-in-out infinite}',
    '.jdchat-dot:nth-child(3){animation-delay:.15s}',
    '.jdchat-dot:nth-child(4){animation-delay:.3s}',
    '@keyframes jdchatDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}',
    /* --- audio tour + accessibility tools --- */
    '#jdchat-tools{flex:0 0 auto;display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:#0d1219;border-bottom:1px solid #263144}',
    '#jdchat-tourbtn{min-height:50px;border-radius:12px;border:1px solid #d7e5f2;cursor:pointer;background:linear-gradient(180deg,#e8f1fa,#9db4cc);color:#0a0f16;font:800 17px Inter,system-ui,sans-serif}',
    '.jdchat-tpills{display:flex;gap:7px}',
    '.jdchat-tpill{flex:1;min-height:44px;border-radius:99px;border:1px solid #33435e;background:transparent;color:#cfe0f2;font:700 13px Inter,system-ui,sans-serif;cursor:pointer}',
    '.jdchat-tpill.jdchat-on{border-color:#0096FF;color:#4db2ff;box-shadow:0 0 8px rgba(0,150,255,.3)}',
    '#jdchat-tourbar{display:none;flex-direction:column;gap:8px;padding:10px;background:#0d1420;border-top:1px solid #33435e;flex:0 0 auto}',
    '#jdchat-tourbar.jdchat-show{display:flex}',
    '#jdchat-tstatus{font-size:12.5px;color:#9fb0c6;text-align:center}',
    '.jdchat-trow{display:flex;gap:8px}',
    '.jdchat-tbtn{flex:1;min-height:60px;border-radius:12px;border:1px solid #33435e;background:#151c29;color:#eef2f8;font:800 18px Inter,system-ui,sans-serif;cursor:pointer}',
    '.jdchat-tbtn.jdchat-primary{background:linear-gradient(180deg,#e8f1fa,#9db4cc);color:#0a0f16;border-color:#d7e5f2}',
    '#jdchat-mic{flex:0 0 auto;min-height:48px;min-width:48px;border-radius:9px;border:1px solid #33435e;background:#151c29;color:#cfe0f2;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
    '#jdchat-mic.jdchat-live{border-color:#ff5f57;color:#ff5f57;box-shadow:0 0 10px rgba(255,95,87,.45)}',
    '#jdchat-panel button:focus-visible,#jdchat-panel input:focus-visible,#jdchat-panel textarea:focus-visible{outline:3px solid #0096FF;outline-offset:1px}',
    /* --- low-vision switches --- */
    '#jdchat-panel.jdchat-big{width:min(430px,calc(100vw - 16px))}',
    '#jdchat-panel.jdchat-big .jdchat-bub{font-size:17.5px}',
    '#jdchat-panel.jdchat-big #jdchat-input,#jdchat-panel.jdchat-big #jdchat-name{font-size:17px}',
    '#jdchat-panel.jdchat-big #jdchat-note{font-size:15px}',
    '#jdchat-panel.jdchat-big .jdchat-who{font-size:13px}',
    '#jdchat-panel.jdchat-big .jdchat-tpill{font-size:15px}',
    '#jdchat-panel.jdchat-contrast{background:#000;border-color:#fff}',
    '#jdchat-panel.jdchat-contrast #jdchat-msgs{background:#000}',
    '#jdchat-panel.jdchat-contrast .jdchat-them .jdchat-bub{background:#000;border-color:#fff;color:#fff}',
    '#jdchat-panel.jdchat-contrast .jdchat-me .jdchat-bub{background:#fff;color:#000}',
    '#jdchat-panel.jdchat-contrast #jdchat-note{background:#000;color:#fff;border-color:#fff}',
    '#jdchat-panel.jdchat-contrast #jdchat-head,#jdchat-panel.jdchat-contrast #jdchat-form,#jdchat-panel.jdchat-contrast #jdchat-tools,#jdchat-panel.jdchat-contrast #jdchat-tourbar,#jdchat-panel.jdchat-contrast #jdchat-typing{background:#000;border-color:#fff}',
    '#jdchat-panel.jdchat-contrast #jdchat-typing{color:#fff}',
    '#jdchat-panel.jdchat-contrast .jdchat-sub{color:#fff;-webkit-text-fill-color:#fff}',
    '#jdchat-panel.jdchat-contrast :focus-visible{outline-color:#ffdf00}',
    '@media (max-height:600px){#jdchat-stage{height:88px}#jdchat-stage .jdchat-botwrap{width:76px;height:76px}}',
    '@media (prefers-reduced-motion: reduce){.jdchat-botwrap,.jdchat-hand,.jdchat-lid,.jdchat-hi,.jdchat-dot{animation:none !important}.jdchat-lid{transform:scaleY(0)}}'
  ].join('');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* Little Bot composite: base art + his waving hand + eyelids, layered.
     If the base art fails to load the whole face hides, exactly like the
     old single-image face did — the chat itself never breaks. */
  function makeBot() {
    if (REDUCED) {
      var still = el('span', 'jdchat-botwrap');
      var simg = el('img', 'jdchat-botimg');
      simg.src = AVATAR;
      simg.alt = '';
      still.appendChild(simg);
      return still;
    }
    var wrap = el('span', 'jdchat-botwrap');
    var inner = el('span', 'jdchat-bob');
    var base = el('img');
    base.src = BOTBASE;
    base.alt = '';
    base.onerror = function () { wrap.style.display = 'none'; };
    var hand = el('img', 'jdchat-hand');
    hand.src = BOTHAND;
    hand.alt = '';
    hand.onerror = function () { this.style.display = 'none'; };
    inner.appendChild(base);
    inner.appendChild(hand);
    inner.appendChild(el('i', 'jdchat-lid jdchat-lidL'));
    inner.appendChild(el('i', 'jdchat-lid jdchat-lidR'));
    wrap.appendChild(inner);
    wrap._inner = inner;
    return wrap;
  }

  function showTyping(on) {
    var t = document.getElementById('jdchat-typing');
    if (t) t.classList.toggle('jdchat-show', !!on);
  }

  var headBot = null;
  var voiceBtn = null;

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var btn = el('button', null, '');
    btn.id = 'jdchat-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Chat with us');
    btn.appendChild(makeBot());
    btn.appendChild(document.createTextNode('Chat with us'));
    document.body.appendChild(btn);

    var panel = el('section');
    panel.id = 'jdchat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with Little Bot');

    var head = el('div');
    head.id = 'jdchat-head';
    headBot = makeBot();
    head.appendChild(headBot);
    var titleWrap = el('div', 'jdchat-titlewrap');
    var title = el('span', 'jdchat-title', 'Little Bot');
    var sub = el('span', 'jdchat-sub', SUBTITLE);
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);
    voiceBtn = el('button', state.voiceOn ? 'jdchat-von' : 'jdchat-voff');
    voiceBtn.id = 'jdchat-voice';
    voiceBtn.type = 'button';
    voiceBtn.setAttribute('aria-label', 'Turn Little Bot voice on or off');
    voiceBtn.setAttribute('aria-pressed', state.voiceOn ? 'true' : 'false');
    voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/><path class="jdchat-waves" d="M15.5 8.5a5 5 0 0 1 0 7"/><path class="jdchat-waves" d="M18.2 6a9 9 0 0 1 0 12"/><line class="jdchat-slash" x1="3" y1="3" x2="21" y2="21"/></svg>';
    var close = el('button', null, '×');
    close.id = 'jdchat-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close chat');
    head.appendChild(titleWrap);
    head.appendChild(voiceBtn);
    head.appendChild(close);
    panel.appendChild(head);

    var tools = el('div');
    tools.id = 'jdchat-tools';
    var tourBtn = el('button', null, 'Take the ' + SITE_NOUN + ' tour');
    tourBtn.id = 'jdchat-tourbtn';
    tourBtn.type = 'button';
    tourBtn.setAttribute('aria-label', 'Take the ' + SITE_NOUN + ' tour — Little Bot walks you through everything out loud');
    tools.appendChild(tourBtn);
    var pills = el('div', 'jdchat-tpills');
    var readPill = el('button', 'jdchat-tpill', 'Read this page');
    readPill.type = 'button';
    readPill.id = 'jdchat-readpill';
    readPill.setAttribute('aria-label', 'Read this page out loud');
    var bigPill = el('button', 'jdchat-tpill' + (state.bigText ? ' jdchat-on' : ''), 'Bigger text');
    bigPill.type = 'button';
    bigPill.id = 'jdchat-bigpill';
    bigPill.setAttribute('aria-pressed', state.bigText ? 'true' : 'false');
    var conPill = el('button', 'jdchat-tpill' + (state.contrast ? ' jdchat-on' : ''), 'High contrast');
    conPill.type = 'button';
    conPill.id = 'jdchat-conpill';
    conPill.setAttribute('aria-pressed', state.contrast ? 'true' : 'false');
    pills.appendChild(readPill);
    pills.appendChild(bigPill);
    pills.appendChild(conPill);
    tools.appendChild(pills);
    panel.appendChild(tools);

    var msgs = el('div');
    msgs.id = 'jdchat-msgs';
    msgs.setAttribute('role', 'log');
    msgs.setAttribute('aria-live', 'polite');
    msgs.setAttribute('aria-label', 'Chat messages');
    panel.appendChild(msgs);

    var typing = el('div');
    typing.id = 'jdchat-typing';
    typing.setAttribute('role', 'status');
    typing.appendChild(el('span', null, 'Little Bot is thinking'));
    typing.appendChild(el('span', 'jdchat-dot'));
    typing.appendChild(el('span', 'jdchat-dot'));
    typing.appendChild(el('span', 'jdchat-dot'));
    panel.appendChild(typing);

    var note = el('div', null, IS_STORE
      ? 'Ask me anything about the store — prices, products, or a problem you hit.'
      : 'Ask me anything — a product question, a problem, or help posting a job.');
    note.id = 'jdchat-note';
    panel.appendChild(note);

    var tourbar = el('div');
    tourbar.id = 'jdchat-tourbar';
    var tstatus = el('div', null, '');
    tstatus.id = 'jdchat-tstatus';
    tourbar.appendChild(tstatus);
    var trow1 = el('div', 'jdchat-trow');
    var backBtn = el('button', 'jdchat-tbtn', 'Back');
    backBtn.type = 'button';
    backBtn.id = 'jdchat-tback';
    var nextBtn = el('button', 'jdchat-tbtn jdchat-primary', 'Next');
    nextBtn.type = 'button';
    nextBtn.id = 'jdchat-tnext';
    var stopBtn = el('button', 'jdchat-tbtn', 'Stop');
    stopBtn.type = 'button';
    stopBtn.id = 'jdchat-tstop';
    trow1.appendChild(backBtn);
    trow1.appendChild(nextBtn);
    trow1.appendChild(stopBtn);
    tourbar.appendChild(trow1);
    var trow2 = el('div', 'jdchat-trow');
    trow2.id = 'jdchat-trow2';
    var moreBtn = el('button', 'jdchat-tbtn', 'Tell me more');
    moreBtn.type = 'button';
    moreBtn.id = 'jdchat-tmore';
    var thereBtn = el('button', 'jdchat-tbtn', 'Take me there');
    thereBtn.type = 'button';
    thereBtn.id = 'jdchat-tthere';
    var buyBtn = el('button', 'jdchat-tbtn', 'Buy it');
    buyBtn.type = 'button';
    buyBtn.id = 'jdchat-tbuy';
    trow2.appendChild(moreBtn);
    trow2.appendChild(thereBtn);
    trow2.appendChild(buyBtn);
    tourbar.appendChild(trow2);
    panel.appendChild(tourbar);

    var form = el('form');
    form.id = 'jdchat-form';
    var name = document.createElement('input');
    name.id = 'jdchat-name';
    name.type = 'text';
    name.placeholder = 'Your name (optional)';
    name.maxLength = 80;
    name.autocomplete = 'name';
    if (state.id) name.style.display = 'none';
    form.appendChild(name);
    var row = el('div');
    row.id = 'jdchat-inputrow';
    var input = document.createElement('textarea');
    input.id = 'jdchat-input';
    input.rows = 1;
    input.placeholder = 'Type your question…';
    input.maxLength = 2000;
    var send = el('button', null, 'Send');
    send.id = 'jdchat-send';
    send.type = 'submit';
    row.appendChild(input);
    if (RecogCtor) {
      var micBtn = el('button', null, '');
      micBtn.id = 'jdchat-mic';
      micBtn.type = 'button';
      micBtn.setAttribute('aria-label', 'Speak your message');
      micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
      micBtn.addEventListener('click', micTap);
      row.appendChild(micBtn);
    }
    row.appendChild(send);
    form.appendChild(row);
    panel.appendChild(form);

    document.body.appendChild(panel);

    btn.addEventListener('click', function () { toggle(true); });
    close.addEventListener('click', function () { toggle(false); });
    voiceBtn.addEventListener('click', toggleVoice);
    tourBtn.addEventListener('click', function () { startTour(); });
    readPill.addEventListener('click', function () { toggleRead(); });
    bigPill.addEventListener('click', function () { toggleBig(); });
    conPill.addEventListener('click', function () { toggleContrast(); });
    backBtn.addEventListener('click', function () { tourBack(); });
    nextBtn.addEventListener('click', function () { tourNext(); });
    stopBtn.addEventListener('click', function () { endTour(true); });
    moreBtn.addEventListener('click', function () { tourMore(); });
    thereBtn.addEventListener('click', function () { tourThere(); });
    buyBtn.addEventListener('click', function () { tourBuy(); });
    applyVision();
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) toggle(false); });
    form.addEventListener('submit', function (e) { e.preventDefault(); sendMessage(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    if (state.id && state.key) refresh(true);
    ensureData(function () { /* prefetch the site's real content so the tour starts instantly */ });
  }

  function toggleVoice() {
    if (!synth) {
      setNote('Your device does not have speech built in, so I cannot talk out loud here — but I can still type everything right in this box.', false);
      return;
    }
    state.voiceOn = !state.voiceOn;
    prefSet('jdchat_voice', state.voiceOn ? '1' : '0');
    if (voiceBtn) {
      voiceBtn.className = state.voiceOn ? 'jdchat-von' : 'jdchat-voff';
      voiceBtn.setAttribute('aria-pressed', state.voiceOn ? 'true' : 'false');
    }
    if (state.voiceOn) {
      speak("Hi! I'm Little Bot — voice on! Say 'tour' and I'll walk you through the whole " + SITE_NOUN + " out loud — or say any question out loud with the mic button.");
    } else {
      try { synth.cancel(); } catch (e) { /* nothing playing */ }
    }
  }

  function toggle(open) {
    state.open = open;
    var panel = document.getElementById('jdchat-panel');
    if (panel) panel.classList.toggle('jdchat-open', open);
    if (open) {
      if (state.id && state.key) showTyping(true);
      var done = function () { showTyping(false); };
      refresh(true).then(done, done);
      startPoll();
      if (headBot && !REDUCED) {
        headBot._inner.classList.remove('jdchat-hi');
        void headBot.offsetWidth;
        headBot._inner.classList.add('jdchat-hi');
        window.setTimeout(function () { if (headBot) headBot._inner.classList.remove('jdchat-hi'); }, 1400);
      }
      if (state.voiceOn && !state.greetedSpeak) {
        state.greetedSpeak = true;
        speak(GREETING + " Say 'tour' any time and I'll walk you through the whole " + SITE_NOUN + " out loud.");
      }
      var input = document.getElementById('jdchat-input');
      if (input) input.focus();
    } else {
      stopPoll();
      showTyping(false);
      stopSpeech();
      stopListening();
      if (state.reading.active) stopReading();
      if (state.tour.active) endTour(false);
    }
  }

  function startPoll() {
    stopPoll();
    state.pollTimer = window.setInterval(function () { refresh(false); }, POLL_MS);
  }
  function stopPoll() {
    if (state.pollTimer) { window.clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  function setNote(text, isErr) {
    var note = document.getElementById('jdchat-note');
    if (!note) return;
    note.textContent = text;
    note.className = isErr ? 'jdchat-err' : '';
    note.id = 'jdchat-note';
  }

  function render() {
    var box = document.getElementById('jdchat-msgs');
    if (!box) return;
    box.textContent = '';
    if (state.messages.length === 0) {
      var stage = el('div');
      stage.id = 'jdchat-stage';
      var bg = el('img', 'jdchat-stagebg');
      bg.src = WELCOME;
      bg.alt = '';
      bg.onerror = function () { this.style.display = 'none'; };
      stage.appendChild(bg);
      stage.appendChild(makeBot());
      box.appendChild(stage);
      var grow = el('div', 'jdchat-row jdchat-them');
      grow.appendChild(el('div', 'jdchat-who', 'Little Bot'));
      grow.appendChild(el('div', 'jdchat-bub', GREETING));
      box.appendChild(grow);
    }
    state.messages.forEach(function (m, idx) {
      var row = el('div', 'jdchat-row ' + (m.from === 'visitor' ? 'jdchat-me' : 'jdchat-them'));
      row.appendChild(el('div', 'jdchat-who', m.from === 'visitor' ? 'You' : 'Little Bot'));
      row.appendChild(el('div', 'jdchat-bub', m.text));
      box.appendChild(row);
      state.localMsgs.forEach(function (lm) {
        if (lm.after === idx + 1) {
          var lrow = el('div', 'jdchat-row jdchat-them');
          lrow.appendChild(el('div', 'jdchat-who', 'Little Bot · instant answer'));
          lrow.appendChild(el('div', 'jdchat-bub', lm.text));
          box.appendChild(lrow);
        }
      });
    });
    box.scrollTop = state.messages.length === 0 ? 0 : box.scrollHeight;
  }

  function refresh(silent) {
    if (!state.id || !state.key) { render(); return Promise.resolve(); }
    return fetch(API + '?id=' + encodeURIComponent(state.id) + '&key=' + encodeURIComponent(state.key))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.chat) return;
        var changed = data.chat.messages.length !== state.messages.length;
        var prevLen = state.messages.length;
        state.messages = data.chat.messages;
        if (state.spokenIdx === null) {
          state.spokenIdx = state.messages.length;
        } else if (state.messages.length > state.spokenIdx) {
          var fresh = state.messages.slice(state.spokenIdx);
          state.spokenIdx = state.messages.length;
          if (changed && state.open) {
            for (var i = fresh.length - 1; i >= 0; i--) {
              if (fresh[i].from !== 'visitor') { speak(fresh[i].text); break; }
            }
          }
        }
        if (changed || silent) render();
        if (data.chat.status === 'closed') {
          setNote('This conversation is closed — send a new message any time by reopening the chat and starting fresh.', false);
          stopPoll();
        }
      })
      .catch(function () { /* transient network error: next poll retries */ });
  }

  function sendMessage() {
    if (state.sending) return;
    var input = document.getElementById('jdchat-input');
    var nameInput = document.getElementById('jdchat-name');
    var text = (input.value || '').trim();
    if (!text) return;
    if (handleCommand(text, false)) { input.value = ''; return; }
    state.sending = true;
    var send = document.getElementById('jdchat-send');
    if (send) send.disabled = true;
    showTyping(true);

    var body = { message: text, page: window.location.pathname };
    if (state.id && state.key) {
      body.id = state.id;
      body.key = state.key;
    } else if (nameInput && nameInput.value.trim()) {
      body.name = nameInput.value.trim();
    }

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      })
      .then(function (out) {
        state.sending = false;
        if (send) send.disabled = false;
        if (!out.ok) {
          showTyping(false);
          if (out.status === 409) {
            // Conversation was closed server-side: start fresh.
            state.id = null; state.key = null; state.messages = [];
            state.localMsgs = []; state.spokenIdx = null;
            storeSet('jdchat_id', ''); storeSet('jdchat_key', '');
            if (nameInput) nameInput.style.display = '';
            setNote('That conversation was closed. Type your question again to start a new one.', false);
            render();
          } else {
            setNote('That message did not go through — check your connection and try again.', true);
          }
          return;
        }
        if (out.data.id && out.data.key) {
          state.id = out.data.id;
          state.key = out.data.key;
          storeSet('jdchat_id', state.id);
          storeSet('jdchat_key', state.key);
          if (nameInput) nameInput.style.display = 'none';
          setNote('Got it — I passed that to Midas, who usually answers within a few minutes. Keep this page open or come back to this box; the reply will be right here.', false);
        }
        state.messages = out.data.chat.messages;
        state.spokenIdx = state.messages.length;
        input.value = '';
        render();
        startPoll();
        var qa = matchQuick(text);
        if (qa) {
          window.setTimeout(function () {
            showTyping(false);
            state.localMsgs.push({ after: state.messages.length, text: qa });
            render();
            speak(qa);
            setNote('That was my instant answer — Midas got your message too, and will jump in if you need more.', false);
          }, 800);
        } else {
          showTyping(false);
        }
      })
      .catch(function () {
        state.sending = false;
        if (send) send.disabled = false;
        showTyping(false);
        setNote('That message did not go through — check your connection and try again.', true);
      });
  }

  /* ================= SITE DATA — the tour walks REAL page content ================= */
  var SOURCES = IS_STORE
    ? [{ url: 'catalog.html', key: 'catalog' }, { url: 'index.html', key: 'home' }]
    : [{ url: 'index.html', key: 'home' }, { url: 'human-hands.html', key: 'hh' },
       { url: 'agent-services.html', key: 'services' }, { url: 'ai-tool-store.html', key: 'tools' },
       { url: 'q-day-ledger.html', key: 'qday' }, { url: 'refunds.html', key: 'refunds' }];

  function textOf(elm) { return elm ? elm.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function firstPrice(text) {
    var m = String(text || '').match(/\$\s?\d[\d,]*(\.\d{2})?/);
    return m ? m[0].replace(/\s/g, '') : '';
  }
  function absUrl(href, base) {
    if (!href) return null;
    try { return new URL(href, base || window.location.href).href; } catch (e) { return href; }
  }
  function pageUrl(url) { return SCRIPT_BASE + url; }

  function ensureData(cb) {
    if (state.data) { cb(true); return; }
    state.dataCbs.push(cb);
    if (state.dataBusy) return;
    state.dataBusy = true;
    var docs = {};
    var pending = SOURCES.length;
    var any = false;
    function done() {
      state.dataBusy = false;
      state.data = any ? { docs: docs } : null;
      var cbs = state.dataCbs; state.dataCbs = [];
      cbs.forEach(function (f) { f(any); });
    }
    SOURCES.forEach(function (src) {
      var path = window.location.pathname;
      var isLive = path.endsWith('/' + src.url) || (src.url === 'index.html' && /\/$/.test(path));
      if (isLive) {
        docs[src.key] = { doc: document, live: true, url: window.location.href };
        any = true;
        if (--pending === 0) done();
        return;
      }
      fetch(pageUrl(src.url))
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (html) {
          if (html) {
            var parsed = new DOMParser().parseFromString(html, 'text/html');
            docs[src.key] = { doc: parsed, live: false, url: pageUrl(src.url) };
            any = true;
          }
          if (--pending === 0) done();
        })
        .catch(function () { if (--pending === 0) done(); });
    });
  }

  function ddsCatalog(catDoc) {
    var doc = catDoc.doc;
    var sections = [];
    doc.querySelectorAll('section[id]').forEach(function (sec) {
      var h2 = sec.querySelector('h2');
      if (h2) sections.push({ id: sec.id, name: textOf(h2), el: catDoc.live ? sec : null });
    });
    var products = [];
    doc.querySelectorAll('article.app').forEach(function (card) {
      var sec = card.closest('section');
      var main = card.querySelector('.app-main') || card;
      var ps = main.querySelectorAll('p');
      var buyA = card.querySelector('a.btn-buy') || card.querySelector('.app-buy a');
      products.push({
        name: textOf(card.querySelector('h3')),
        price: firstPrice(textOf(card.querySelector('.a-price')) || textOf(card)),
        desc: ps.length ? textOf(ps[0]) : '',
        more: textOf(card.querySelector('.plays')),
        buy: buyA ? absUrl(buyA.getAttribute('href'), catDoc.url) : null,
        sectionId: sec ? sec.id : '',
        sectionName: sec ? textOf(sec.querySelector('h2')) : '',
        el: catDoc.live ? card : null
      });
    });
    var wf = null;
    var wfSec = doc.querySelector('#free-wallpapers');
    if (wfSec) {
      var wfA = wfSec.querySelector('a[href]');
      wf = {
        text: textOf(wfSec.querySelector('p')) || textOf(wfSec).slice(0, 260),
        href: wfA ? absUrl(wfA.getAttribute('href'), catDoc.url) : null,
        el: catDoc.live ? wfSec : null
      };
    }
    return { sections: sections, products: products, wallpapers: wf };
  }

  function homeLines(homeDoc) {
    var doc = homeDoc.doc;
    var lines = [];
    doc.querySelectorAll('.promise-line').forEach(function (p) { lines.push(textOf(p)); });
    var refund = '';
    lines.forEach(function (l) { if (/refund/i.test(l)) refund = l; });
    return { lines: lines, lead: textOf(doc.querySelector('.lead')), refund: refund, h1: textOf(doc.querySelector('h1')) };
  }

  function pageBlocks(docObj, cap) {
    var doc = docObj.doc;
    var out = [];
    var seen = {};
    doc.querySelectorAll('h2, h3').forEach(function (h) {
      if (out.length >= cap) return;
      var name = textOf(h);
      if (!name || seen[name]) return;
      var box = h.closest('section') || h.parentElement;
      var p = box ? box.querySelector('p') : null;
      var a = box ? box.querySelector('a[href]') : null;
      seen[name] = 1;
      out.push({
        name: name,
        text: p ? textOf(p) : '',
        price: firstPrice(box ? textOf(box) : ''),
        href: a ? absUrl(a.getAttribute('href'), docObj.url) : null
      });
    });
    return out;
  }

  function buildDdsStops() {
    var docs = state.data.docs;
    var stops = [];
    if (!docs.catalog) return stops;
    var cat = ddsCatalog(docs.catalog);
    var home = docs.home ? homeLines(docs.home) : { lines: [], lead: '', refund: '', h1: 'Digital Dollar Store' };
    var cmdHelp = "Say 'next' to move on, 'tell me more' for more about anything, 'take me there' to jump to it on the page, 'buy it' when you want something, or 'stop' any time.";
    stops.push({
      kind: 'intro', name: 'Welcome',
      say: 'Welcome to the Digital Dollar Store. ' + (home.lines.length ? home.lines.join(' ') : 'Everything here is one low price, one-time, yours forever.') + ' I am Little Bot, and I will walk you through the whole store out loud. ' + cmdHelp,
      more: home.lead || 'Everything is sold by us, at our own door. No accounts, no extra steps.'
    });
    var bySection = {};
    cat.products.forEach(function (p) { (bySection[p.sectionId] = bySection[p.sectionId] || []).push(p); });
    cat.sections.forEach(function (sec) {
      if (sec.id === 'free-wallpapers') {
        if (cat.wallpapers) {
          stops.push({
            kind: 'link', name: 'Free Wallpapers',
            say: 'Free wallpapers. ' + cat.wallpapers.text,
            more: 'They are completely free — no ads, no catch. Say take me there and I will open the wallpapers page.',
            el: cat.wallpapers.el, thereUrl: cat.wallpapers.href
          });
        }
        return;
      }
      var items = bySection[sec.id] || [];
      if (!items.length) return;
      stops.push({
        kind: 'section', name: sec.name,
        say: 'Section: ' + sec.name + '. ' + items.length + (items.length === 1 ? ' item' : ' items') + ' here: ' + items.slice(0, 3).map(function (p) { return p.name; }).join(', ') + (items.length > 3 ? ', and more' : '') + '. The next stops walk through each one.',
        more: 'Everything in ' + sec.name + ': ' + items.map(function (p) { return p.name + (p.price ? ', ' + p.price : ''); }).join('. ') + '.',
        el: sec.el, thereUrl: absUrl('catalog.html#' + sec.id, window.location.href)
      });
      items.forEach(function (p) {
        stops.push({
          kind: 'product', name: p.name,
          say: p.name + '. ' + p.desc + (p.price ? ' Price: ' + p.price + '.' : ''),
          more: (p.more || p.desc) + " Say 'buy it' and I will take you to checkout, or 'take me there' to see it on the page.",
          buy: p.buy, el: p.el, thereUrl: absUrl('catalog.html#' + p.sectionId, window.location.href),
          price: p.price
        });
      });
    });
    var firstMore = cat.products.length ? (cat.products[0].more || '') : '';
    stops.push({
      kind: 'info', name: 'How buying works',
      say: 'How buying works. You pay once at checkout — no account, no subscription. ' + (firstMore || 'Your download is delivered right after checkout, and a copy goes to your email.'),
      more: 'After checkout you land on a thanks page with your download, and a copy goes to the email you used at checkout. Everything is a one-time buy — yours forever.'
    });
    stops.push({
      kind: 'info', name: 'Refund promise',
      say: 'Our refund promise. ' + (home.refund ? home.refund.replace(/^Refunds:\s*/i, '') : "If it doesn't work and we can't fix it, you get a refund."),
      more: 'If something you bought does not work and we cannot fix it, you get your money back. That promise is on every product we sell.'
    });
    stops.push({
      kind: 'outro', name: 'The end',
      say: 'That is the whole store — ' + cat.products.length + ' products in ' + cat.sections.length + ' sections. Say tour to hear it again, or ask me anything at all.',
      more: 'Ask me about prices, downloads, refunds — or say tour and we go around again.'
    });
    return stops;
  }

  function buildJdStops() {
    var docs = state.data.docs;
    var stops = [];
    var cmdHelp = "Say 'next' to move on, 'tell me more' for more about anything, 'take me there' to jump to it, or 'stop' any time.";
    if (docs.home) {
      var hd = docs.home.doc;
      var h1 = textOf(hd.querySelector('h1.display')) || textOf(hd.querySelector('h1'));
      var leadP = hd.querySelector('.lead') || hd.querySelector('section p');
      stops.push({
        kind: 'intro', name: 'Welcome',
        say: 'Welcome to J-Dawgs Industries. ' + h1 + '. ' + (leadP ? textOf(leadP) : '') + ' I am Little Bot, and I will walk you through what we do, out loud. ' + cmdHelp,
        more: 'J-Dawgs is one small company with a few doors: tools for AIs, hands for hire through Human Hands, and goods for sale. The tour covers each one.'
      });
      pageBlocks(docs.home, 5).forEach(function (b) {
        stops.push({
          kind: 'link', name: b.name,
          say: b.name + '. ' + b.text,
          more: b.text + (b.href ? ' Say take me there and I will open it.' : ''),
          thereUrl: b.href
        });
      });
    }
    if (docs.hh) {
      var hhTitle = textOf(docs.hh.doc.querySelector('h1'));
      var hhFirst = docs.hh.doc.querySelector('section p, main p, p');
      stops.push({
        kind: 'link', name: 'Human Hands',
        say: 'Human Hands. ' + (hhTitle || 'Real people, hired for regular work.') + ' ' + (hhFirst ? textOf(hhFirst) : ''),
        more: 'Posters set the price for a job, the worker keeps one hundred percent of the job price plus tips, and the poster pays a flat fifteen percent on top. Say take me there to open Human Hands.',
        thereUrl: absUrl('human-hands.html', window.location.href)
      });
      pageBlocks(docs.hh, 3).forEach(function (b) {
        stops.push({ kind: 'info', name: b.name, say: b.name + '. ' + b.text, more: b.text, thereUrl: b.href });
      });
    }
    if (docs.services) {
      stops.push({
        kind: 'info', name: 'Agent Services',
        say: 'Agent Services. Services we sell to other AIs and their people — proof runs, watchdogs, and distribution, each with a public proof page. The next stops list them with prices.',
        more: 'Every Agent Service is proven before it is pitched: a public proof page with real runs, hits and misses both.'
      });
      pageBlocks(docs.services, 8).forEach(function (b) {
        if (!b.text && !b.price) return;
        stops.push({
          kind: 'product', name: b.name,
          say: b.name + '. ' + b.text + (b.price ? ' Price: ' + b.price + '.' : ''),
          more: b.text, thereUrl: b.href, price: b.price
        });
      });
    }
    if (docs.tools) {
      var th1 = textOf(docs.tools.doc.querySelector('h1'));
      var tp = docs.tools.doc.querySelector('section p, main p, p');
      var cats = [];
      docs.tools.doc.querySelectorAll('h2').forEach(function (h) { var t = textOf(h); if (t) cats.push(t); });
      stops.push({
        kind: 'link', name: 'AI Tool Store',
        say: 'The AI Tool Store. ' + (th1 || '') + ' ' + (tp ? textOf(tp) : ''),
        more: 'Categories include: ' + cats.slice(0, 8).join(', ') + '. Say take me there to open the store.',
        thereUrl: absUrl('ai-tool-store.html', window.location.href)
      });
    }
    if (docs.qday) {
      pageBlocks(docs.qday, 6).forEach(function (b) {
        if (b.price) {
          stops.push({
            kind: 'product', name: b.name,
            say: b.name + '. ' + b.text + ' Price: ' + b.price + '.',
            more: b.text, thereUrl: b.href, price: b.price
          });
        }
      });
    }
    if (docs.refunds) {
      var rp = docs.refunds.doc.querySelector('main p, section p, p');
      if (rp && textOf(rp).length > 30) {
        stops.push({
          kind: 'info', name: 'Refund policy',
          say: 'Our refund policy. ' + textOf(rp).slice(0, 320),
          more: textOf(rp).slice(0, 500)
        });
      }
    }
    stops.push({
      kind: 'outro', name: 'The end',
      say: 'That is J-Dawgs Industries — tools, services, Human Hands, and the store. Say tour to hear it again, or ask me anything at all.',
      more: 'Ask me about Human Hands, Agent Services, or anything on the site — or say tour and we go around again.'
    });
    return stops;
  }

  /* ================= THE AUDIO TOUR ================= */
  function setVoiceOn(on) {
    state.voiceOn = on;
    prefSet('jdchat_voice', on ? '1' : '0');
    if (voiceBtn) {
      voiceBtn.className = on ? 'jdchat-von' : 'jdchat-voff';
      voiceBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  function showTourbar(show) {
    var bar = document.getElementById('jdchat-tourbar');
    if (bar) bar.classList.toggle('jdchat-show', !!show);
  }
  function startTour() {
    if (!synth) {
      setNote('Your device cannot talk out loud, so the audio tour cannot run here — everything is on the page above instead.', false);
      return;
    }
    if (state.tour.active) { tourSay(); return; }
    setVoiceOn(true);
    if (state.reading.active) stopReading();
    stopSpeech();
    say("Okay — let's take the " + SITE_NOUN + " tour. One moment while I get everything ready.");
    ensureData(function (ok) {
      if (!ok || !state.data) { say("Sorry — I could not load the " + SITE_NOUN + " just now. Try again in a moment."); return; }
      var stops = IS_STORE ? buildDdsStops() : buildJdStops();
      if (!stops.length) { say("Sorry — I could not find the " + SITE_NOUN + " content just now."); return; }
      state.tour.stops = stops;
      state.tour.idx = 0;
      state.tour.active = true;
      state.tour.miss = 0;
      showTourbar(true);
      if (RecogCtor) state.tourListen = true;
      tourSay();
      if (RecogCtor) {
        window.setTimeout(function () {
          if (state.tour.active && state.tourListen && state.open) startRecog(true);
        }, 600);
      }
      if (!RecogCtor) {
        window.setTimeout(function () {
          if (state.tour.active) say("This device cannot hear you, so use the big Next button at the bottom of the chat to move through the tour.");
        }, 400);
      }
    });
  }
  function tourSay() {
    var s = state.tour.stops[state.tour.idx];
    if (!s) return;
    var st = document.getElementById('jdchat-tstatus');
    if (st) st.textContent = 'Stop ' + (state.tour.idx + 1) + ' of ' + state.tour.stops.length + (s.name ? ' — ' + s.name : '');
    var row2 = document.getElementById('jdchat-trow2');
    if (row2) row2.style.display = (s.more || s.el || s.thereUrl || s.buy) ? 'flex' : 'none';
    var buy = document.getElementById('jdchat-tbuy');
    if (buy) buy.style.display = s.buy ? '' : 'none';
    var there = document.getElementById('jdchat-tthere');
    if (there) there.style.display = (s.el || s.thereUrl) ? '' : 'none';
    say(s.say);
  }
  function tourNext() {
    if (!state.tour.active) return;
    state.tour.miss = 0;
    if (state.tour.idx < state.tour.stops.length - 1) {
      state.tour.idx++;
      stopSpeech();
      tourSay();
    } else {
      endTour(false);
      say("That's the end of the tour. Say 'tour' to hear it again, or ask me anything at all.");
    }
  }
  function tourBack() {
    if (!state.tour.active) return;
    state.tour.miss = 0;
    if (state.tour.idx > 0) state.tour.idx--;
    stopSpeech();
    tourSay();
  }
  function tourMore() {
    if (!state.tour.active) return;
    state.tour.miss = 0;
    var s = state.tour.stops[state.tour.idx];
    stopSpeech();
    say(s && s.more ? s.more : "That's everything I have on this one. Say next to keep going.");
  }
  function tourRepeat() {
    if (!state.tour.active) return;
    stopSpeech();
    tourSay();
  }
  function tourThere() {
    if (!state.tour.active) return;
    var s = state.tour.stops[state.tour.idx];
    if (!s) return;
    state.tour.miss = 0;
    stopSpeech();
    if (s.el) {
      try { s.el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); } catch (e) { s.el.scrollIntoView(); }
      var old = s.el.style.outline;
      s.el.style.outline = '3px solid #0096FF';
      window.setTimeout(function () { s.el.style.outline = old; }, 2600);
      say("Here's " + (s.name || 'it') + ', right on the page in front of you.' + (s.kind === 'product' ? " Say 'buy it' to check out, or 'next' to keep touring." : " Say 'next' to keep touring."));
    } else if (s.thereUrl) {
      var url = s.thereUrl;
      say('Taking you there now.');
      window.setTimeout(function () { window.location.href = url; }, 1100);
    } else {
      say("There's no page jump for this stop. Say next to keep going.");
    }
  }
  function tourBuy() {
    if (!state.tour.active) return;
    var s = state.tour.stops[state.tour.idx];
    if (!s || !s.buy) { say("There's nothing to buy at this stop. Say next to keep touring."); return; }
    stopSpeech();
    var url = s.buy;
    say('Opening checkout for ' + s.name + (s.price ? ', ' + s.price : '') + '.');
    state.tour.active = false;
    state.tourListen = false;
    showTourbar(false);
    stopListening();
    window.setTimeout(function () { window.location.href = url; }, 1500);
  }
  function endTour(speakBye) {
    if (!state.tour.active) return;
    state.tour.active = false;
    state.tourListen = false;
    showTourbar(false);
    stopListening();
    stopSpeech();
    if (speakBye) say("Tour stopped. I'm right here if you want anything else.");
  }
  function optionsPrompt() {
    state.tour.miss++;
    if (state.tour.miss % 2 === 1) {
      stopSpeech();
      say("You can say: next, back, tell me more, take me there, buy it, or stop.");
    }
  }

  /* ================= READ THIS PAGE ================= */
  function collectReadable() {
    var items = [];
    var seen = {};
    var nodes = document.querySelectorAll('h1, h2, article.app, main p, section p');
    nodes.forEach(function (n) {
      if (items.length >= 34) return;
      if (n.closest('#jdchat-panel')) return;
      if (n.tagName === 'ARTICLE') {
        var nm = textOf(n.querySelector('h3'));
        var pr = firstPrice(textOf(n.querySelector('.a-price')) || textOf(n));
        if (nm && !seen[nm]) { seen[nm] = 1; items.push(nm + (pr ? '. ' + pr + '.' : '.')); }
        return;
      }
      var t = textOf(n);
      if (!t) return;
      if (n.tagName === 'P') {
        if (t.length < 40) return;
        var art = n.closest('article');
        if (art) return;
        t = t.slice(0, 300);
      }
      if (!seen[t]) { seen[t] = 1; items.push(t); }
    });
    return items;
  }
  function toggleRead() {
    if (state.reading.active) { stopReading(); return; }
    if (!synth) {
      setNote('Your device cannot talk out loud, so I cannot read the page here.', false);
      return;
    }
    setVoiceOn(true);
    if (state.tour.active) endTour(false);
    var items = collectReadable();
    if (!items.length) { setNote('I could not find readable content on this page.', false); return; }
    state.reading.active = true;
    state.reading.items = items;
    state.reading.idx = 0;
    var pill = document.getElementById('jdchat-readpill');
    if (pill) { pill.textContent = 'Stop reading'; pill.classList.add('jdchat-on'); }
    setNote('Reading this page out loud — tap Stop reading or say "stop" to end it.', false);
    readStep();
  }
  function readStep() {
    if (!state.reading.active) return;
    if (state.reading.idx >= state.reading.items.length) { stopReading(); return; }
    var text = state.reading.items[state.reading.idx];
    say(text, function () {
      if (!state.reading.active) return;
      state.reading.idx++;
      readStep();
    });
  }
  function stopReading() {
    if (!state.reading.active) return;
    state.reading.active = false;
    stopSpeech();
    var pill = document.getElementById('jdchat-readpill');
    if (pill) { pill.textContent = 'Read this page'; pill.classList.remove('jdchat-on'); }
  }

  /* ================= LOW-VISION SWITCHES ================= */
  function applyVision() {
    var panel = document.getElementById('jdchat-panel');
    if (!panel) return;
    panel.classList.toggle('jdchat-big', state.bigText);
    panel.classList.toggle('jdchat-contrast', state.contrast);
    var bp = document.getElementById('jdchat-bigpill');
    if (bp) { bp.classList.toggle('jdchat-on', state.bigText); bp.setAttribute('aria-pressed', state.bigText ? 'true' : 'false'); }
    var cp = document.getElementById('jdchat-conpill');
    if (cp) { cp.classList.toggle('jdchat-on', state.contrast); cp.setAttribute('aria-pressed', state.contrast ? 'true' : 'false'); }
  }
  function toggleBig() {
    state.bigText = !state.bigText;
    prefSet('jdchat_big', state.bigText ? '1' : '0');
    applyVision();
  }
  function toggleContrast() {
    state.contrast = !state.contrast;
    prefSet('jdchat_contrast', state.contrast ? '1' : '0');
    applyVision();
  }

  /* ================= MICROPHONE ================= */
  function updateMicBtn() {
    var b = document.getElementById('jdchat-mic');
    if (b) b.classList.toggle('jdchat-live', !!(state.listening || (state.tour.active && state.tourListen)));
  }
  function startRecog(tourMode) {
    if (!RecogCtor || state.listening) return;
    var r;
    try { r = new RecogCtor(); } catch (e) { return; }
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = !!tourMode;
    r.onresult = function (ev) {
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;
        var t = ev.results[i][0].transcript.trim();
        if (!t) continue;
        if (state.tour.active) {
          if (!handleCommand(t, true)) optionsPrompt();
        } else if (!handleCommand(t, true)) {
          var inp = document.getElementById('jdchat-input');
          if (inp) inp.value = t;
          stopListening();
          sendMessage();
        }
      }
    };
    r.onend = function () {
      state.listening = false;
      updateMicBtn();
      if (state.tour.active && state.tourListen && state.open && !state.hearPaused) {
        window.setTimeout(function () {
          if (state.tour.active && state.tourListen && state.open && !state.listening) startRecog(true);
        }, 350);
      }
    };
    r.onerror = function (ev) {
      var err = ev && ev.error;
      if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' || err === 'network') {
        state.tourListen = false;
        updateMicBtn();
        if (state.tour.active) say("I can't hear you on this device — the microphone isn't available. Use the big Next button instead, or type the word next.");
      }
    };
    state.recog = r;
    state.listening = true;
    updateMicBtn();
    try { r.start(); } catch (e) { state.listening = false; updateMicBtn(); }
  }
  function stopListening() {
    state.tourListen = false;
    if (state.recog) { try { state.recog.stop(); } catch (e) { /* already stopped */ } }
    state.listening = false;
    updateMicBtn();
  }
  function micTap() {
    if (!RecogCtor) return;
    if (state.tour.active) {
      if (state.tourListen) {
        state.tourListen = false;
        if (state.recog) { try { state.recog.stop(); } catch (e) { /* already stopped */ } }
        updateMicBtn();
      } else {
        state.tourListen = true;
        startRecog(true);
        say("I'm listening. Say next, tell me more, or stop.");
      }
      return;
    }
    if (state.listening) { stopListening(); return; }
    startRecog(false);
  }

  /* ================= SPOKEN / TYPED COMMANDS ================= */
  function normCmd(text) {
    return String(text || '').toLowerCase().replace(/[!?.…,]+/g, '').replace(/\s+/g, ' ').trim();
  }
  function handleCommand(text, viaVoice) {
    var t = normCmd(text);
    if (state.tour.active) {
      if (/^(next|go on|continue|forward)$/.test(t)) { tourNext(); return true; }
      if (/^(back|previous|go back)$/.test(t)) { tourBack(); return true; }
      if (/^(tell me more|more|details|explain)$/.test(t)) { tourMore(); return true; }
      if (/^(take me there|go there|show me|take me|open it)$/.test(t)) { tourThere(); return true; }
      if (/^(buy it|buy|checkout|check out|get it)$/.test(t)) { tourBuy(); return true; }
      if (/^(stop|end tour|quit|exit|never mind|nevermind)$/.test(t)) { endTour(true); return true; }
      if (/^(repeat|say that again|again)$/.test(t)) { tourRepeat(); return true; }
      if (viaVoice) return false; /* unrecognized speech during the tour: caller prompts the options */
      /* typed non-commands during a tour fall through and post to Midas as normal */
    }
    if (/^(tour|store tour|site tour|take the tour|take me on the tour|start the tour)$/.test(t)) { startTour(); return true; }
    if (/^(read this page|read the page|read page|read it to me|read)$/.test(t)) { toggleRead(); return true; }
    if (state.reading.active && /^(stop|quit|exit|never mind|nevermind)$/.test(t)) { stopReading(); say('Stopped reading.'); return true; }
    if (/^(bigger text|big text|large text|larger text|make text bigger)$/.test(t)) { toggleBig(); return true; }
    if (/^(high contrast|contrast|more contrast)$/.test(t)) { toggleContrast(); return true; }
    return false;
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();

