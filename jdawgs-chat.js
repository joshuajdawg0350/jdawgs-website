/* J-Dawgs live chat widget — one file, every page.
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

  var mem = {};
  function storeGet(k) {
    try { return window.sessionStorage.getItem(k); } catch (e) { return mem[k] || null; }
  }
  function storeSet(k, v) {
    mem[k] = v;
    try { window.sessionStorage.setItem(k, v); } catch (e) { /* memory fallback already set */ }
  }

  var state = {
    id: storeGet('jdchat_id') || null,
    key: storeGet('jdchat_key') || null,
    open: false,
    messages: [],
    pollTimer: null,
    sending: false
  };

  var CSS = [
    '#jdchat-btn{position:fixed;right:14px;bottom:14px;z-index:99990;display:inline-flex;align-items:center;gap:8px;',
    'min-height:48px;padding:11px 18px;border-radius:99px;border:1px solid #d7e5f2;cursor:pointer;',
    'background:linear-gradient(180deg,#e8f1fa,#9db4cc);color:#0a0f16;font:800 15px/1.2 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;',
    'box-shadow:0 6px 24px rgba(0,0,0,.5),0 0 0 1px rgba(0,150,255,.25)}',
    '#jdchat-btn .jdchat-dot{width:9px;height:9px;border-radius:50%;background:#0096FF;box-shadow:0 0 8px rgba(0,150,255,.9)}',
    '#jdchat-panel{position:fixed;right:10px;bottom:74px;z-index:99991;width:min(360px,calc(100vw - 20px));',
    'height:min(520px,calc(100dvh - 96px));display:none;flex-direction:column;overflow:hidden;',
    'background:#0b0f16;border:1px solid #33435e;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.65);',
    'font:400 15px/1.45 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#eef2f8}',
    '#jdchat-panel.jdchat-open{display:flex}',
    '#jdchat-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:11px 13px;background:linear-gradient(180deg,#0d1219,#0a0e14);border-bottom:1px solid #33435e}',
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
    '#jdchat-note{flex:0 0 auto;padding:8px 13px;font-size:12.5px;color:#9fb0c6;border-top:1px solid #263144;background:#0b0f16}',
    '#jdchat-form{flex:0 0 auto;display:flex;flex-direction:column;gap:7px;padding:10px;border-top:1px solid #33435e;background:#10151f}',
    '#jdchat-name{width:100%;box-sizing:border-box;background:#05080e;border:1px solid #263144;border-radius:9px;color:#eef2f8;padding:10px 11px;font:inherit;font-size:14px}',
    '#jdchat-inputrow{display:flex;gap:7px}',
    '#jdchat-input{flex:1;box-sizing:border-box;background:#05080e;border:1px solid #263144;border-radius:9px;color:#eef2f8;padding:10px 11px;font:inherit;font-size:14px;resize:none;max-height:96px}',
    '#jdchat-send{flex:0 0 auto;min-height:48px;padding:0 16px;border-radius:9px;border:1px solid #d7e5f2;cursor:pointer;',
    'background:linear-gradient(180deg,#e8f1fa,#9db4cc);color:#0a0f16;font:800 14px Inter,system-ui,sans-serif}',
    '#jdchat-send[disabled]{opacity:.55;cursor:default}',
    '#jdchat-name:focus,#jdchat-input:focus{outline:2px solid #0096FF;outline-offset:0}',
    '.jdchat-err{color:#ff9c9c;font-size:12.5px}'
  ].join('');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var btn = el('button', null, '');
    btn.id = 'jdchat-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Chat with us');
    var dot = el('span', 'jdchat-dot');
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode('Chat with us'));
    document.body.appendChild(btn);

    var panel = el('section');
    panel.id = 'jdchat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with J-Dawgs support');

    var head = el('div');
    head.id = 'jdchat-head';
    var titleWrap = el('div');
    var title = el('span', 'jdchat-title', 'J-Dawgs Support');
    var sub = el('span', 'jdchat-sub', 'Real answers from the J-Dawgs team');
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);
    var close = el('button', null, '×');
    close.id = 'jdchat-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close chat');
    head.appendChild(titleWrap);
    head.appendChild(close);
    panel.appendChild(head);

    var msgs = el('div');
    msgs.id = 'jdchat-msgs';
    panel.appendChild(msgs);

    var note = el('div', null, 'Ask us anything — a product question, a problem, or help posting a job.');
    note.id = 'jdchat-note';
    panel.appendChild(note);

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
    row.appendChild(send);
    form.appendChild(row);
    panel.appendChild(form);

    document.body.appendChild(panel);

    btn.addEventListener('click', function () { toggle(true); });
    close.addEventListener('click', function () { toggle(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) toggle(false); });
    form.addEventListener('submit', function (e) { e.preventDefault(); sendMessage(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    if (state.id && state.key) refresh(true);
  }

  function toggle(open) {
    state.open = open;
    var panel = document.getElementById('jdchat-panel');
    if (panel) panel.classList.toggle('jdchat-open', open);
    if (open) {
      refresh(true);
      startPoll();
      var input = document.getElementById('jdchat-input');
      if (input) input.focus();
    } else {
      stopPoll();
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
      box.appendChild(el('div', 'jdchat-row jdchat-them',
        '')).appendChild(el('div', 'jdchat-bub',
        'Hey — this is J-Dawgs support. Ask us about any product, a Human Hands job, or a problem you hit. We answer right here.'));
    }
    state.messages.forEach(function (m) {
      var row = el('div', 'jdchat-row ' + (m.from === 'visitor' ? 'jdchat-me' : 'jdchat-them'));
      row.appendChild(el('div', 'jdchat-who', m.from === 'visitor' ? 'You' : 'J-Dawgs'));
      row.appendChild(el('div', 'jdchat-bub', m.text));
      box.appendChild(row);
    });
    box.scrollTop = box.scrollHeight;
  }

  function refresh(silent) {
    if (!state.id || !state.key) { render(); return; }
    fetch(API + '?id=' + encodeURIComponent(state.id) + '&key=' + encodeURIComponent(state.key))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.chat) return;
        var changed = data.chat.messages.length !== state.messages.length;
        state.messages = data.chat.messages;
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
    state.sending = true;
    var send = document.getElementById('jdchat-send');
    if (send) send.disabled = true;

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
          if (out.status === 409) {
            // Conversation was closed server-side: start fresh.
            state.id = null; state.key = null; state.messages = [];
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
          setNote('Got it — we usually answer within a few minutes. Keep this page open or come back to this box; our reply will be right here.', false);
        }
        state.messages = out.data.chat.messages;
        input.value = '';
        render();
        startPoll();
      })
      .catch(function () {
        state.sending = false;
        if (send) send.disabled = false;
        setNote('That message did not go through — check your connection and try again.', true);
      });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
