// Creates one shared Supabase client for the member portal and officer pages.
// Only the public URL and publishable key are used here. Access is enforced
// by Row Level Security and storage rules in the database, not by this file.
(function () {
  var cfg = window.OFUSCA_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf('PASTE_') === 0) {
    console.warn('OFUSCA: Supabase is not configured.');
    return;
  }
  window.OFUSCA_SB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_PUBLIC_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();

// Small shared helpers. All user-provided text is written with textContent,
// never innerHTML, so names and captions cannot inject code into the page.
window.OFUSCA_UI = {
  $: function (id) { return document.getElementById(id); },
  show: function (el, on) { if (el) el.hidden = !on; },
  say: function (el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'portal-msg' + (kind ? ' ' + kind : '');
    el.hidden = !text;
  },
  cell: function (tr, text) {
    var td = document.createElement('td');
    td.textContent = text == null ? '' : String(text);
    tr.appendChild(td);
    return td;
  },
  pill: function (status) {
    var s = document.createElement('span');
    s.className = 'pill pill-' + status;
    s.textContent = status;
    return s;
  },
  date: function (iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  },
  money: function (amount, currency) {
    return Number(amount).toFixed(2) + ' ' + (currency || '');
  },
  kindLabel: function (k) {
    return { profile_photo: 'Profile / spotlight photo', document: 'Document (PDF)', event_photo: 'Event photo' }[k] || k;
  }
};
