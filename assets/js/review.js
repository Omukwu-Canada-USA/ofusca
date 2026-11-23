// OFUSCA scholarship review page: for officers, admins and scholarship reviewers.
// The database only returns applications to those roles, so this page cannot
// reveal anything to anyone else.
(function () {
  var sb = window.OFUSCA_SB;
  var U = window.OFUSCA_UI;
  var $ = U.$;
  var BUCKET = 'scholarship-docs';
  var YEAR = parseInt(document.body.getAttribute('data-award-year'), 10) || 2026;
  var STATUSES = [['submitted', 'Submitted'], ['under_review', 'Under review'], ['shortlisted', 'Shortlisted'], ['awarded', 'Awarded'], ['not_selected', 'Not selected']];
  var DOC_LABELS = { results: 'Results / certificate', course_registration: 'Course registration', enrolment_verification: 'Enrolment Verification', other: 'Other' };
  var apps = [];

  if (!sb) { U.say($('review-msg'), 'This page is not available right now.', 'error'); return; }

  function showView(name) {
    U.show($('review-signin'), name === 'signin');
    U.show($('review-denied'), name === 'denied');
    U.show($('review-main'), name === 'main');
  }

  async function start(session) {
    if (!session) { showView('signin'); return; }
    var role = await sb.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
    var r = role.data && role.data.role;
    if (['officer', 'admin', 'reviewer'].indexOf(r) === -1) { showView('denied'); return; }
    showView('main');
    $('review-user').textContent = session.user.email;
    load();
  }

  async function load() {
    var res = await sb.from('scholarship_applications')
      .select('*, scholarship_documents(id,doc_type,file_name,storage_path,created_at), scholarship_reviews(notes,reviewed_at)')
      .eq('award_year', YEAR)
      .order('submitted_at', { ascending: true });
    if (res.error) { U.say($('review-msg'), res.error.message, 'error'); return; }
    apps = res.data || [];
    render();
  }

  function text(tag, value, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    el.textContent = value == null ? '' : String(value);
    return el;
  }
  function field(dl, label, value) {
    dl.appendChild(text('dt', label));
    dl.appendChild(text('dd', value || '-'));
  }

  function render() {
    var filter = $('status-filter').value;
    var counts = {};
    STATUSES.forEach(function (s) { counts[s[0]] = 0; });
    apps.forEach(function (a) { counts[a.status]++; });
    $('review-counts').textContent = apps.length + ' application(s) · ' + STATUSES.map(function (s) { return s[1] + ': ' + counts[s[0]]; }).join(' · ');

    var list = $('review-list');
    list.textContent = '';
    apps.filter(function (a) { return !filter || a.status === filter; }).forEach(function (a) {
      var det = document.createElement('details');
      det.className = 'panel app-card';
      var sum = document.createElement('summary');
      sum.appendChild(text('strong', a.surname + ', ' + a.given_names));
      sum.appendChild(text('span', ' · ' + (a.applicant_type === 'incoming' ? 'Incoming' : 'Returning') + ' · ' + a.institution + ' · ' + a.course + ' '));
      sum.appendChild(U.pill(a.status.replace('_', ' ')));
      det.appendChild(sum);

      var dl = document.createElement('dl');
      dl.className = 'app-fields';
      field(dl, 'Submitted', U.date(a.submitted_at) + (a.updated_at !== a.submitted_at ? ' (last edited ' + U.date(a.updated_at) + ')' : ''));
      field(dl, 'Phone', a.phone);
      field(dl, 'Email', a.email);
      field(dl, 'Kindred in Omukwu', a.kindred);
      field(dl, 'Institution', a.institution);
      field(dl, 'Course', a.course);
      field(dl, 'Mode of study', a.study_mode);
      if (a.applicant_type === 'returning') {
        field(dl, 'Year started', a.year_started);
        field(dl, 'Year of study', a.year_of_study);
        field(dl, '2025/26 GPA', a.gpa);
      }
      field(dl, 'Signed by', a.signature_name);
      det.appendChild(dl);

      if (a.applicant_type === 'incoming') {
        det.appendChild(text('h4', 'Secondary school(s)'));
        det.appendChild(table(['School', 'Started', 'Completed', 'Certificate'], (a.secondary_schools || []).map(function (s) { return [s.school, s.year_started, s.year_completed, s.certificate]; })));
        det.appendChild(text('h4', 'Best 5 WAEC/NECO subjects'));
        det.appendChild(table(['Subject', 'Grade', 'Year'], (a.best_subjects || []).map(function (s) { return [s.subject, s.grade, s.year]; })));
      }

      det.appendChild(text('h4', 'Documents'));
      var docs = a.scholarship_documents || [];
      if (!docs.length) det.appendChild(text('p', 'No documents uploaded.', 'form-note'));
      docs.forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn ghost small';
        b.textContent = 'Open: ' + (DOC_LABELS[d.doc_type] || d.doc_type) + ' (' + (d.file_name || 'file') + ')';
        b.addEventListener('click', async function () {
          var s = await sb.storage.from(BUCKET).createSignedUrl(d.storage_path, 120);
          if (s.error) { U.say($('review-msg'), s.error.message, 'error'); return; }
          window.open(s.data.signedUrl, '_blank', 'noopener');
        });
        det.appendChild(b);
      });

      var rv = (a.scholarship_reviews && (Array.isArray(a.scholarship_reviews) ? a.scholarship_reviews[0] : a.scholarship_reviews)) || {};
      var box = document.createElement('div');
      box.className = 'review-box';
      box.appendChild(text('h4', 'Committee decision (applicants cannot see notes)'));
      var sel = document.createElement('select');
      STATUSES.forEach(function (s) { var o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; if (s[0] === a.status) o.selected = true; sel.appendChild(o); });
      var notes = document.createElement('textarea');
      notes.maxLength = 4000; notes.placeholder = 'Private notes for the committee'; notes.value = rv.notes || '';
      var save = document.createElement('button');
      save.type = 'button'; save.className = 'btn primary small'; save.textContent = 'Save decision';
      save.addEventListener('click', async function () {
        save.disabled = true;
        var r = await sb.rpc('review_scholarship', { application: a.id, new_status: sel.value, review_notes: notes.value });
        save.disabled = false;
        if (r.error) { U.say($('review-msg'), r.error.message, 'error'); return; }
        U.say($('review-msg'), 'Saved for ' + a.given_names + ' ' + a.surname + '.', 'ok');
        load();
      });
      box.appendChild(sel); box.appendChild(notes); box.appendChild(save);
      det.appendChild(box);
      list.appendChild(det);
    });
    U.show($('review-empty'), list.children.length === 0);
  }

  function table(headers, rows) {
    var wrap = document.createElement('div'); wrap.className = 'table-scroll';
    var t = document.createElement('table'); t.className = 'portal-table';
    var tr = document.createElement('tr');
    headers.forEach(function (h) { tr.appendChild(text('th', h)); });
    var thead = document.createElement('thead'); thead.appendChild(tr); t.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) { var row = document.createElement('tr'); r.forEach(function (c) { U.cell(row, c); }); tb.appendChild(row); });
    t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  }

  // CSV export for the committee. Cells that start with = + - @ are prefixed so
  // spreadsheet programs treat them as text, not formulas.
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $('export-csv').addEventListener('click', function () {
    var head = ['Surname', 'Given names', 'Type', 'Phone', 'Email', 'Kindred', 'Institution', 'Course', 'Mode', 'Year started', 'Year of study', 'GPA', 'Best 5 subjects', 'Secondary school', 'Documents', 'Status', 'Submitted'];
    var lines = [head.map(csvCell).join(',')];
    apps.forEach(function (a) {
      lines.push([a.surname, a.given_names, a.applicant_type, a.phone, a.email, a.kindred, a.institution, a.course, a.study_mode,
        a.year_started, a.year_of_study, a.gpa,
        (a.best_subjects || []).map(function (s) { return s.subject + ' ' + s.grade; }).join('; '),
        (a.secondary_schools || []).map(function (s) { return s.school; }).join('; '),
        (a.scholarship_documents || []).map(function (d) { return DOC_LABELS[d.doc_type] || d.doc_type; }).join('; '),
        a.status, U.date(a.submitted_at)].map(csvCell).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ofusca-scholarship-applications-' + YEAR + '.csv';
    document.body.appendChild(link); link.click(); link.remove();
  });

  $('status-filter').addEventListener('change', render);
  $('review-refresh').addEventListener('click', load);
  $('review-signout').addEventListener('click', function () { sb.auth.signOut(); });

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(function () { start(session); }, 0);
  });
})();
