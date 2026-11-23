// OFUSCA online scholarship application.
// The database decides who may submit, edit and upload, and enforces the
// deadline. This file only provides the form and friendly messages.
(function () {
  var sb = window.OFUSCA_SB;
  var U = window.OFUSCA_UI;
  var $ = U.$;
  var BUCKET = 'scholarship-docs';
  var YEAR = parseInt(document.body.getAttribute('data-award-year'), 10) || 2026;
  var MAX_BYTES = 10 * 1024 * 1024;
  var TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  var DOC_LABELS = {
    results: 'WAEC/NECO certificate or statement of results',
    course_registration: 'Course registration form',
    enrolment_verification: 'Enrolment Verification form (signed and stamped by HOD)',
    other: 'Other supporting document'
  };
  var REQUIRED = { incoming: ['results', 'course_registration'], returning: ['enrolment_verification'] };

  var user = null, app = null, docs = [], round = null;

  if (!sb) { U.say($('apply-msg'), 'Online applications are not available right now. Please use the PDF form and email it.', 'error'); return; }

  function pageUrl() { return window.location.origin + window.location.pathname; }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Please wait...'; }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
    btn.disabled = on;
  }
  function isOpen() {
    if (!round) return false;
    var now = Date.now();
    return now >= Date.parse(round.opens_at) && now < Date.parse(round.closes_at);
  }
  function canEdit() { return isOpen() && (!app || app.status === 'submitted'); }

  function showView(name) {
    U.show($('apply-auth'), name === 'auth');
    U.show($('apply-recovery'), name === 'recovery');
    U.show($('apply-main'), name === 'main');
  }

  // ---------- Round status ----------
  async function loadRound() {
    var r = await sb.from('scholarship_rounds').select('award_year,opens_at,closes_at').eq('award_year', YEAR).maybeSingle();
    round = r.data || null;
    var box = $('round-status');
    if (!round) { box.textContent = 'Applications for ' + YEAR + ' are not open.'; box.className = 'dues-box unpaid'; return; }
    if (isOpen()) { box.className = 'dues-box paid'; box.textContent = 'Applications are open. The online form closes at 11:59 PM Nigeria time on 1 December ' + YEAR + '.'; }
    else if (Date.now() < Date.parse(round.opens_at)) { box.className = 'dues-box pending'; box.textContent = 'Applications have not opened yet.'; }
    else { box.className = 'dues-box unpaid'; box.textContent = 'Applications for ' + YEAR + ' are now closed.'; }
  }

  // ---------- Auth ----------
  $('apply-signin').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = e.submitter; busy(btn, true, 'Signing in...');
    var res = await sb.auth.signInWithPassword({ email: $('ap-signin-email').value.trim(), password: $('ap-signin-password').value });
    busy(btn, false);
    if (res.error) U.say($('apply-msg'), /confirm/i.test(res.error.message) ? 'Please confirm your email first. Check your inbox and spam folder.' : 'Email or password is not correct.', 'error');
  });

  $('apply-signup').addEventListener('submit', async function (e) {
    e.preventDefault();
    var pw = $('ap-signup-password').value;
    if (pw.length < 8) { U.say($('apply-msg'), 'Please use a password of at least 8 characters.', 'error'); return; }
    var btn = e.submitter; busy(btn, true, 'Creating account...');
    var res = await sb.auth.signUp({
      email: $('ap-signup-email').value.trim(), password: pw,
      options: { emailRedirectTo: pageUrl(), data: { full_name: $('ap-signup-name').value.trim(), account_type: 'scholarship_applicant' } }
    });
    busy(btn, false);
    if (res.error) { U.say($('apply-msg'), 'Could not create the account: ' + res.error.message, 'error'); return; }
    e.target.reset();
    U.say($('apply-msg'), 'Account created. Check your email (including the spam folder) and click the confirmation link, then sign in here to fill the form.', 'ok');
  });

  $('ap-forgot').addEventListener('click', async function (e) {
    e.preventDefault();
    var email = $('ap-signin-email').value.trim();
    if (!email) { U.say($('apply-msg'), 'Type your email in the sign-in box first, then click this link again.', 'error'); return; }
    var res = await sb.auth.resetPasswordForEmail(email, { redirectTo: pageUrl() });
    U.say($('apply-msg'), res.error ? res.error.message : 'If that email has an account, a reset link is on its way.', res.error ? 'error' : 'ok');
  });

  $('apply-recovery-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var pw = $('ap-recovery-password').value;
    if (pw.length < 8) { U.say($('apply-recovery-msg'), 'Please use at least 8 characters.', 'error'); return; }
    var res = await sb.auth.updateUser({ password: pw });
    if (res.error) { U.say($('apply-recovery-msg'), res.error.message, 'error'); return; }
    var s = await sb.auth.getSession(); render(s.data.session);
  });

  $('ap-signout').addEventListener('click', function () { sb.auth.signOut(); });

  // ---------- Form helpers ----------
  function setType(t) {
    document.querySelectorAll('input[name="applicant_type"]').forEach(function (r) { r.checked = (r.value === t); });
    U.show($('incoming-block'), t === 'incoming');
    U.show($('returning-block'), t === 'returning');
    renderChecklist();
  }
  function currentType() {
    var r = document.querySelector('input[name="applicant_type"]:checked');
    return r ? r.value : null;
  }
  document.querySelectorAll('input[name="applicant_type"]').forEach(function (r) {
    r.addEventListener('change', function () { setType(r.value); });
  });

  function rowValues(tbodyId, fields) {
    var out = [];
    document.querySelectorAll('#' + tbodyId + ' tr').forEach(function (tr) {
      var o = {}, any = false;
      fields.forEach(function (f) {
        var v = (tr.querySelector('[data-f="' + f + '"]').value || '').trim().slice(0, 120);
        o[f] = v; if (v) any = true;
      });
      if (any) out.push(o);
    });
    return out;
  }
  function fillRows(tbodyId, fields, list) {
    var rows = document.querySelectorAll('#' + tbodyId + ' tr');
    rows.forEach(function (tr, i) {
      fields.forEach(function (f) { tr.querySelector('[data-f="' + f + '"]').value = (list[i] && list[i][f]) || ''; });
    });
  }

  function val(id) { return ($(id).value || '').trim(); }

  function fillForm(a) {
    $('f-surname').value = a.surname || '';
    $('f-given').value = a.given_names || '';
    $('f-phone').value = a.phone || '';
    $('f-email').value = a.email || (user && user.email) || '';
    $('f-kindred').value = a.kindred || '';
    $('f-institution').value = a.institution || '';
    $('f-course').value = a.course || '';
    $('f-mode').value = a.study_mode || 'Full-time';
    fillRows('schools-body', ['school', 'year_started', 'year_completed', 'certificate'], a.secondary_schools || []);
    fillRows('subjects-body', ['subject', 'grade', 'year'], a.best_subjects || []);
    $('f-year-started').value = a.year_started || '';
    $('f-year-of-study').value = a.year_of_study || '';
    $('f-gpa').value = a.gpa || '';
    $('f-declaration').checked = !!a.declaration;
    $('f-signature').value = a.signature_name || '';
    setType(a.applicant_type || 'incoming');
  }

  function lockForm(locked) {
    var form = $('application-form');
    Array.prototype.forEach.call(form.elements, function (el) { el.disabled = locked; });
  }

  // ---------- Load / save ----------
  async function render(session) {
    user = session ? session.user : null;
    if (!user) { showView('auth'); return; }
    showView('main');
    $('ap-user').textContent = user.email;
    var res = await sb.from('scholarship_applications').select('*').eq('user_id', user.id).eq('award_year', YEAR).maybeSingle();
    app = res.data || null;
    if (app) fillForm(app); else { fillForm({ email: user.email }); }
    renderAppStatus();
    lockForm(!canEdit());
    await loadDocs();
  }

  function renderAppStatus() {
    var box = $('app-status');
    var labels = { submitted: 'Submitted. The scholarship committee will review it after the deadline.', under_review: 'Under review by the scholarship committee.', shortlisted: 'Shortlisted. The committee may contact you.', awarded: 'Awarded. Congratulations! The committee will contact you with next steps.', not_selected: 'Not selected this year. Thank you for applying.' };
    if (!app) {
      box.className = 'dues-box unpaid';
      box.textContent = isOpen() ? 'You have not submitted an application yet. Fill in the form below and click Submit application.' : 'You did not submit an application for ' + YEAR + '.';
    } else {
      box.className = 'dues-box ' + (app.status === 'not_selected' ? 'unpaid' : app.status === 'submitted' ? 'pending' : 'paid');
      box.textContent = 'Status: ' + labels[app.status] + ' (submitted ' + U.date(app.submitted_at) + ').';
    }
    $('submit-btn').textContent = app ? 'Save changes' : 'Submit application';
    U.show($('docs-panel'), !!app);
  }

  $('application-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var t = currentType();
    if (!t) { U.say($('form-msg'), 'Please choose whether you are an incoming or returning student.', 'error'); return; }
    if (!$('f-declaration').checked) { U.say($('form-msg'), 'Please tick the declaration.', 'error'); return; }
    var subjects = rowValues('subjects-body', ['subject', 'grade', 'year']);
    var schools = rowValues('schools-body', ['school', 'year_started', 'year_completed', 'certificate']);
    if (t === 'incoming' && subjects.length < 5) { U.say($('form-msg'), 'Please list your best 5 subjects in WAEC or NECO with grades.', 'error'); return; }
    if (t === 'incoming' && schools.length < 1) { U.say($('form-msg'), 'Please enter the secondary school you attended.', 'error'); return; }
    var ys = parseInt(val('f-year-started'), 10);
    if (t === 'returning' && (!ys || !val('f-year-of-study') || !val('f-gpa'))) { U.say($('form-msg'), 'Please fill in year started, year of study and your 2025/26 GPA.', 'error'); return; }

    var row = {
      surname: val('f-surname'), given_names: val('f-given'), phone: val('f-phone'), email: val('f-email'),
      kindred: val('f-kindred'), applicant_type: t, institution: val('f-institution'), course: val('f-course'),
      study_mode: $('f-mode').value,
      secondary_schools: t === 'incoming' ? schools : [],
      best_subjects: t === 'incoming' ? subjects : [],
      year_started: t === 'returning' ? ys : null,
      year_of_study: t === 'returning' ? val('f-year-of-study') : null,
      gpa: t === 'returning' ? val('f-gpa') : null,
      declaration: true, signature_name: val('f-signature')
    };
    var btn = e.submitter; busy(btn, true, 'Saving...');
    var res;
    if (app) res = await sb.from('scholarship_applications').update(row).eq('id', app.id).select().maybeSingle();
    else { row.award_year = YEAR; row.user_id = user.id; res = await sb.from('scholarship_applications').insert(row).select().maybeSingle(); }
    busy(btn, false);
    if (res.error || !res.data) {
      var m = res.error ? res.error.message : 'Your application can no longer be changed.';
      if (/row-level security/i.test(m)) m = 'Applications are closed, or your application is already being reviewed.';
      U.say($('form-msg'), 'Could not save: ' + m, 'error'); return;
    }
    var first = !app;
    app = res.data;
    renderAppStatus();
    U.say($('form-msg'), first ? 'Application submitted. Now upload your documents below.' : 'Changes saved.', 'ok');
    if (first) $('docs-panel').scrollIntoView({ behavior: 'smooth' });
    renderChecklist();
  });

  // ---------- Documents ----------
  async function loadDocs() {
    if (!app) { docs = []; renderDocs(); return; }
    var res = await sb.from('scholarship_documents').select('id,doc_type,file_name,storage_path,created_at').eq('application_id', app.id).order('created_at');
    docs = res.data || [];
    renderDocs();
  }

  function renderDocs() {
    var tbody = $('docs-body');
    tbody.textContent = '';
    docs.forEach(function (d) {
      var tr = document.createElement('tr');
      U.cell(tr, DOC_LABELS[d.doc_type] || d.doc_type);
      U.cell(tr, d.file_name);
      U.cell(tr, U.date(d.created_at));
      var td = U.cell(tr, '');
      if (canEdit()) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn ghost small'; b.textContent = 'Remove';
        b.addEventListener('click', async function () {
          if (!window.confirm('Remove this document?')) return;
          await sb.from('scholarship_documents').delete().eq('id', d.id);
          await sb.storage.from(BUCKET).remove([d.storage_path]);
          loadDocs();
        });
        td.appendChild(b);
      }
      tbody.appendChild(tr);
    });
    U.show($('docs-table'), docs.length > 0);
    U.show($('doc-form'), canEdit() && !!app);
    renderChecklist();
  }

  function renderChecklist() {
    var ul = $('doc-checklist');
    if (!ul) return;
    ul.textContent = '';
    var t = currentType() || 'incoming';
    REQUIRED[t].forEach(function (k) {
      var have = docs.some(function (d) { return d.doc_type === k; });
      var li = document.createElement('li');
      li.textContent = (have ? '✓ ' : '✗ ') + DOC_LABELS[k] + (have ? '' : ' (still needed)');
      li.className = have ? 'doc-ok' : 'doc-missing';
      ul.appendChild(li);
    });
  }

  $('doc-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var kind = $('doc-type').value;
    var file = $('doc-file').files[0];
    if (!file) { U.say($('doc-msg'), 'Please choose a file.', 'error'); return; }
    if (file.size > MAX_BYTES) { U.say($('doc-msg'), 'Files must be 10 MB or smaller.', 'error'); return; }
    if (!TYPES[file.type]) { U.say($('doc-msg'), 'Please upload a PDF, JPG, PNG or WEBP file.', 'error'); return; }
    var path = user.id + '/' + kind + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + TYPES[file.type];
    var btn = e.submitter; busy(btn, true, 'Uploading...');
    var up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { busy(btn, false); U.say($('doc-msg'), 'Upload failed: ' + up.error.message, 'error'); return; }
    var rec = await sb.from('scholarship_documents').insert({ application_id: app.id, user_id: user.id, doc_type: kind, storage_path: path, file_name: file.name.slice(0, 200) });
    busy(btn, false);
    if (rec.error) { await sb.storage.from(BUCKET).remove([path]); U.say($('doc-msg'), 'Upload failed: ' + rec.error.message, 'error'); return; }
    e.target.reset();
    U.say($('doc-msg'), 'Uploaded.', 'ok');
    loadDocs();
  });

  // ---------- Start ----------
  loadRound().then(function () {
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') { showView('recovery'); return; }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(function () { render(session); }, 0);
    });
  });
})();
