// OFUSCA member portal: sign in, dues status, payment confirmation, uploads.
// Uploads are only accepted by the server after an officer has verified this
// year's dues. The checks in this file are for a friendly experience; the
// real rule lives in the database and storage policies.
(function () {
  var sb = window.OFUSCA_SB;
  var U = window.OFUSCA_UI;
  var $ = U.$;
  var BUCKET = 'member-uploads';
  var MAX_BYTES = 10 * 1024 * 1024;
  var TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
  var KIND_TYPES = {
    profile_photo: ['image/jpeg', 'image/png', 'image/webp'],
    event_photo: ['image/jpeg', 'image/png', 'image/webp'],
    document: ['application/pdf']
  };
  var user = null;
  var paid = false;
  var year = new Date().getFullYear();

  if (!sb) {
    U.say($('auth-msg'), 'The member portal is not available right now. Please try again later.', 'error');
    return;
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Please wait...'; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
    btn.disabled = on;
  }

  function pageUrl() { return window.location.origin + window.location.pathname; }

  // ---------- Views ----------
  function showView(name) {
    U.show($('auth-view'), name === 'auth');
    U.show($('recovery-view'), name === 'recovery');
    U.show($('member-view'), name === 'member');
  }

  async function render(session) {
    user = session ? session.user : null;
    if (!user) { showView('auth'); return; }
    showView('member');
    await loadMember();
  }

  // ---------- Sign in / sign up / reset ----------
  $('signin-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = e.submitter;
    busy(btn, true, 'Signing in...');
    var res = await sb.auth.signInWithPassword({
      email: $('signin-email').value.trim(),
      password: $('signin-password').value
    });
    busy(btn, false);
    if (res.error) {
      var m = /confirm/i.test(res.error.message)
        ? 'Please confirm your email first. Check your inbox for the link we sent.'
        : 'Email or password is not correct.';
      U.say($('auth-msg'), m, 'error');
    }
  });

  $('signup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = e.submitter;
    var pw = $('signup-password').value;
    if (pw.length < 8) { U.say($('auth-msg'), 'Please use a password of at least 8 characters.', 'error'); return; }
    busy(btn, true, 'Creating account...');
    var res = await sb.auth.signUp({
      email: $('signup-email').value.trim(),
      password: pw,
      options: { emailRedirectTo: pageUrl(), data: { full_name: $('signup-name').value.trim() } }
    });
    busy(btn, false);
    if (res.error) { U.say($('auth-msg'), 'Could not create the account: ' + res.error.message, 'error'); return; }
    e.target.reset();
    U.say($('auth-msg'), 'Account created. Check your email (including the spam folder) and click the confirmation link, then sign in here.', 'ok');
  });

  $('forgot-link').addEventListener('click', async function (e) {
    e.preventDefault();
    var email = $('signin-email').value.trim();
    if (!email) { U.say($('auth-msg'), 'Type your email address in the sign-in box first, then click this link again.', 'error'); return; }
    var res = await sb.auth.resetPasswordForEmail(email, { redirectTo: pageUrl() });
    U.say($('auth-msg'), res.error ? 'Could not send the reset email: ' + res.error.message
      : 'If that email has an account, a password reset link is on its way.', res.error ? 'error' : 'ok');
  });

  $('recovery-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var pw = $('recovery-password').value;
    if (pw.length < 8) { U.say($('recovery-msg'), 'Please use at least 8 characters.', 'error'); return; }
    var res = await sb.auth.updateUser({ password: pw });
    if (res.error) { U.say($('recovery-msg'), res.error.message, 'error'); return; }
    U.say($('recovery-msg'), 'Password updated.', 'ok');
    var s = await sb.auth.getSession();
    render(s.data.session);
  });

  $('signout-btn').addEventListener('click', async function () {
    await sb.auth.signOut();
  });

  // ---------- Member area ----------
  async function loadMember() {
    var prof = await sb.from('profiles').select('full_name,email,membership_status').eq('id', user.id).maybeSingle();
    var p = prof.data || {};
    $('member-name').textContent = p.full_name || p.email || user.email;
    $('member-status').textContent = p.membership_status || '';
    $('dues-year').value = year;
    await Promise.all([loadDues(), loadUploads()]);
  }

  async function loadDues() {
    var check = await sb.rpc('i_have_paid_dues');
    paid = !check.error && check.data === true;

    var list = await sb.from('payments')
      .select('payment_type,amount,currency,dues_year,payment_reference,status,created_at')
      .order('created_at', { ascending: false });
    var rows = list.data || [];
    var pending = rows.some(function (r) { return r.status === 'pending'; });

    var box = $('dues-status');
    box.className = 'dues-box ' + (paid ? 'paid' : pending ? 'pending' : 'unpaid');
    box.textContent = paid
      ? 'Your ' + year + ' dues are confirmed. Uploads are open to you.'
      : pending
        ? 'Your payment confirmation is waiting for the Treasurer or Financial Secretary to check it. Please allow 24 to 48 hours. Uploads open once it is confirmed.'
        : 'No confirmed dues for ' + year + ' yet. Pay your dues, then submit the confirmation below.';

    var tbody = $('payments-body');
    tbody.textContent = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      U.cell(tr, U.date(r.created_at));
      U.cell(tr, r.payment_type + (r.dues_year ? ' (' + r.dues_year + ')' : ''));
      U.cell(tr, U.money(r.amount, r.currency));
      U.cell(tr, r.payment_reference);
      U.cell(tr, '').appendChild(U.pill(r.status));
      tbody.appendChild(tr);
    });
    U.show($('payments-table'), rows.length > 0);

    U.show($('upload-form'), paid);
    U.show($('upload-locked'), !paid);
  }

  $('payment-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = e.submitter;
    var amount = Number($('pay-amount').value);
    if (!(amount > 0)) { U.say($('payment-msg'), 'Please enter the amount you paid.', 'error'); return; }
    var dy = parseInt($('dues-year').value, 10);
    busy(btn, true, 'Sending...');
    var res = await sb.from('payments').insert({
      member_id: user.id,
      payment_type: $('pay-type').value,
      amount: amount,
      currency: $('pay-currency').value,
      dues_year: isNaN(dy) ? null : dy,
      payment_method: $('pay-method').value,
      payment_reference: $('pay-reference').value.trim().slice(0, 200),
      notes: $('pay-notes').value.trim().slice(0, 1000)
    });
    busy(btn, false);
    if (res.error) { U.say($('payment-msg'), 'Could not save the confirmation: ' + res.error.message, 'error'); return; }
    e.target.reset();
    $('dues-year').value = year;
    U.say($('payment-msg'), 'Your payment confirmation has been received. Please allow 24 to 48 hours for an officer to check and confirm it.', 'ok');
    loadDues();
  });

  $('upload-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = e.submitter;
    var kind = $('upload-kind').value;
    var file = $('upload-file').files[0];
    if (!file) { U.say($('upload-msg'), 'Please choose a file.', 'error'); return; }
    if (file.size > MAX_BYTES) { U.say($('upload-msg'), 'Files must be 10 MB or smaller.', 'error'); return; }
    if (KIND_TYPES[kind].indexOf(file.type) === -1) {
      U.say($('upload-msg'), kind === 'document' ? 'Documents must be PDF files.' : 'Photos must be JPG, PNG or WEBP.', 'error');
      return;
    }
    // The stored name is generated here, not taken from the user's file name.
    var rand = Math.random().toString(36).slice(2, 10);
    var path = user.id + '/' + kind + '/' + Date.now() + '-' + rand + '.' + TYPES[file.type];

    busy(btn, true, 'Uploading...');
    var up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      busy(btn, false);
      var msg = /row-level security|unauthorized|403/i.test(up.error.message)
        ? 'Uploads are only open after your dues for ' + year + ' are confirmed.'
        : 'Upload failed: ' + up.error.message;
      U.say($('upload-msg'), msg, 'error');
      return;
    }
    var rec = await sb.from('member_uploads').insert({
      member_id: user.id,
      kind: kind,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      caption: $('upload-caption').value.trim().slice(0, 500)
    });
    busy(btn, false);
    if (rec.error) {
      await sb.storage.from(BUCKET).remove([path]);
      U.say($('upload-msg'), 'Upload failed: ' + rec.error.message, 'error');
      return;
    }
    e.target.reset();
    U.say($('upload-msg'), 'Uploaded. The publicity team will review it before anything is published.', 'ok');
    loadUploads();
  });

  async function loadUploads() {
    var res = await sb.from('member_uploads')
      .select('id,kind,file_name,caption,status,storage_path,created_at')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false });
    var rows = res.data || [];
    var tbody = $('uploads-body');
    tbody.textContent = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      U.cell(tr, U.date(r.created_at));
      U.cell(tr, U.kindLabel(r.kind));
      U.cell(tr, r.file_name);
      U.cell(tr, r.caption);
      U.cell(tr, '').appendChild(U.pill(r.status));
      var td = U.cell(tr, '');
      if (r.status === 'pending') {
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn ghost small';
        del.textContent = 'Remove';
        del.addEventListener('click', async function () {
          if (!window.confirm('Remove this upload?')) return;
          await sb.storage.from(BUCKET).remove([r.storage_path]);
          await sb.from('member_uploads').delete().eq('id', r.id);
          loadUploads();
        });
        td.appendChild(del);
      }
      tbody.appendChild(tr);
    });
    U.show($('uploads-table'), rows.length > 0);
    U.show($('uploads-empty'), rows.length === 0);
  }

  // ---------- Start ----------
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') { showView('recovery'); return; }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
      setTimeout(function () { render(session); }, 0);
    }
  });
})();
