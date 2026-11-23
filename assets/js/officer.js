// OFUSCA officer page: confirm dues payments and review member uploads.
// The database only returns other members' records to signed-in officers,
// and only officers can run the review functions. This page cannot grant
// access on its own.
(function () {
  var sb = window.OFUSCA_SB;
  var U = window.OFUSCA_UI;
  var $ = U.$;
  var BUCKET = 'member-uploads';

  if (!sb) { U.say($('officer-msg'), 'The officer page is not available right now.', 'error'); return; }

  function showView(name) {
    U.show($('officer-signin'), name === 'signin');
    U.show($('officer-denied'), name === 'denied');
    U.show($('officer-view'), name === 'officer');
  }

  async function start(session) {
    if (!session) { showView('signin'); return; }
    var role = await sb.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
    var r = role.data && role.data.role;
    if (r !== 'officer' && r !== 'admin') { showView('denied'); return; }
    showView('officer');
    $('officer-email').textContent = session.user.email;
    loadPayments();
    loadUploads();
    loadMembers();
  }

  function who(p) {
    var prof = p.profiles || {};
    return (prof.full_name || '(no name)') + (prof.email ? ' · ' + prof.email : '');
  }

  function actionButton(label, cls, handler) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small ' + cls;
    b.textContent = label;
    b.addEventListener('click', async function () {
      b.disabled = true;
      await handler();
    });
    return b;
  }

  // ---------- Payments ----------
  async function loadPayments() {
    var res = await sb.from('payments')
      .select('id,payment_type,amount,currency,dues_year,payment_method,payment_reference,notes,status,created_at,profiles(full_name,email)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (res.error) { U.say($('officer-msg'), res.error.message, 'error'); return; }
    var rows = res.data || [];
    var pendingBody = $('pending-payments-body');
    var doneBody = $('recent-payments-body');
    pendingBody.textContent = '';
    doneBody.textContent = '';
    var pendingCount = 0;

    rows.forEach(function (p) {
      var tr = document.createElement('tr');
      U.cell(tr, U.date(p.created_at));
      U.cell(tr, who(p));
      U.cell(tr, p.payment_type + (p.dues_year ? ' (' + p.dues_year + ')' : ''));
      U.cell(tr, U.money(p.amount, p.currency));
      U.cell(tr, [p.payment_method, p.payment_reference].filter(Boolean).join(' · '));
      U.cell(tr, p.notes);
      var td = U.cell(tr, '');
      if (p.status === 'pending') {
        pendingCount++;
        td.appendChild(actionButton('Confirm', 'primary', function () { return review(p.id, true); }));
        td.appendChild(actionButton('Reject', 'ghost', function () { return review(p.id, false); }));
        pendingBody.appendChild(tr);
      } else {
        td.appendChild(U.pill(p.status));
        doneBody.appendChild(tr);
      }
    });
    $('pending-count').textContent = String(pendingCount);
    U.show($('pending-empty'), pendingCount === 0);
  }

  async function review(id, approve) {
    var res = await sb.rpc('review_payment', { payment: id, approve: approve });
    if (res.error) U.say($('officer-msg'), res.error.message, 'error');
    else U.say($('officer-msg'), approve ? 'Payment confirmed. That member can now upload.' : 'Payment rejected.', 'ok');
    loadPayments();
  }

  // ---------- Uploads ----------
  async function loadUploads() {
    var res = await sb.from('member_uploads')
      .select('id,kind,file_name,caption,status,storage_path,created_at,profiles(full_name,email)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (res.error) { U.say($('officer-msg'), res.error.message, 'error'); return; }
    var rows = res.data || [];
    var tbody = $('uploads-review-body');
    tbody.textContent = '';
    rows.forEach(function (u) {
      var tr = document.createElement('tr');
      U.cell(tr, U.date(u.created_at));
      U.cell(tr, who(u));
      U.cell(tr, U.kindLabel(u.kind));
      U.cell(tr, u.caption);
      var view = U.cell(tr, '');
      view.appendChild(actionButton('Open', 'ghost', async function () {
        var s = await sb.storage.from(BUCKET).createSignedUrl(u.storage_path, 120);
        if (s.error) { U.say($('officer-msg'), s.error.message, 'error'); return; }
        window.open(s.data.signedUrl, '_blank', 'noopener');
        loadUploads();
      }));
      var td = U.cell(tr, '');
      if (u.status === 'pending') {
        td.appendChild(actionButton('Approve', 'primary', function () { return reviewUpload(u.id, true); }));
        td.appendChild(actionButton('Reject', 'ghost', function () { return reviewUpload(u.id, false); }));
      } else {
        td.appendChild(U.pill(u.status));
      }
      tbody.appendChild(tr);
    });
    U.show($('uploads-review-empty'), rows.length === 0);
  }

  async function reviewUpload(id, approve) {
    var res = await sb.rpc('review_upload', { upload: id, approve: approve });
    if (res.error) U.say($('officer-msg'), res.error.message, 'error');
    loadUploads();
  }

  // ---------- Members ----------
  async function loadMembers() {
    var res = await sb.from('profiles')
      .select('full_name,email,branch,membership_status,created_at')
      .eq('account_type', 'member')
      .order('created_at', { ascending: false })
      .limit(500);
    var rows = res.data || [];
    var tbody = $('members-body');
    tbody.textContent = '';
    rows.forEach(function (m) {
      var tr = document.createElement('tr');
      U.cell(tr, m.full_name);
      U.cell(tr, m.email);
      U.cell(tr, m.branch);
      U.cell(tr, m.membership_status);
      U.cell(tr, U.date(m.created_at));
      tbody.appendChild(tr);
    });
    $('members-count').textContent = String(rows.length);
  }

  $('officer-signout').addEventListener('click', function () { sb.auth.signOut(); });

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      setTimeout(function () { start(session); }, 0);
    }
  });
})();
