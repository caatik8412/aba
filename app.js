var API_URL = 'https://script.google.com/macros/s/AKfycbxKXgdGCvkc8KSAwSnW9MZ3Bva0pJbdCqlh35xjKMlJwKXNRwo-4-71whJsl9tGf0s/exec';
var CU = null;
var CLIENTS = [];
var TASKS = [];
var DOCS = [];
var PENDING_DOCS = [];
var DD_CAT = 'all';
var GST_TICKS = {};
var TASK_TAB = 'active';
var MINE_TAB = 'active';
var AUTO_REFRESH_TIMER = null;

function api(action, data) {
  if (!data) data = {};
  var url = API_URL + '?action=' + action + '&d=' + encodeURIComponent(JSON.stringify(data));
  return fetch(url).then(function(r) { return r.json(); });
}

function doLogin() {
  var u = document.getElementById('lu').value.trim().toLowerCase();
  var p = document.getElementById('lp').value;
  var btn = document.getElementById('lbtn');
  var err = document.getElementById('le');
  err.style.display = 'none';
  if (!u || !p) { err.textContent = 'Please enter username and password.'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in...';
  api('login', { username: u, password: p }).then(function(res) {
    if (!res.ok) {
      err.textContent = res.error || 'Incorrect username or password.';
      err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Sign in';
      return;
    }
    CU = res.user;
    btn.textContent = 'Loading data...';
    return api('getAll').then(function(r) {
      if (r && r.ok) {
        CLIENTS = r.clients || [];
        TASKS = r.tasks || [];
        DOCS = r.documents || [];
        PENDING_DOCS = r.pending_docs || [];
      }
      document.getElementById('ls').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      setupShell();
      startAutoRefresh();
    });
  }).catch(function(e) {
    err.textContent = 'Error: ' + e.message;
    err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Sign in';
  });
}

function doLogout() {
  stopAutoRefresh();
  CU = null; CLIENTS = []; TASKS = []; DOCS = []; PENDING_DOCS = [];
  document.getElementById('app').style.display = 'none';
  document.getElementById('ls').style.display = 'flex';
  document.getElementById('lp').value = '';
  document.getElementById('lbtn').textContent = 'Sign in';
  document.getElementById('lbtn').disabled = false;
}

function startAutoRefresh() {
  stopAutoRefresh();
  AUTO_REFRESH_TIMER = setInterval(function() {
    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    silentRefresh();
  }, 60000);
}

function stopAutoRefresh() {
  if (AUTO_REFRESH_TIMER) { clearInterval(AUTO_REFRESH_TIMER); AUTO_REFRESH_TIMER = null; }
}

function silentRefresh() {
  api('getAll').then(function(r) {
    if (!r || !r.ok) return;
    CLIENTS = r.clients || [];
    TASKS = r.tasks || [];
    DOCS = r.documents || [];
    PENDING_DOCS = r.pending_docs || [];
    var activePage = document.querySelector('.page.active');
    if (!activePage) return;
    var pg = activePage.id.replace('p-', '');
    if (pg === 'dash')    renderDash();
    if (pg === 'tasks')   renderTasks();
    if (pg === 'mine')    renderMine();
    if (pg === 'dd')      renderDD();
    if (pg === 'pendoc')  renderPendingDocs();
    if (pg === 'clients') renderClients();
    var st = document.getElementById('st');
    if (st) {
      st.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setTimeout(function() { if (st) st.textContent = 'Live'; }, 3000);
    }
  }).catch(function() {});
}

function setSyn(v) {
  var d = document.getElementById('sd'), t = document.getElementById('st');
  if (!d) return;
  if (v) { d.classList.add('sp'); t.textContent = 'Saving...'; }
  else { d.classList.remove('sp'); t.textContent = 'Synced'; }
}

function setupShell() {
  var avm = { 'Atik Bhayani': 'av0', 'Rushiraj': 'av1', 'Sahil': 'av2' };
  var inim = { 'Atik Bhayani': 'AB', 'Rushiraj': 'RJ', 'Sahil': 'SH' };
  var av = document.getElementById('sav');
  av.textContent = inim[CU.name] || CU.initials || '?';
  av.className = 'sav ' + (avm[CU.name] || 'av1');
  document.getElementById('snm').textContent = CU.name;
  document.getElementById('srl').textContent = CU.role === 'admin' ? 'Admin' : 'Staff';
  if (CU.role === 'admin') {
    document.getElementById('na').style.display = 'block';
    document.getElementById('ns').style.display = 'none';
    nav('dash', document.querySelector('#na .nvi'));
  } else {
    document.getElementById('na').style.display = 'none';
    document.getElementById('ns').style.display = 'block';
    nav('mine', document.querySelector('#ns .nvi'));
  }
  fillCli();
}

function nav(pg, el) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nvi').forEach(function(n) { n.classList.remove('active'); });
  var p = document.getElementById('p-' + pg); if (p) p.classList.add('active');
  if (el) el.classList.add('active');
  var titles = { dash: 'Dashboard', tasks: 'Tasks', dd: 'Due Dates - FY 2026-27', gst: 'GST Compliance', cstatus: 'Compliance Status', clients: 'Clients', docs: 'Documents', pendoc: 'Pending Documents', mine: 'My Tasks' };
  document.getElementById('pgt').textContent = titles[pg] || pg;
  var a = document.getElementById('pga'); a.innerHTML = '';
  if (pg === 'tasks') a.innerHTML = '<button class="btn btnd" onclick="openTaskModal()">+ Add Task</button>';
  if (pg === 'clients') a.innerHTML = '<button class="btn btnd" onclick="openAddClient()">+ Add Client</button>';
  if (pg === 'docs') a.innerHTML = '<button class="btn btnd" onclick="openUpload()">+ Upload</button>';
  if (pg === 'dash' && CU && CU.role === 'admin') {
    a.innerHTML = '<button class="btn" onclick="openMonthTaskModal()" style="margin-right:6px">+ Monthly Tasks</button><button class="btn btnd" onclick="openYearTaskModal()">+ Yearly Tasks</button>';
  }
  if (pg === 'dash') renderDash();
  if (pg === 'tasks') { TASK_TAB = 'active'; fillCliSel('tcl'); renderTasks(); }
  if (pg === 'dd') renderDD();
  if (pg === 'gst') { initGSTFilters(); loadGST(); }
  if (pg === 'clients') renderClients();
  if (pg === 'docs') { fillDocFilter(); renderDocs(); }
  if (pg === 'pendoc') { fillCliSel('pdcl'); renderPendingDocs(); }
  if (pg === 'mine') { MINE_TAB = 'active'; fillCliSel('mcl'); renderMine(); }
  if (pg === 'cstatus') { initCSFilters(); }
}

function parseDate(d) {
  if (!d || d === '' || d === '-') return null;
  if (typeof d === 'number') return new Date(Math.round((d - 25569) * 86400 * 1000));
  if (d instanceof Date) return d;
  var s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.substring(0, 10) + 'T00:00:00');
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { var pts = s.split('/'); return new Date(pts[2] + '-' + pts[1] + '-' + pts[0] + 'T00:00:00'); }
  var dt = new Date(s); return isNaN(dt.getTime()) ? null : dt;
}
function fmt(d) { var dt = parseDate(d); if (!dt) return '-'; return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function isOD(d) { var dt = parseDate(d); return dt && dt < new Date(new Date().toDateString()); }
function isSoon(d) { var dt = parseDate(d); if (!dt) return false; var x = (dt - new Date(new Date().toDateString())) / 86400000; return x >= 0 && x <= 7; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function gc(id) { return CLIENTS.filter(function(c) { return c.id === id; })[0]; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function pComps(v) { if (Array.isArray(v)) return v; if (typeof v === 'string' && v.charAt(0) === '[') { try { return JSON.parse(v); } catch(e) {} } return []; }
function catBdg(c) { var m = { 'GST': 'bb', 'TDS': 'bg', 'Income Tax': 'ba', 'ROC / MCA': 'bp', 'PF / ESIC': 'bg', 'Audit': 'br', 'Other': 'bx' }; return '<span class="bdg ' + (m[c] || 'bx') + '">' + esc(c) + '</span>'; }
function whoBdg(w) { var m = { 'Atik Bhayani': 'bx', 'Rushiraj': 'bb', 'Sahil': 'bp' }; return '<span class="bdg ' + (m[w] || 'bx') + '">' + esc(w) + '</span>'; }
function stBdg(s) { var m = { pending: ['ba', 'Pending'], inprogress: ['bb', 'In Progress'], done: ['bg', 'Done'] }; var r = m[s] || ['bx', s]; return '<span class="bdg ' + r[0] + '">' + r[1] + '</span>'; }
function autoPriority(due, status) {
  if (status === 'done') return 'done';
  if (isOD(due))   return 'high';
  if (isSoon(due)) return 'medium';
  return 'low';
}
function pdot(p, s) {
  var m = { high: 'ph', medium: 'pm', low: 'pl' };
  return '<div class="tdot ' + (s === 'done' ? 'pd' : m[p] || 'pl') + '"></div>';
}
function smartPdot(due, status) {
  var p = autoPriority(due, status);
  var m = { high: 'ph', medium: 'pm', low: 'pl' };
  return '<div class="tdot ' + (status === 'done' ? 'pd' : m[p] || 'pl') + '"></div>';
}
function dueStyle(d, s) { if (s === 'done') return ''; if (isOD(d)) return 'style="color:var(--rd);font-weight:600"'; if (isSoon(d)) return 'style="color:var(--am);font-weight:500"'; return ''; }

function fillCli() { fillCliSel('tcl'); fillCliSel('tclient'); fillCliSel('dcli'); fillCliSel('mcl'); fillCliSel('pdcl'); fillCliSel('pdclient'); fillDocFilter(); }
function fillCliSel(id) {
  var el = document.getElementById(id); if (!el) return;
  var cur = el.value;
  var isSelect = (id === 'tclient' || id === 'dcli' || id === 'pdclient');
  el.innerHTML = (isSelect ? '<option value="">Select client</option>' : '<option value="">All clients</option>') +
    CLIENTS.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
  if (cur) el.value = cur;
}
function fillDocFilter() {
  var el = document.getElementById('dcf'); if (!el) return;
  el.innerHTML = '<option value="">All clients</option>' + CLIENTS.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
}

function getActiveColumns(m, y) {
  var isQtrEnd   = (m % 3 === 0);
  var isTdsQtr   = (m === 7 || m === 10 || m === 1 || m === 5);
  var isAdvTax   = (m === 6 || m === 9 || m === 12 || m === 3);
  var isITR      = (m >= 7 && m <= 10);
  var isAudit    = (m === 9 || m === 10);
  var isROC      = (m === 10 || m === 11);

  return [
    { type: 'GSTR-1',             label: 'GSTR-1',   rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'monthly'; } },
    { type: 'GSTR-3B',            label: 'GSTR-3B',  rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'monthly'; } },
    { type: 'GSTR-1 (Quarterly)', label: 'R1 Qtr',   rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'quarterly' && isQtrEnd; } },
    { type: 'GSTR-3B (Quarterly)',label: 'R3B Qtr',  rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'quarterly' && isQtrEnd; } },
    { type: 'PMT-06',             label: 'PMT-06',   rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'quarterly' && !isQtrEnd; } },
    { type: 'CMP-08',             label: 'CMP-08',   rule: function(c) { return c.gst_type === 'composition' && isQtrEnd; } },
    { type: 'TDS Payment',        label: 'TDS Pay',  rule: function(c) { return c.has_employees === 'yes'; } },
    { type: 'PF / ESIC',          label: 'PF/ESIC',  rule: function(c) { return c.has_employees === 'yes'; } },
    { type: 'TDS Returns',        label: 'TDS Rtn',  rule: function(c) { return c.has_employees === 'yes' && isTdsQtr; } },
    { type: 'Advance Tax',        label: 'Adv Tax',  rule: function(c) { return isAdvTax && (c.entity === 'Proprietorship' || c.entity === 'Partnership' || c.entity === 'HUF'); } },
    { type: 'ITR Filing',         label: 'ITR',      rule: function(c) { return isITR; } },
    { type: 'Tax Audit',          label: 'Tax Audit',rule: function(c) { return isAudit && c.turnover === 'above1cr'; } },
    { type: 'ROC AOC-4',          label: 'AOC-4',    rule: function(c) { return isROC && (c.entity === 'Private Limited' || c.entity === 'LLP'); } },
    { type: 'ROC MGT-7',          label: 'MGT-7',    rule: function(c) { return isROC && (c.entity === 'Private Limited' || c.entity === 'LLP'); } }
  ].filter(function(col) {
    // Only include column if at least one client matches
    return CLIENTS.some(function(c) { return col.rule(c); });
  });
}

function getTaskForCompliance(clientId, type, month, year) {
  for (var i = 0; i < TASKS.length; i++) {
    var t = TASKS[i];
    if (t.client_id === clientId &&
        t.compliance_type === type &&
        parseInt(t.period_month) === parseInt(month) &&
        parseInt(t.period_year)  === parseInt(year)) return t;
  }
  return null;
}

function checkMissingCompliance() {
  var now   = new Date();
  var month = now.getMonth() + 1;
  var year  = now.getFullYear();
  var cols  = getActiveColumns(month, year);
  var missing = 0;
  CLIENTS.forEach(function(c) {
    cols.forEach(function(col) {
      if (col.rule(c) && !getTaskForCompliance(c.id, col.type, month, year)) missing++;
    });
  });
  var el = document.getElementById('dash-missing');
  if (!el) return;
  if (missing > 0) {
    el.style.display = 'block';
    el.textContent = missing + ' compliance tasks missing this month - click to view Compliance Status';
  } else {
    el.style.display = 'none';
  }
}

function initCSFilters() {
  var ms = document.getElementById('cs-month');
  var ys = document.getElementById('cs-year');
  if (!ms || ms.options.length > 0) { loadComplianceStatus(); return; }
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach(function(m, i) { var o = document.createElement('option'); o.value = i+1; o.text = m; ms.appendChild(o); });
  var now = new Date(); ms.value = now.getMonth() + 1;
  for (var y = 2026; y <= 2028; y++) { var o = document.createElement('option'); o.value = y; o.text = y; ys.appendChild(o); }
  ys.value = now.getFullYear();
  loadComplianceStatus();
}

function loadComplianceStatus() {
  var card = document.getElementById('cs-card');
  card.innerHTML = '<div class="emp"><div class="empt">Loading...</div></div>';
  api('getAll').then(function(r) {
    if (r && r.ok) { CLIENTS = r.clients || []; TASKS = r.tasks || []; }
    renderComplianceStatus();
  }).catch(function() { renderComplianceStatus(); });
}

function renderComplianceStatus() {
  var month = parseInt(document.getElementById('cs-month').value);
  var year  = parseInt(document.getElementById('cs-year').value);
  var card  = document.getElementById('cs-card');
  var cols  = getActiveColumns(month, year);
  var mName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1];

  // Count stats
  var total = 0, done = 0, overdue = 0, pending = 0, missing = 0;
  CLIENTS.forEach(function(c) {
    cols.forEach(function(col) {
      if (!col.rule(c)) return;
      total++;
      var t = getTaskForCompliance(c.id, col.type, month, year);
      if (!t)                    { missing++; }
      else if (t.status==='done'){ done++;    }
      else if (isOD(t.due_date)) { overdue++; }
      else                       { pending++; }
    });
  });

  // Update missing badge
  var badge = document.getElementById('cs-missing-badge');
  if (badge) {
    badge.style.display = missing > 0 ? 'inline-block' : 'none';
    badge.textContent   = missing + ' missing';
  }

  // Category colors
  var catCol = { 'GST': 'bb', 'TDS': 'bg', 'Income Tax': 'ba', 'ROC / MCA': 'bp', 'PF / ESIC': 'bg', 'Audit': 'br' };
  function colCat(type) {
    if (type.indexOf('GSTR')>-1||type.indexOf('PMT')>-1||type.indexOf('CMP')>-1) return 'GST';
    if (type.indexOf('TDS')>-1)    return 'TDS';
    if (type.indexOf('PF')>-1)     return 'PF / ESIC';
    if (type.indexOf('ITR')>-1||type.indexOf('Tax Audit')>-1||type.indexOf('Adv')>-1) return 'Income Tax';
    if (type.indexOf('ROC')>-1||type.indexOf('AOC')>-1||type.indexOf('MGT')>-1) return 'ROC / MCA';
    return 'Other';
  }

  var html = '<div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  html += '<div style="font-size:13px;font-weight:600">Compliance Control - ' + mName + ' ' + year + '</div>';
  html += '<span class="bdg bg">' + done    + ' done</span>';
  html += '<span class="bdg ba">' + pending + ' pending</span>';
  html += '<span class="bdg br">' + overdue + ' overdue</span>';
  if (missing) html += '<span class="bdg bx">' + missing + ' missing</span>';
  html += '</div>';

  // Table
  html += '<div class="tw"><table><thead><tr>';
  html += '<th style="min-width:140px;position:sticky;left:0;background:var(--bg)">Client</th>';
  cols.forEach(function(col) {
    html += '<th style="text-align:center;min-width:80px"><span class="bdg ' + (catCol[colCat(col.type)]||'bx') + '">' + col.label + '</span></th>';
  });
  html += '</tr></thead><tbody>';

  CLIENTS.forEach(function(c) {
    html += '<tr><td style="font-weight:500;position:sticky;left:0;background:var(--s)">' + esc(c.short_name || c.name) + '</td>';
    cols.forEach(function(col) {
      if (!col.rule(c)) {
        html += '<td style="text-align:center;background:var(--s2);color:var(--t3)">-</td>';
        return;
      }
      var t   = getTaskForCompliance(c.id, col.type, month, year);
      var cell, bg = '';
      if (!t) {
        cell = '<button class="btn btns" style="font-size:10px;background:var(--rd-bg);color:var(--rd);border-color:#FCA5A5" data-cid="' + c.id + '" data-type="' + col.type + '" data-m="' + month + '" data-y="' + year + '" onclick="handleComplianceBtnClick(this)">+ Add</button>';
        bg = 'background:var(--rd-bg)';
      } else if (t.status === 'done') {
        cell = '<span style="color:var(--gr);font-size:20px" title="' + esc(t.remarks||'') + '">&#10003;</span>';
        bg = 'background:var(--gr-bg)';
      } else if (isOD(t.due_date)) {
        cell = '<span style="color:var(--rd);font-size:11px;font-weight:600;cursor:pointer" data-cid="' + c.id + '" data-type="' + col.type + '" data-m="' + month + '" data-y="' + year + '" onclick="handleComplianceBtnClick(this)">OVERDUE</span>';
        bg = 'background:var(--rd-bg)';
      } else if (isSoon(t.due_date)) {
        cell = '<span style="color:var(--am);font-size:11px;cursor:pointer" data-cid="' + c.id + '" data-type="' + col.type + '" data-m="' + month + '" data-y="' + year + '" onclick="handleComplianceBtnClick(this)">' + fmt(t.due_date) + '</span>';
        bg = 'background:var(--am-bg)';
      } else {
        cell = '<span style="color:var(--t2);font-size:11px">' + fmt(t.due_date) + '</span>';
      }
      html += '<td style="text-align:center;' + bg + '">' + cell + '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  card.innerHTML = html;
}

function handleComplianceBtnClick(el) {
  handleComplianceClick(el.dataset.cid, el.dataset.type, parseInt(el.dataset.m), parseInt(el.dataset.y));
}

function handleComplianceClick(clientId, type, month, year) {
  var t = getTaskForCompliance(clientId, type, month, year);
  if (t) {
    // Task exists - mark done
    if (t.status !== 'done') {
      t.status  = 'done';
      t.remarks = t.remarks || 'Marked done from Compliance Matrix';
      setSyn(true);
      api('updateTask', t).then(function() {
        setSyn(false); renderComplianceStatus();
      });
    }
  } else {
    // Task missing - create it
    createTaskFromCompliance(clientId, type, month, year);
  }
}

function generateMissingTasks() {
  var m = parseInt(document.getElementById('cs-month').value);
  var y = parseInt(document.getElementById('cs-year').value);
  var cols = getActiveColumns(m, y);
  var created = 0;
  var promises = [];
  CLIENTS.forEach(function(c) {
    cols.forEach(function(col) {
      if (col.rule(c) && !getTaskForCompliance(c.id, col.type, m, y)) {
        var nm  = m === 12 ? 1 : m + 1;
        var ny  = m === 12 ? y + 1 : y;
        var dayMap = { 'GSTR-1': 11, 'GSTR-3B': 20, 'GSTR-1 (Quarterly)': 13, 'GSTR-3B (Quarterly)': 22,
          'PMT-06': 25, 'CMP-08': 18, 'TDS Payment': 7, 'PF / ESIC': 15,
          'TDS Returns': 31, 'ITR Filing': 31, 'Tax Audit': 30,
          'ROC AOC-4': 30, 'ROC MGT-7': 29, 'Advance Tax': 15 };
        var day  = dayMap[col.type] || 20;
        var due  = ny + '-' + (nm < 10 ? '0'+nm : ''+nm) + '-' + (day < 10 ? '0'+day : ''+day);
        var mName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
        var task = {
          id: uid(), name: col.type + ' - ' + mName + ' ' + y,
          client_id: c.id, client_name: c.short_name || c.name,
          category: mapCat(col.type), assignee: 'Rushiraj',
          due_date: due, status: 'pending', priority: 'high',
          remarks: '', type: 'auto', compliance_type: col.type,
          period_month: m, period_year: y, created_by: CU.name
        };
        TASKS.push(task);
        promises.push(api('saveTask', task));
        created++;
      }
    });
  });
  if (created === 0) { alert('No missing tasks - all compliances already have tasks.'); return; }
  setSyn(true);
  Promise.all(promises).then(function() {
    setSyn(false);
    alert(created + ' tasks created successfully.');
    renderComplianceStatus();
    checkMissingCompliance();
  }).catch(function(e) { setSyn(false); alert('Error: ' + e.message); });
}

function createTaskFromCompliance(clientId, type, month, year) {
  if (getTaskForCompliance(clientId, type, month, year)) return; // duplicate check
  var c = gc(clientId); if (!c) return;
  var nm  = month === 12 ? 1 : month + 1;
  var ny  = month === 12 ? year + 1 : year;
  var dayMap = { 'GSTR-1': 11, 'GSTR-3B': 20, 'GSTR-1 (Quarterly)': 13, 'GSTR-3B (Quarterly)': 22,
    'PMT-06': 25, 'CMP-08': 18, 'TDS Payment': 7, 'PF / ESIC': 15,
    'TDS Returns': 31, 'ITR Filing': 31, 'Tax Audit': 30,
    'ROC AOC-4': 30, 'ROC MGT-7': 29, 'Advance Tax': 15 };
  var day = dayMap[type] || 20;
  var due = ny + '-' + (nm < 10 ? '0'+nm : ''+nm) + '-' + (day < 10 ? '0'+day : ''+day);
  var mName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1];
  var task = {
    id: uid(), name: type + ' - ' + mName + ' ' + year,
    client_id: clientId, client_name: c.short_name || c.name,
    category: mapCat(type), assignee: 'Rushiraj',
    due_date: due, status: 'pending', priority: 'high',
    remarks: '', type: 'auto', compliance_type: type,
    period_month: month, period_year: year, created_by: CU.name
  };
  setSyn(true);
  TASKS.push(task);
  api('saveTask', task).then(function() {
    setSyn(false); renderComplianceStatus();
  });
}

function markGSTFiled(clientId, type, month, year) {
  var t = getTaskForCompliance(clientId, type, month, year);
  if (t) {
    t.status  = 'done';
    t.remarks = 'Filed via GST module';
    api('updateTask', t);
    for (var i = 0; i < TASKS.length; i++) { if (TASKS[i].id === t.id) { TASKS[i] = t; break; } }
  } else {
    createTaskFromCompliance(clientId, type, month, year);
  }
}


function mapCat(t) {
  if (t.indexOf('GSTR') > -1 || t.indexOf('PMT') > -1 || t.indexOf('CMP') > -1) return 'GST';
  if (t.indexOf('TDS') > -1) return 'TDS';
  if (t.indexOf('PF') > -1) return 'PF / ESIC';
  if (t.indexOf('ITR') > -1 || t.indexOf('Advance') > -1 || t.indexOf('Tax Audit') > -1) return 'Income Tax';
  if (t.indexOf('ROC') > -1 || t.indexOf('AOC') > -1 || t.indexOf('MGT') > -1) return 'ROC / MCA';
  return 'Other';
}

function closeMo(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', function(e) { if (e.target.classList.contains('mo')) e.target.classList.remove('open'); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { document.querySelectorAll('.mo.open').forEach(function(m) { m.classList.remove('open'); }); } });function tickGSTRow(clientId, field, value, year, month) {
  setSyn(true);
  // Update UI immediately
  if (window.GST_RES) {
    window.GST_RES.rows.forEach(function(r) {
      if (r.id === clientId) {
        if (field === 'r1')  r.r1_filed  = value;
        if (field === 'r3b') r.r3b_filed = value;
      }
    });
    renderGSTTable(window.GST_RES);
  }
  // Save to sheet
  api('tickGST', { client_id: clientId, field: field, value: value, year: year, month: month })
    .then(function() {
      setSyn(false);
      // Link to task system
      if (value) {
        var c = gc(clientId);
        var isQtrEnd = (month % 3 === 0);
        var gstFreq  = c ? (c.gst_freq || 'monthly') : 'monthly';
        var gstType  = c ? (c.gst_type || 'regular')  : 'regular';
        var r1Type, r3Type;
        if (gstType === 'composition') {
          r1Type = 'CMP-08'; r3Type = null;
        } else if (gstFreq === 'quarterly') {
          r1Type = isQtrEnd ? 'GSTR-1 (Quarterly)' : 'IFF (Optional)';
          r3Type = isQtrEnd ? 'GSTR-3B (Quarterly)' : 'PMT-06';
        } else {
          r1Type = 'GSTR-1'; r3Type = 'GSTR-3B';
        }
        if (field === 'r1' && r1Type) markGSTFiled(clientId, r1Type, month, year);
        if (field === 'r3b' && r3Type) markGSTFiled(clientId, r3Type, month, year);
      }
      // Reload from server
      return api('getGSTCompliance', { month: month, year: year });
    })
    .then(function(res) {
      if (res && res.ok) {
        window.GST_RES = res;
        res.rows.forEach(function(r) {
          GST_TICKS[r.id+'_'+year+'_'+month+'_r1']  = r.r1_filed  || false;
          GST_TICKS[r.id+'_'+year+'_'+month+'_r3b'] = r.r3b_filed || false;
        });
        renderGSTTable(res);
      }
    })
    .catch(function() { setSyn(false); });
}


function api(action, data) {
  if (!data) data = {};
  var url = API_URL + '?action=' + action + '&d=' + encodeURIComponent(JSON.stringify(data));
  return fetch(url).then(function(r) { return r.json(); });
}

function doLogin() {
  var u = document.getElementById('lu').value.trim().toLowerCase();
  var p = document.getElementById('lp').value;
  var btn = document.getElementById('lbtn');
  var err = document.getElementById('le');
  err.style.display = 'none';
  if (!u || !p) { err.textContent = 'Please enter username and password.'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in...';
  api('login', { username: u, password: p }).then(function(res) {
    if (!res.ok) {
      err.textContent = res.error || 'Incorrect username or password.';
      err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Sign in';
      return;
    }
    CU = res.user;
    btn.textContent = 'Loading data...';
    return api('getAll').then(function(r) {
      if (r && r.ok) {
        CLIENTS = r.clients || [];
        TASKS = r.tasks || [];
        DOCS = r.documents || [];
        PENDING_DOCS = r.pending_docs || [];
      }
      document.getElementById('ls').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      setupShell();
      startAutoRefresh();
    });
  }).catch(function(e) {
    err.textContent = 'Error: ' + e.message;
    err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Sign in';
  });
}

function doLogout() {
  stopAutoRefresh();
  CU = null; CLIENTS = []; TASKS = []; DOCS = []; PENDING_DOCS = [];
  document.getElementById('app').style.display = 'none';
  document.getElementById('ls').style.display = 'flex';
  document.getElementById('lp').value = '';
  document.getElementById('lbtn').textContent = 'Sign in';
  document.getElementById('lbtn').disabled = false;
}

function startAutoRefresh() {
  stopAutoRefresh();
  AUTO_REFRESH_TIMER = setInterval(function() {
    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    silentRefresh();
  }, 60000);
}

function stopAutoRefresh() {
  if (AUTO_REFRESH_TIMER) { clearInterval(AUTO_REFRESH_TIMER); AUTO_REFRESH_TIMER = null; }
}

function silentRefresh() {
  api('getAll').then(function(r) {
    if (!r || !r.ok) return;
    CLIENTS = r.clients || [];
    TASKS = r.tasks || [];
    DOCS = r.documents || [];
    PENDING_DOCS = r.pending_docs || [];
    var activePage = document.querySelector('.page.active');
    if (!activePage) return;
    var pg = activePage.id.replace('p-', '');
    if (pg === 'dash')    renderDash();
    if (pg === 'tasks')   renderTasks();
    if (pg === 'mine')    renderMine();
    if (pg === 'dd')      renderDD();
    if (pg === 'pendoc')  renderPendingDocs();
    if (pg === 'clients') renderClients();
    var st = document.getElementById('st');
    if (st) {
      st.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setTimeout(function() { if (st) st.textContent = 'Live'; }, 3000);
    }
  }).catch(function() {});
}

function setSyn(v) {
  var d = document.getElementById('sd'), t = document.getElementById('st');
  if (!d) return;
  if (v) { d.classList.add('sp'); t.textContent = 'Saving...'; }
  else { d.classList.remove('sp'); t.textContent = 'Synced'; }
}

function setupShell() {
  var avm = { 'Atik Bhayani': 'av0', 'Rushiraj': 'av1', 'Sahil': 'av2' };
  var inim = { 'Atik Bhayani': 'AB', 'Rushiraj': 'RJ', 'Sahil': 'SH' };
  var av = document.getElementById('sav');
  av.textContent = inim[CU.name] || CU.initials || '?';
  av.className = 'sav ' + (avm[CU.name] || 'av1');
  document.getElementById('snm').textContent = CU.name;
  document.getElementById('srl').textContent = CU.role === 'admin' ? 'Admin' : 'Staff';
  if (CU.role === 'admin') {
    document.getElementById('na').style.display = 'block';
    document.getElementById('ns').style.display = 'none';
    nav('dash', document.querySelector('#na .nvi'));
  } else {
    document.getElementById('na').style.display = 'none';
    document.getElementById('ns').style.display = 'block';
    nav('mine', document.querySelector('#ns .nvi'));
  }
  fillCli();
}

function nav(pg, el) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nvi').forEach(function(n) { n.classList.remove('active'); });
  var p = document.getElementById('p-' + pg); if (p) p.classList.add('active');
  if (el) el.classList.add('active');
  var titles = { dash: 'Dashboard', tasks: 'Tasks', dd: 'Due Dates - FY 2026-27', gst: 'GST Compliance', cstatus: 'Compliance Status', clients: 'Clients', docs: 'Documents', pendoc: 'Pending Documents', mine: 'My Tasks' };
  document.getElementById('pgt').textContent = titles[pg] || pg;
  var a = document.getElementById('pga'); a.innerHTML = '';
  if (pg === 'tasks') a.innerHTML = '<button class="btn btnd" onclick="openTaskModal()">+ Add Task</button>';
  if (pg === 'clients') a.innerHTML = '<button class="btn btnd" onclick="openAddClient()">+ Add Client</button>';
  if (pg === 'docs') a.innerHTML = '<button class="btn btnd" onclick="openUpload()">+ Upload</button>';
  if (pg === 'dash' && CU && CU.role === 'admin') {
    a.innerHTML = '<button class="btn" onclick="openMonthTaskModal()" style="margin-right:6px">+ Monthly Tasks</button><button class="btn btnd" onclick="openYearTaskModal()">+ Yearly Tasks</button>';
  }
  if (pg === 'dash') renderDash();
  if (pg === 'tasks') { TASK_TAB = 'active'; fillCliSel('tcl'); renderTasks(); }
  if (pg === 'dd') renderDD();
  if (pg === 'gst') { initGSTFilters(); loadGST(); }
  if (pg === 'clients') renderClients();
  if (pg === 'docs') { fillDocFilter(); renderDocs(); }
  if (pg === 'pendoc') { fillCliSel('pdcl'); renderPendingDocs(); }
  if (pg === 'mine') { MINE_TAB = 'active'; fillCliSel('mcl'); renderMine(); }
  if (pg === 'cstatus') { initCSFilters(); }
}

function parseDate(d) {
  if (!d || d === '' || d === '-') return null;
  if (typeof d === 'number') return new Date(Math.round((d - 25569) * 86400 * 1000));
  if (d instanceof Date) return d;
  var s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.substring(0, 10) + 'T00:00:00');
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { var pts = s.split('/'); return new Date(pts[2] + '-' + pts[1] + '-' + pts[0] + 'T00:00:00'); }
  var dt = new Date(s); return isNaN(dt.getTime()) ? null : dt;
}
function fmt(d) { var dt = parseDate(d); if (!dt) return '-'; return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function isOD(d) { var dt = parseDate(d); return dt && dt < new Date(new Date().toDateString()); }
function isSoon(d) { var dt = parseDate(d); if (!dt) return false; var x = (dt - new Date(new Date().toDateString())) / 86400000; return x >= 0 && x <= 7; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function gc(id) { return CLIENTS.filter(function(c) { return c.id === id; })[0]; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function pComps(v) { if (Array.isArray(v)) return v; if (typeof v === 'string' && v.charAt(0) === '[') { try { return JSON.parse(v); } catch(e) {} } return []; }
function catBdg(c) { var m = { 'GST': 'bb', 'TDS': 'bg', 'Income Tax': 'ba', 'ROC / MCA': 'bp', 'PF / ESIC': 'bg', 'Audit': 'br', 'Other': 'bx' }; return '<span class="bdg ' + (m[c] || 'bx') + '">' + esc(c) + '</span>'; }
function whoBdg(w) { var m = { 'Atik Bhayani': 'bx', 'Rushiraj': 'bb', 'Sahil': 'bp' }; return '<span class="bdg ' + (m[w] || 'bx') + '">' + esc(w) + '</span>'; }
function stBdg(s) { var m = { pending: ['ba', 'Pending'], inprogress: ['bb', 'In Progress'], done: ['bg', 'Done'] }; var r = m[s] || ['bx', s]; return '<span class="bdg ' + r[0] + '">' + r[1] + '</span>'; }
function autoPriority(due, status) {
  if (status === 'done') return 'done';
  if (isOD(due))   return 'high';
  if (isSoon(due)) return 'medium';
  return 'low';
}
function pdot(p, s) {
  var m = { high: 'ph', medium: 'pm', low: 'pl' };
  return '<div class="tdot ' + (s === 'done' ? 'pd' : m[p] || 'pl') + '"></div>';
}
function smartPdot(due, status) {
  var p = autoPriority(due, status);
  var m = { high: 'ph', medium: 'pm', low: 'pl' };
  return '<div class="tdot ' + (status === 'done' ? 'pd' : m[p] || 'pl') + '"></div>';
}
function dueStyle(d, s) { if (s === 'done') return ''; if (isOD(d)) return 'style="color:var(--rd);font-weight:600"'; if (isSoon(d)) return 'style="color:var(--am);font-weight:500"'; return ''; }

function fillCli() { fillCliSel('tcl'); fillCliSel('tclient'); fillCliSel('dcli'); fillCliSel('mcl'); fillCliSel('pdcl'); fillCliSel('pdclient'); fillDocFilter(); }
function fillCliSel(id) {
  var el = document.getElementById(id); if (!el) return;
  var cur = el.value;
  var isSelect = (id === 'tclient' || id === 'dcli' || id === 'pdclient');
  el.innerHTML = (isSelect ? '<option value="">Select client</option>' : '<option value="">All clients</option>') +
    CLIENTS.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
  if (cur) el.value = cur;
}
function fillDocFilter() {
  var el = document.getElementById('dcf'); if (!el) return;
  el.innerHTML = '<option value="">All clients</option>' + CLIENTS.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
}

function getActiveColumns(m, y) {
  var isQtrEnd   = (m % 3 === 0);
  var isTdsQtr   = (m === 7 || m === 10 || m === 1 || m === 5);
  var isAdvTax   = (m === 6 || m === 9 || m === 12 || m === 3);
  var isITR      = (m >= 7 && m <= 10);
  var isAudit    = (m === 9 || m === 10);
  var isROC      = (m === 10 || m === 11);

  return [
    { type: 'GSTR-1',             label: 'GSTR-1',   rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'monthly'; } },
    { type: 'GSTR-3B',            label: 'GSTR-3B',  rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'monthly'; } },
    { type: 'GSTR-1 (Quarterly)', label: 'R1 Qtr',   rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'quarterly' && isQtrEnd; } },
    { type: 'GSTR-3B (Quarterly)',label: 'R3B Qtr',  rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'quarterly' && isQtrEnd; } },
    { type: 'PMT-06',             label: 'PMT-06',   rule: function(c) { return c.gst_type === 'regular' && c.gst_freq === 'quarterly' && !isQtrEnd; } },
    { type: 'CMP-08',             label: 'CMP-08',   rule: function(c) { return c.gst_type === 'composition' && isQtrEnd; } },
    { type: 'TDS Payment',        label: 'TDS Pay',  rule: function(c) { return c.has_employees === 'yes'; } },
    { type: 'PF / ESIC',          label: 'PF/ESIC',  rule: function(c) { return c.has_employees === 'yes'; } },
    { type: 'TDS Returns',        label: 'TDS Rtn',  rule: function(c) { return c.has_employees === 'yes' && isTdsQtr; } },
    { type: 'Advance Tax',        label: 'Adv Tax',  rule: function(c) { return isAdvTax && (c.entity === 'Proprietorship' || c.entity === 'Partnership' || c.entity === 'HUF'); } },
    { type: 'ITR Filing',         label: 'ITR',      rule: function(c) { return isITR; } },
    { type: 'Tax Audit',          label: 'Tax Audit',rule: function(c) { return isAudit && c.turnover === 'above1cr'; } },
    { type: 'ROC AOC-4',          label: 'AOC-4',    rule: function(c) { return isROC && (c.entity === 'Private Limited' || c.entity === 'LLP'); } },
    { type: 'ROC MGT-7',          label: 'MGT-7',    rule: function(c) { return isROC && (c.entity === 'Private Limited' || c.entity === 'LLP'); } }
  ].filter(function(col) {
    // Only include column if at least one client matches
    return CLIENTS.some(function(c) { return col.rule(c); });
  });
}

function getTaskForCompliance(clientId, type, month, year) {
  for (var i = 0; i < TASKS.length; i++) {
    var t = TASKS[i];
    if (t.client_id === clientId &&
        t.compliance_type === type &&
        parseInt(t.period_month) === parseInt(month) &&
        parseInt(t.period_year)  === parseInt(year)) return t;
  }
  return null;
}

function checkMissingCompliance() {
  var now   = new Date();
  var month = now.getMonth() + 1;
  var year  = now.getFullYear();
  var cols  = getActiveColumns(month, year);
  var missing = 0;
  CLIENTS.forEach(function(c) {
    cols.forEach(function(col) {
      if (col.rule(c) && !getTaskForCompliance(c.id, col.type, month, year)) missing++;
    });
  });
  var el = document.getElementById('dash-missing');
  if (!el) return;
  if (missing > 0) {
    el.style.display = 'block';
    el.textContent = missing + ' compliance tasks missing this month - click to view Compliance Status';
  } else {
    el.style.display = 'none';
  }
}

function initCSFilters() {
  var ms = document.getElementById('cs-month');
  var ys = document.getElementById('cs-year');
  if (!ms || ms.options.length > 0) { loadComplianceStatus(); return; }
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach(function(m, i) { var o = document.createElement('option'); o.value = i+1; o.text = m; ms.appendChild(o); });
  var now = new Date(); ms.value = now.getMonth() + 1;
  for (var y = 2026; y <= 2028; y++) { var o = document.createElement('option'); o.value = y; o.text = y; ys.appendChild(o); }
  ys.value = now.getFullYear();
  loadComplianceStatus();
}

function loadComplianceStatus() {
  var card = document.getElementById('cs-card');
  card.innerHTML = '<div class="emp"><div class="empt">Loading...</div></div>';
  api('getAll').then(function(r) {
    if (r && r.ok) { CLIENTS = r.clients || []; TASKS = r.tasks || []; }
    renderComplianceStatus();
  }).catch(function() { renderComplianceStatus(); });
}

function renderComplianceStatus() {
  var month = parseInt(document.getElementById('cs-month').value);
  var year  = parseInt(document.getElementById('cs-year').value);
  var card  = document.getElementById('cs-card');
  var cols  = getActiveColumns(month, year);
  var mName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1];

  // Count stats
  var total = 0, done = 0, overdue = 0, pending = 0, missing = 0;
  CLIENTS.forEach(function(c) {
    cols.forEach(function(col) {
      if (!col.rule(c)) return;
      total++;
      var t = getTaskForCompliance(c.id, col.type, month, year);
      if (!t)                    { missing++; }
      else if (t.status==='done'){ done++;    }
      else if (isOD(t.due_date)) { overdue++; }
      else                       { pending++; }
    });
  });

  // Update missing badge
  var badge = document.getElementById('cs-missing-badge');
  if (badge) {
    badge.style.display = missing > 0 ? 'inline-block' : 'none';
    badge.textContent   = missing + ' missing';
  }

  // Category colors
  var catCol = { 'GST': 'bb', 'TDS': 'bg', 'Income Tax': 'ba', 'ROC / MCA': 'bp', 'PF / ESIC': 'bg', 'Audit': 'br' };
  function colCat(type) {
    if (type.indexOf('GSTR')>-1||type.indexOf('PMT')>-1||type.indexOf('CMP')>-1) return 'GST';
    if (type.indexOf('TDS')>-1)    return 'TDS';
    if (type.indexOf('PF')>-1)     return 'PF / ESIC';
    if (type.indexOf('ITR')>-1||type.indexOf('Tax Audit')>-1||type.indexOf('Adv')>-1) return 'Income Tax';
    if (type.indexOf('ROC')>-1||type.indexOf('AOC')>-1||type.indexOf('MGT')>-1) return 'ROC / MCA';
    return 'Other';
  }

  var html = '<div style="margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  html += '<div style="font-size:13px;font-weight:600">Compliance Control - ' + mName + ' ' + year + '</div>';
  html += '<span class="bdg bg">' + done    + ' done</span>';
  html += '<span class="bdg ba">' + pending + ' pending</span>';
  html += '<span class="bdg br">' + overdue + ' overdue</span>';
  if (missing) html += '<span class="bdg bx">' + missing + ' missing</span>';
  html += '</div>';

  // Table
  html += '<div class="tw"><table><thead><tr>';
  html += '<th style="min-width:140px;position:sticky;left:0;background:var(--bg)">Client</th>';
  cols.forEach(function(col) {
    html += '<th style="text-align:center;min-width:80px"><span class="bdg ' + (catCol[colCat(col.type)]||'bx') + '">' + col.label + '</span></th>';
  });
  html += '</tr></thead><tbody>';

  CLIENTS.forEach(function(c) {
    html += '<tr><td style="font-weight:500;position:sticky;left:0;background:var(--s)">' + esc(c.short_name || c.name) + '</td>';
    cols.forEach(function(col) {
      if (!col.rule(c)) {
        html += '<td style="text-align:center;background:var(--s2);color:var(--t3)">-</td>';
        return;
      }
      var t   = getTaskForCompliance(c.id, col.type, month, year);
      var cell, bg = '';
      if (!t) {
        cell = '<button class="btn btns" style="font-size:10px;background:var(--rd-bg);color:var(--rd);border-color:#FCA5A5" data-cid="' + c.id + '" data-type="' + col.type + '" data-m="' + month + '" data-y="' + year + '" onclick="handleComplianceBtnClick(this)">+ Add</button>';
        bg = 'background:var(--rd-bg)';
      } else if (t.status === 'done') {
        cell = '<span style="color:var(--gr);font-size:20px" title="' + esc(t.remarks||'') + '">&#10003;</span>';
        bg = 'background:var(--gr-bg)';
      } else if (isOD(t.due_date)) {
        cell = '<span style="color:var(--rd);font-size:11px;font-weight:600;cursor:pointer" data-cid="' + c.id + '" data-type="' + col.type + '" data-m="' + month + '" data-y="' + year + '" onclick="handleComplianceBtnClick(this)">OVERDUE</span>';
        bg = 'background:var(--rd-bg)';
      } else if (isSoon(t.due_date)) {
        cell = '<span style="color:var(--am);font-size:11px;cursor:pointer" data-cid="' + c.id + '" data-type="' + col.type + '" data-m="' + month + '" data-y="' + year + '" onclick="handleComplianceBtnClick(this)">' + fmt(t.due_date) + '</span>';
        bg = 'background:var(--am-bg)';
      } else {
        cell = '<span style="color:var(--t2);font-size:11px">' + fmt(t.due_date) + '</span>';
      }
      html += '<td style="text-align:center;' + bg + '">' + cell + '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  card.innerHTML = html;
}

function handleComplianceBtnClick(el) {
  handleComplianceClick(el.dataset.cid, el.dataset.type, parseInt(el.dataset.m), parseInt(el.dataset.y));
}

function handleComplianceClick(clientId, type, month, year) {
  var t = getTaskForCompliance(clientId, type, month, year);
  if (t) {
    // Task exists - mark done
    if (t.status !== 'done') {
      t.status  = 'done';
      t.remarks = t.remarks || 'Marked done from Compliance Matrix';
      setSyn(true);
      api('updateTask', t).then(function() {
        setSyn(false); renderComplianceStatus();
      });
    }
  } else {
    // Task missing - create it
    createTaskFromCompliance(clientId, type, month, year);
  }
}

function generateMissingTasks() {
  var m = parseInt(document.getElementById('cs-month').value);
  var y = parseInt(document.getElementById('cs-year').value);
  var cols = getActiveColumns(m, y);
  var created = 0;
  var promises = [];
  CLIENTS.forEach(function(c) {
    cols.forEach(function(col) {
      if (col.rule(c) && !getTaskForCompliance(c.id, col.type, m, y)) {
        var nm  = m === 12 ? 1 : m + 1;
        var ny  = m === 12 ? y + 1 : y;
        var dayMap = { 'GSTR-1': 11, 'GSTR-3B': 20, 'GSTR-1 (Quarterly)': 13, 'GSTR-3B (Quarterly)': 22,
          'PMT-06': 25, 'CMP-08': 18, 'TDS Payment': 7, 'PF / ESIC': 15,
          'TDS Returns': 31, 'ITR Filing': 31, 'Tax Audit': 30,
          'ROC AOC-4': 30, 'ROC MGT-7': 29, 'Advance Tax': 15 };
        var day  = dayMap[col.type] || 20;
        var due  = ny + '-' + (nm < 10 ? '0'+nm : ''+nm) + '-' + (day < 10 ? '0'+day : ''+day);
        var mName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
        var task = {
          id: uid(), name: col.type + ' - ' + mName + ' ' + y,
          client_id: c.id, client_name: c.short_name || c.name,
          category: mapCat(col.type), assignee: 'Rushiraj',
          due_date: due, status: 'pending', priority: 'high',
          remarks: '', type: 'auto', compliance_type: col.type,
          period_month: m, period_year: y, created_by: CU.name
        };
        TASKS.push(task);
        promises.push(api('saveTask', task));
        created++;
      }
    });
  });
  if (created === 0) { alert('No missing tasks - all compliances already have tasks.'); return; }
  setSyn(true);
  Promise.all(promises).then(function() {
    setSyn(false);
    alert(created + ' tasks created successfully.');
    renderComplianceStatus();
    checkMissingCompliance();
  }).catch(function(e) { setSyn(false); alert('Error: ' + e.message); });
}

function createTaskFromCompliance(clientId, type, month, year) {
  if (getTaskForCompliance(clientId, type, month, year)) return; // duplicate check
  var c = gc(clientId); if (!c) return;
  var nm  = month === 12 ? 1 : month + 1;
  var ny  = month === 12 ? year + 1 : year;
  var dayMap = { 'GSTR-1': 11, 'GSTR-3B': 20, 'GSTR-1 (Quarterly)': 13, 'GSTR-3B (Quarterly)': 22,
    'PMT-06': 25, 'CMP-08': 18, 'TDS Payment': 7, 'PF / ESIC': 15,
    'TDS Returns': 31, 'ITR Filing': 31, 'Tax Audit': 30,
    'ROC AOC-4': 30, 'ROC MGT-7': 29, 'Advance Tax': 15 };
  var day = dayMap[type] || 20;
  var due = ny + '-' + (nm < 10 ? '0'+nm : ''+nm) + '-' + (day < 10 ? '0'+day : ''+day);
  var mName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1];
  var task = {
    id: uid(), name: type + ' - ' + mName + ' ' + year,
    client_id: clientId, client_name: c.short_name || c.name,
    category: mapCat(type), assignee: 'Rushiraj',
    due_date: due, status: 'pending', priority: 'high',
    remarks: '', type: 'auto', compliance_type: type,
    period_month: month, period_year: year, created_by: CU.name
  };
  setSyn(true);
  TASKS.push(task);
  api('saveTask', task).then(function() {
    setSyn(false); renderComplianceStatus();
  });
}

function markGSTFiled(clientId, type, month, year) {
  var t = getTaskForCompliance(clientId, type, month, year);
  if (t) {
    t.status  = 'done';
    t.remarks = 'Filed via GST module';
    api('updateTask', t);
    for (var i = 0; i < TASKS.length; i++) { if (TASKS[i].id === t.id) { TASKS[i] = t; break; } }
  } else {
    createTaskFromCompliance(clientId, type, month, year);
  }
}


function mapCat(t) {
  if (t.indexOf('GSTR') > -1 || t.indexOf('PMT') > -1 || t.indexOf('CMP') > -1) return 'GST';
  if (t.indexOf('TDS') > -1) return 'TDS';
  if (t.indexOf('PF') > -1) return 'PF / ESIC';
  if (t.indexOf('ITR') > -1 || t.indexOf('Advance') > -1 || t.indexOf('Tax Audit') > -1) return 'Income Tax';
  if (t.indexOf('ROC') > -1 || t.indexOf('AOC') > -1 || t.indexOf('MGT') > -1) return 'ROC / MCA';
  return 'Other';
}

function closeMo(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', function(e) { if (e.target.classList.contains('mo')) e.target.classList.remove('open'); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { document.querySelectorAll('.mo.open').forEach(function(m) { m.classList.remove('open'); }); } });
