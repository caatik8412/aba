var API_URL = 'https://script.google.com/macros/s/AKfycby2UX9_I23ERN6rNQlfj_sCpMSciGRl0fTOB3QpweiF86n7CYQhaS4IvnbfZ9KszcM6/exec';
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
  var titles = { dash: 'Dashboard', tasks: 'Tasks', dd: 'Due Dates - FY 2026-27', gst: 'GST Compliance', clients: 'Clients', docs: 'Documents', pendoc: 'Pending Documents', mine: 'My Tasks' };
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
function pdot(p, s) { var m = { high: 'ph', medium: 'pm', low: 'pl' }; return '<div class="tdot ' + (s === 'done' ? 'pd' : m[p] || 'pl') + '"></div>'; }
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

function renderDash() {
  var ov = TASKS.filter(function(t) { return t.status !== 'done' && isOD(t.due_date); }).length;
  var pe = TASKS.filter(function(t) { return t.status === 'pending'; }).length;
  var dn = TASKS.filter(function(t) { return t.status === 'done'; }).length;
  document.getElementById('dstat').innerHTML =
    '<div class="sc"><div class="sl">Active clients</div><div class="sv">' + CLIENTS.length + '</div></div>' +
    '<div class="sc"><div class="sl">Pending tasks</div><div class="sv" style="color:var(--am)">' + pe + '</div></div>' +
    '<div class="sc"><div class="sl">Overdue</div><div class="sv" style="color:var(--rd)">' + ov + '</div></div>' +
    '<div class="sc"><div class="sl">Completed</div><div class="sv" style="color:var(--gr)">' + dn + '</div></div>';
  var top = TASKS.filter(function(t) { return t.status !== 'done'; }).sort(function(a, b) { return new Date(a.due_date) - new Date(b.due_date); }).slice(0, 7);
  document.getElementById('dtask').innerHTML = top.length ? top.map(function(t) {
    return '<div class="trow">' + pdot(t.priority, t.status) +
      '<div style="flex:1;font-size:12px;font-weight:500">' + esc(t.name) + '</div>' +
      '<div style="color:var(--t2);font-size:12px;min-width:90px">' + esc(t.client_name || '') + '</div>' +
      whoBdg(t.assignee) +
      '<div ' + dueStyle(t.due_date, t.status) + ' style="font-size:11px;min-width:70px;text-align:right">' + fmt(t.due_date) + '</div></div>';
  }).join('') : '<div class="emp"><div class="empt">All tasks up to date</div></div>';
  document.getElementById('ddd').innerHTML = DD_DATA.filter(function(d) { return !isOD(d.date); }).slice(0, 8).map(function(d) {
    return '<div class="dlr"><div class="dld">' + d.lbl + '</div><div class="dlt">' + d.task + '</div>' +
      '<div style="color:var(--t2);font-size:11px">' + d.sum + '</div>' +
      (isSoon(d.date) ? '<span class="bdg ba">Soon</span>' : '<span class="bdg bg">OK</span>') + '</div>';
  }).join('');
  renderDashPending();
  document.getElementById('dcli').innerHTML = CLIENTS.map(function(c) {
    var comps = pComps(c.compliances);
    return '<div class="clr"><div class="clin">' + c.name.split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase() + '</div>' +
      '<div><div style="font-weight:500;font-size:13px">' + esc(c.name) + '</div><div style="font-size:11px;color:var(--t2)">' + esc(c.entity || '') + '</div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-left:auto">' + comps.slice(0, 5).map(function(x) { return '<span class="bdg bx">' + x + '</span>'; }).join('') + '</div></div>';
  }).join('');
}

function switchTaskTab(tab, el) {
  TASK_TAB = tab;
  document.querySelectorAll('#task-tabs .tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
  var addBtn = document.getElementById('add-task-btn');
  if (addBtn) addBtn.style.display = tab === 'done' ? 'none' : 'block';
  var tst = document.getElementById('tst');
  if (tst) { if (tab === 'done') { tst.value = 'done'; tst.style.display = 'none'; } else { tst.value = ''; tst.style.display = 'block'; } }
  renderTasks();
}

function renderTasks() {
  var q   = (document.getElementById('tq') || { value: '' }).value.toLowerCase();
  var fc  = (document.getElementById('tcl') || { value: '' }).value;
  var fw  = (document.getElementById('twh') || { value: '' }).value;
  var fs  = (document.getElementById('tst') || { value: '' }).value;
  var fc2 = (document.getElementById('tcat') || { value: '' }).value;
  var t   = TASKS.slice();
  if (TASK_TAB === 'done') { t = t.filter(function(x) { return x.status === 'done'; }); }
  else { t = t.filter(function(x) { return x.status !== 'done'; }); if (fs) t = t.filter(function(x) { return x.status === fs; }); }
  if (q)   t = t.filter(function(x) { return x.name.toLowerCase().indexOf(q) > -1 || (x.client_name || '').toLowerCase().indexOf(q) > -1; });
  if (fc)  t = t.filter(function(x) { return x.client_id === fc; });
  if (fw)  t = t.filter(function(x) { return x.assignee === fw; });
  if (fc2) t = t.filter(function(x) { return x.category === fc2; });
  t.sort(function(a, b) { return new Date(a.due_date) - new Date(b.due_date); });
  var isAdmin = CU && CU.role === 'admin';
  var isDoneTab = TASK_TAB === 'done';
  var body = document.getElementById('ttb'); if (!body) return;
  if (!t.length) { body.innerHTML = '<tr><td colspan="9"><div class="emp"><div class="empt">' + (isDoneTab ? 'No completed tasks yet' : 'No pending tasks') + '</div></div></td></tr>'; return; }
  var rows = '';
  t.forEach(function(tk) {
    var editBtn   = '<button class="btn btns" onclick="openEditTask(\'' + tk.id + '\')">Edit</button>';
    var doneBtn   = isDoneTab ? '' : '<button class="btn btns" onclick="mkDone(\'' + tk.id + '\')">Done</button>';
    var revertBtn = isDoneTab ? '<button class="btn btns" style="background:var(--am-bg);color:var(--am)" onclick="revertTask(\'' + tk.id + '\')">Revert</button>' : '';
    var delBtn    = isAdmin ? '<button class="btn btns btnr" onclick="delTask(\'' + tk.id + '\')">Del</button>' : '';
    rows += '<tr>' +
      '<td>' + pdot(tk.priority, tk.status) + '</td>' +
      '<td style="font-weight:500;min-width:160px">' + esc(tk.name) + '</td>' +
      '<td style="font-size:12px;color:var(--t2)">' + esc(tk.client_name || '') + '</td>' +
      '<td>' + catBdg(tk.category) + '</td>' +
      '<td>' + whoBdg(tk.assignee) + '</td>' +
      '<td ' + dueStyle(tk.due_date, tk.status) + ' style="white-space:nowrap;font-size:12px">' + fmt(tk.due_date) + '</td>' +
      '<td>' + stBdg(tk.status) + '</td>' +
      '<td><input class="ri" value="' + esc(tk.remarks || '') + '" placeholder="Add remark..." onchange="qRemark(\'' + tk.id + '\',this.value)"></td>' +
      '<td style="white-space:nowrap;display:flex;gap:4px">' + editBtn + doneBtn + revertBtn + delBtn + '</td></tr>';
  });
  body.innerHTML = rows;
}

function qRemark(id, val) {
  var t = TASKS.filter(function(x) { return x.id === id; })[0]; if (!t) return;
  t.remarks = val; setSyn(true);
  api('updateTask', t).then(function() { setSyn(false); });
}
function mkDone(id) {
  var t = TASKS.filter(function(x) { return x.id === id; })[0]; if (!t) return;
  if (!t.remarks || t.remarks.trim() === '') { alert('Please add a remark before marking done.'); return; }
  t.status = 'done'; setSyn(true);
  api('updateTask', t).then(function() { setSyn(false); renderTasks(); renderDash(); });
}
function revertTask(id) {
  var t = TASKS.filter(function(x) { return x.id === id; })[0]; if (!t) return;
  t.status = 'pending'; setSyn(true);
  api('updateTask', t).then(function() { setSyn(false); renderTasks(); renderDash(); });
}
function delTask(id) {
  if (!confirm('Delete this task?')) return;
  setSyn(true);
  api('deleteTask', { id: id }).then(function() { TASKS = TASKS.filter(function(x) { return x.id !== id; }); setSyn(false); renderTasks(); renderDash(); });
}
function openTaskModal() {
  document.getElementById('tmh').textContent = 'Add Task';
  document.getElementById('tid').value = '';
  document.getElementById('tname').value = '';
  document.getElementById('tdue').value = '';
  document.getElementById('trm').value = '';
  document.getElementById('tsts').value = 'pending';
  document.getElementById('tpri').value = 'medium';
  document.getElementById('tcat2').value = 'GST';
  var ag = document.getElementById('tag'), as = document.getElementById('tass');
  if (CU.role === 'staff') { as.value = CU.name; ag.style.display = 'none'; } else { ag.style.display = 'block'; as.value = 'Atik Bhayani'; }
  fillCliSel('tclient');
  document.getElementById('mo-task').classList.add('open');
}
function openEditTask(id) {
  var tk = TASKS.filter(function(x) { return x.id === id; })[0]; if (!tk) return;
  document.getElementById('tmh').textContent = 'Edit Task';
  document.getElementById('tid').value = tk.id;
  document.getElementById('tname').value = tk.name;
  document.getElementById('tdue').value = tk.due_date;
  document.getElementById('tcat2').value = tk.category;
  document.getElementById('tass').value = tk.assignee;
  document.getElementById('tpri').value = tk.priority;
  document.getElementById('tsts').value = tk.status;
  document.getElementById('trm').value = tk.remarks || '';
  document.getElementById('tag').style.display = 'block';
  fillCliSel('tclient');
  document.getElementById('tclient').value = tk.client_id || '';
  document.getElementById('mo-task').classList.add('open');
}
function saveTask() {
  var name = document.getElementById('tname').value.trim();
  var cid  = document.getElementById('tclient').value;
  var due  = document.getElementById('tdue').value;
  if (!name || !cid || !due) { alert('Please fill task name, client and due date.'); return; }
  var client = gc(cid);
  var assignee = CU.role === 'staff' ? CU.name : document.getElementById('tass').value;
  var eid = document.getElementById('tid').value;
  var payload = { id: eid || uid(), name: name, client_id: cid, client_name: client ? (client.short_name || client.name) : '', category: document.getElementById('tcat2').value, assignee: assignee, due_date: due, priority: document.getElementById('tpri').value, status: document.getElementById('tsts').value, remarks: document.getElementById('trm').value.trim(), type: 'manual', compliance_type: 'manual', created_by: CU.name };
  var btn = document.getElementById('tsb');
  btn.disabled = true; btn.textContent = 'Saving...'; setSyn(true);
  api('saveTask', payload).then(function() {
    if (eid) { var idx = -1; for (var i = 0; i < TASKS.length; i++) { if (TASKS[i].id === eid) { idx = i; break; } } if (idx > -1) TASKS[idx] = payload; } else { TASKS.push(payload); }
    setSyn(false); closeMo('mo-task');
    if (CU.role === 'admin') { renderTasks(); renderDash(); } else { renderMine(); }
  }).catch(function(e) { alert('Error: ' + e.message); }).then(function() { btn.disabled = false; btn.textContent = 'Save'; });
}

function switchMineTab(tab, el) {
  MINE_TAB = tab;
  document.querySelectorAll('#mine-tabs .tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
  var addBtn = document.getElementById('add-mine-btn');
  if (addBtn) addBtn.style.display = tab === 'done' ? 'none' : 'block';
  renderMine();
}
function renderMine() {
  var fc = (document.getElementById('mcl') || { value: '' }).value;
  var my = TASKS.filter(function(t) { return t.assignee === CU.name; });
  if (MINE_TAB === 'done') { my = my.filter(function(t) { return t.status === 'done'; }); }
  else { my = my.filter(function(t) { return t.status !== 'done'; }); }
  if (fc) my = my.filter(function(t) { return t.client_id === fc; });
  my.sort(function(a, b) { return new Date(a.due_date) - new Date(b.due_date); });
  var ov = TASKS.filter(function(t) { return t.assignee === CU.name && t.status !== 'done' && isOD(t.due_date); }).length;
  var sw = TASKS.filter(function(t) { return t.assignee === CU.name && t.status !== 'done' && isSoon(t.due_date); }).length;
  var dn = TASKS.filter(function(t) { return t.assignee === CU.name && t.status === 'done'; }).length;
  document.getElementById('mstat').innerHTML = '<div class="sc"><div class="sl">Overdue</div><div class="sv" style="color:var(--rd)">' + ov + '</div></div><div class="sc"><div class="sl">Due this week</div><div class="sv" style="color:var(--am)">' + sw + '</div></div><div class="sc"><div class="sl">Completed</div><div class="sv" style="color:var(--gr)">' + dn + '</div></div>';
  var isDoneTab = MINE_TAB === 'done';
  var body = document.getElementById('mtb'); if (!body) return;
  if (!my.length) { body.innerHTML = '<tr><td colspan="8"><div class="emp"><div class="empt">' + (isDoneTab ? 'No completed tasks' : 'No pending tasks') + '</div></div></td></tr>'; return; }
  var rows = '';
  my.forEach(function(tk) {
    var editBtn   = '<button class="btn btns" onclick="openEditTask(\'' + tk.id + '\')">Edit</button>';
    var doneBtn   = isDoneTab ? '' : '<button class="btn btns" onclick="stfDone(\'' + tk.id + '\')">Done</button>';
    var revertBtn = isDoneTab ? '<button class="btn btns" style="background:var(--am-bg);color:var(--am)" onclick="revertTask(\'' + tk.id + '\')">Revert</button>' : '';
    rows += '<tr>' +
      '<td>' + pdot(tk.priority, tk.status) + '</td>' +
      '<td style="font-weight:500;min-width:150px">' + esc(tk.name) + '</td>' +
      '<td style="font-size:12px;color:var(--t2)">' + esc(tk.client_name || '') + '</td>' +
      '<td>' + catBdg(tk.category) + '</td>' +
      '<td ' + dueStyle(tk.due_date, tk.status) + ' style="white-space:nowrap;font-size:12px">' + fmt(tk.due_date) + '</td>' +
      '<td>' + stBdg(tk.status) + '</td>' +
      '<td><input class="ri" value="' + esc(tk.remarks || '') + '" placeholder="Add remark..." onchange="qRemark(\'' + tk.id + '\',this.value)"></td>' +
      '<td style="white-space:nowrap;display:flex;gap:4px">' + editBtn + doneBtn + revertBtn + '</td></tr>';
  });
  body.innerHTML = rows;
}
function stfDone(id) {
  var t = TASKS.filter(function(x) { return x.id === id; })[0]; if (!t) return;
  if (!t.remarks || t.remarks.trim() === '') { alert('Please add a remark before marking done.'); return; }
  t.status = 'done'; setSyn(true);
  api('updateTask', t).then(function() { setSyn(false); renderMine(); });
}

function renderClients(q) {
  if (!q) q = '';
  var list = q ? CLIENTS.filter(function(c) { return c.name.toLowerCase().indexOf(q.toLowerCase()) > -1 || (c.pan || '').toLowerCase().indexOf(q.toLowerCase()) > -1; }) : CLIENTS.slice();
  buildCliTable(list);
}
function filterCliType(tp) { buildCliTable(tp ? CLIENTS.filter(function(c) { return c.entity === tp; }) : CLIENTS); }
function buildCliTable(list) {
  var body = document.getElementById('ctb'); if (!body) return;
  var oc = function(id) { return TASKS.filter(function(t) { return t.client_id === id && t.status !== 'done'; }).length; };
  if (!list.length) { body.innerHTML = '<tr><td colspan="8"><div class="emp"><div class="empt">No clients found</div></div></td></tr>'; return; }
  var rows = '';
  list.forEach(function(c) {
    var comps = pComps(c.compliances);
    var freq = c.gst_type === 'none' ? '<span class="bdg bx">No GST</span>' : c.gst_freq === 'quarterly' ? '<span class="bdg bp">QRMP</span>' : '<span class="bdg bb">Monthly</span>';
    rows += '<tr>' +
      '<td style="font-weight:500">' + esc(c.name) + '</td>' +
      '<td><span class="bdg bx">' + esc(c.entity || '') + '</span></td>' +
      '<td style="font-family:monospace;font-size:12px">' + (c.pan || '-') + '</td>' +
      '<td style="font-family:monospace;font-size:12px">' + (c.gstin || '-') + '</td>' +
      '<td>' + freq + '</td>' +
      '<td>' + comps.slice(0, 4).map(function(x) { return '<span class="bdg bb" style="margin:1px">' + x + '</span>'; }).join('') + (comps.length > 4 ? '<span class="bdg bx">+' + (comps.length - 4) + '</span>' : '') + '</td>' +
      '<td>' + (oc(c.id) > 0 ? '<span class="bdg ba">' + oc(c.id) + ' open</span>' : '<span class="bdg bg">Clear</span>') + '</td>' +
      '<td style="white-space:nowrap;display:flex;gap:4px"><button class="btn btns" onclick="openEditClient(\'' + c.id + '\')">Edit</button><button class="btn btns btnr" onclick="delCli(\'' + c.id + '\')">Remove</button></td></tr>';
  });
  body.innerHTML = rows;
}
function delCli(id) {
  if (!confirm('Remove this client?')) return;
  setSyn(true);
  api('deleteClient', { id: id }).then(function() { CLIENTS = CLIENTS.filter(function(c) { return c.id !== id; }); setSyn(false); renderClients(); renderDash(); fillCli(); });
}

var COMP_RULES = [
  { name: 'GSTR-1', freq: 'Monthly / Quarterly', rule: function(c) { return c.gst === 'regular' || c.gst === 'composition'; } },
  { name: 'GSTR-3B', freq: 'Monthly', rule: function(c) { return c.gst === 'regular'; } },
  { name: 'CMP-08', freq: 'Quarterly', rule: function(c) { return c.gst === 'composition'; } },
  { name: 'TDS Payment', freq: 'Monthly', rule: function(c) { return c.emp === 'yes'; } },
  { name: 'TDS Returns', freq: 'Quarterly', rule: function(c) { return c.emp === 'yes'; } },
  { name: 'PF/ESIC', freq: 'Monthly', rule: function(c) { return c.emp === 'yes'; } },
  { name: 'Professional Tax', freq: 'Monthly', rule: function(c) { return c.emp === 'yes'; } },
  { name: 'Advance Tax', freq: '4 dates/year', rule: function(c) { return c.ent === 'Proprietorship' || c.ent === 'Partnership' || c.ent === 'HUF'; } },
  { name: 'Tax Audit', freq: 'Annual', rule: function(c) { return c.tov === 'above1cr'; } },
  { name: 'ITR', freq: 'Annual', rule: function() { return true; } },
  { name: 'Statutory Audit', freq: 'Annual', rule: function(c) { return c.ent === 'Private Limited' || c.ent === 'LLP'; } },
  { name: 'ROC AOC-4', freq: 'Annual', rule: function(c) { return c.ent === 'Private Limited' || c.ent === 'LLP'; } },
  { name: 'ROC MGT-7', freq: 'Annual', rule: function(c) { return c.ent === 'Private Limited' || c.ent === 'LLP'; } }
];
function openAddClient() {
  document.getElementById('cid').value = '';
  ['cname','cpan','cgstin','ceml','cph','cnts'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('cent').value = ''; document.getElementById('cgst').value = 'regular';
  document.getElementById('cgstf').value = 'monthly'; document.getElementById('cemp').value = 'yes';
  document.getElementById('ctov').value = 'above1cr';
  document.getElementById('cmh').textContent = 'Add new client';
  document.getElementById('csb').textContent = 'Save client';
  updComps(null); document.getElementById('mo-cli').classList.add('open');
}
function openEditClient(id) {
  var c = gc(id); if (!c) return;
  document.getElementById('cid').value = c.id;
  document.getElementById('cname').value = c.name;
  document.getElementById('cpan').value = c.pan || '';
  document.getElementById('cgstin').value = c.gstin || '';
  document.getElementById('ceml').value = c.email || '';
  document.getElementById('cph').value = c.phone || '';
  document.getElementById('cnts').value = c.notes || '';
  document.getElementById('cent').value = c.entity;
  document.getElementById('cgst').value = c.gst_type || c.gst || 'regular';
  document.getElementById('cgstf').value = c.gst_freq || 'monthly';
  document.getElementById('cemp').value = c.has_employees || c.emp || 'yes';
  document.getElementById('ctov').value = c.turnover || 'above1cr';
  document.getElementById('cmh').textContent = 'Edit client';
  document.getElementById('csb').textContent = 'Update client';
  var existingComps = pComps(c.compliances);
  updComps(existingComps.length > 0 ? existingComps : null);
  document.getElementById('mo-cli').classList.add('open');
}
function updComps(existing) {
  var cfg = { gst: document.getElementById('cgst').value, emp: document.getElementById('cemp').value, tov: document.getElementById('ctov').value, ent: document.getElementById('cent').value, gstfreq: document.getElementById('cgstf').value };
  var gstNone = cfg.gst === 'none';
  document.getElementById('grow').style.display = gstNone ? 'none' : 'block';
  document.getElementById('frow').style.display = gstNone ? 'none' : 'block';
  var on = COMP_RULES.filter(function(r) { return r.rule(cfg); });
  var off = COMP_RULES.filter(function(r) { return !r.rule(cfg); });
  var checked = existing || on.map(function(r) { return r.name; });
  document.getElementById('ccnt').textContent = on.length + ' applicable';
  document.getElementById('cpl').innerHTML = on.map(function(r) {
    var cid2 = 'chk_' + r.name.replace(/[^a-zA-Z0-9]/g, '_');
    return '<div class="cpi"><input type="checkbox" id="' + cid2 + '" ' + (checked.indexOf(r.name) > -1 ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;flex-shrink:0"><div class="cpn">' + r.name + '</div><div class="cpf">' + r.freq + '</div></div>';
  }).join('') + off.map(function(r) { return '<div class="cpi" style="opacity:.35"><div style="width:16px;height:16px;border-radius:4px;background:var(--s2);flex-shrink:0"></div><div class="cpn">' + r.name + '</div><div class="cpf">Not applicable</div></div>'; }).join('');
}
function getCheckedComps() { return COMP_RULES.filter(function(r) { var el = document.getElementById('chk_' + r.name.replace(/[^a-zA-Z0-9]/g, '_')); return el && el.checked; }).map(function(r) { return r.name; }); }
function saveClient() {
  var name = document.getElementById('cname').value.trim();
  var pan = document.getElementById('cpan').value.trim().toUpperCase();
  var entity = document.getElementById('cent').value;
  if (!name || !pan || !entity) { alert('Please fill client name, PAN and entity type.'); return; }
  var comps = getCheckedComps();
  var short = name.split(' ').filter(function(w) { return w.length > 2; }).map(function(w) { return w[0]; }).join('').toUpperCase() || name.slice(0, 6);
  var eid = document.getElementById('cid').value;
  var payload = { id: eid || uid(), name: name, short_name: short, entity: entity, pan: pan, gst_type: document.getElementById('cgst').value, gst_freq: document.getElementById('cgstf').value, gstin: document.getElementById('cgstin').value.trim().toUpperCase(), has_employees: document.getElementById('cemp').value, turnover: document.getElementById('ctov').value, email: document.getElementById('ceml').value.trim(), phone: document.getElementById('cph').value.trim(), notes: document.getElementById('cnts').value.trim(), compliances: comps };
  var btn = document.getElementById('csb');
  btn.disabled = true; btn.textContent = 'Saving...'; setSyn(true);
  api('saveClient', payload).then(function() {
    if (eid) { var idx = -1; for (var i = 0; i < CLIENTS.length; i++) { if (CLIENTS[i].id === eid) { idx = i; break; } } if (idx > -1) CLIENTS[idx] = payload; } else { CLIENTS.push(payload); }
    setSyn(false); closeMo('mo-cli'); renderClients(); renderDash(); fillCli();
    alert((eid ? 'Updated' : 'Added') + ': ' + name);
  }).catch(function(e) { alert('Error: ' + e.message); }).then(function() { btn.disabled = false; btn.textContent = eid ? 'Update client' : 'Save client'; });
}

function initGSTFilters() {
  var gm = document.getElementById('gm'), gy = document.getElementById('gy');
  if (!gm || gm.options.length > 0) return;
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach(function(m, i) { var o = document.createElement('option'); o.value = i + 1; o.text = m; gm.appendChild(o); });
  var now = new Date(); gm.value = now.getMonth() + 1;
  for (var y = 2026; y <= 2028; y++) { var o = document.createElement('option'); o.value = y; o.text = y; gy.appendChild(o); }
  gy.value = now.getFullYear();
}
function loadGST() {
  var month = parseInt(document.getElementById('gm').value);
  var year  = parseInt(document.getElementById('gy').value);
  var card  = document.getElementById('gcard');
  card.innerHTML = '<div class="emp"><div class="empt">Loading...</div></div>';
  setSyn(true);
  api('getGSTCompliance', { month: month, year: year }).then(function(res) {
    setSyn(false);
    if (!res.ok) { card.innerHTML = '<div class="emp"><div class="empt">Error: ' + res.error + '</div></div>'; return; }
    res.rows.forEach(function(r) {
      var r1k = r.id + '_' + year + '_' + month + '_r1';
      var r3k = r.id + '_' + year + '_' + month + '_r3b';
      GST_TICKS[r1k] = r.r1_filed  || false;
      GST_TICKS[r3k] = r.r3b_filed || false;
    });
    renderGSTTable(res);
  }).catch(function(e) { setSyn(false); card.innerHTML = '<div class="emp"><div class="empt">Error: ' + e.message + '</div></div>'; });
}
function renderGSTTable(res) {
  var card = document.getElementById('gcard');
  if (!res.rows || !res.rows.length) { card.innerHTML = '<div class="emp"><div class="empt">No GST clients found.</div></div>'; return; }
  window.GST_RES = res;
  var monthly = res.rows.filter(function(r) { return r.gst_freq !== 'quarterly' && r.gst_freq !== 'composition'; }).length;
  var qrmp    = res.rows.filter(function(r) { return r.gst_freq === 'quarterly'; }).length;
  var comp    = res.rows.filter(function(r) { return r.gst_freq === 'composition'; }).length;
  var html = '<div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">';
  html += '<div style="font-size:13px;font-weight:600">GST Compliance - ' + res.month + '</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="bdg bb">Monthly: ' + monthly + '</span><span class="bdg bp">QRMP: ' + qrmp + '</span>';
  if (comp) html += '<span class="bdg ba">Composition: ' + comp + '</span>';
  html += '</div></div>';
  html += '<div class="tw"><table><thead><tr><th>#</th><th>Client</th><th>GSTIN</th><th>Type</th><th>GSTR-1/IFF Due</th><th style="text-align:center">R1 Filed</th><th>GSTR-3B/PMT Due</th><th style="text-align:center">3B Filed</th></tr></thead><tbody>';
  res.rows.forEach(function(r, i) {
    var isQ = r.gst_freq === 'quarterly', isCmp = r.gst_freq === 'composition';
    var typeBdg = isCmp ? '<span class="bdg ba">CMP</span>' : isQ ? '<span class="bdg bp">QRMP</span>' : '<span class="bdg bb">Monthly</span>';
    var r1Due  = r.r1Due  && r.r1Due  !== '' ? fmt(r.r1Due)  + ' (' + r.r1Label  + ')' : '-';
    var r3bDue = r.r3bDue && r.r3bDue !== '' ? fmt(r.r3bDue) + ' (' + r.r3bLabel + ')' : '-';
    var r1k = r.id + '_' + res.year + '_' + res.month + '_r1';
    var r3k = r.id + '_' + res.year + '_' + res.month + '_r3b';
    var r1chk  = GST_TICKS[r1k]  || false;
    var r3bchk = GST_TICKS[r3k]  || false;
    var bothDone = r1chk && (r.r3bDue === '' || r3bchk);
    html += '<tr' + (bothDone ? ' style="opacity:0.5"' : '') + '>';
    html += '<td>' + (i + 1) + '</td>';
    html += '<td style="font-weight:500">' + esc(r.name) + '</td>';
    html += '<td style="font-family:monospace;font-size:11px">' + esc(r.gstin || '-') + '</td>';
    html += '<td>' + typeBdg + '</td>';
    html += '<td style="font-size:12px">' + r1Due + '</td>';
    html += '<td style="text-align:center"><input type="checkbox" ' + (r1chk ? 'checked' : '') + ' onchange="tickGSTRow(\'' + r.id + '\',\'r1\',this.checked,' + res.year + ',' + res.month + ')" style="width:18px;height:18px;cursor:pointer"></td>';
    html += '<td style="font-size:12px">' + r3bDue + '</td>';
    html += '<td style="text-align:center"><input type="checkbox" ' + (r3bchk ? 'checked' : '') + ' onchange="tickGSTRow(\'' + r.id + '\',\'r3b\',this.checked,' + res.year + ',' + res.month + ')" style="width:18px;height:18px;cursor:pointer"></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  card.innerHTML = html;
}
function tickGSTRow(clientId, field, value, year, month) {
  setSyn(true);
  // Update checkbox visually immediately
  if (window.GST_RES) {
    window.GST_RES.rows.forEach(function(r) {
      if (r.id === clientId) {
        if (field === 'r1')  r.r1_filed  = value;
        if (field === 'r3b') r.r3b_filed = value;
      }
    });
    renderGSTTable(window.GST_RES);
  }
  // Save to sheet - sheet is source of truth
  api('tickGST', { client_id: clientId, field: field, value: value, year: year, month: month })
    .then(function(res) {
      setSyn(false);
      // Reload from server to confirm tick was saved correctly
      return api('getGSTCompliance', { month: month, year: year });
    })
    .then(function(res) {
      if (res && res.ok) {
        window.GST_RES = res;
        // Update local ticks cache from server
        res.rows.forEach(function(r) {
          var r1k = r.id + '_' + year + '_' + month + '_r1';
          var r3k = r.id + '_' + year + '_' + month + '_r3b';
          GST_TICKS[r1k] = r.r1_filed  || false;
          GST_TICKS[r3k] = r.r3b_filed || false;
        });
        renderGSTTable(res);
      }
    })
    .catch(function() { setSyn(false); });
}

function openMonthTaskModal() {
  var now = new Date();
  initMonthYearSelects('mt-month', 'mt-year');
  document.getElementById('mt-month').value = now.getMonth() + 1;
  document.getElementById('mt-year').value  = now.getFullYear();
  buildMonthTable();
  document.getElementById('mo-monthtask').classList.add('open');
}
function initMonthYearSelects(mid, yid) {
  var ms = document.getElementById(mid), ys = document.getElementById(yid);
  if (!ms || ms.options.length > 0) return;
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  months.forEach(function(m, i) { var o = document.createElement('option'); o.value = i + 1; o.text = m; ms.appendChild(o); });
  for (var y = 2026; y <= 2028; y++) { var o = document.createElement('option'); o.value = y; o.text = y; ys.appendChild(o); }
}
function buildMonthTable() {
  var month = parseInt(document.getElementById('mt-month').value);
  var isQE = (month % 3 === 0);
  var body = document.getElementById('mt-tbody'); if (!body) return;
  var gstClients = CLIENTS.filter(function(c) { return c.gst_type && c.gst_type !== 'none'; });
  var rows = '';
  gstClients.forEach(function(c) {
    var freq = c.gst_freq || 'monthly', gtype = c.gst_type || 'regular', hasEmp = c.has_employees === 'yes';
    var gstTasks = [];
    if (gtype === 'regular' && freq === 'monthly') gstTasks = ['GSTR-1', 'GSTR-3B'];
    else if (gtype === 'regular' && freq === 'quarterly') gstTasks = isQE ? ['GSTR-1 Qtr', 'GSTR-3B Qtr'] : ['PMT-06'];
    else if (gtype === 'composition' && isQE) gstTasks = ['CMP-08'];
    rows += '<tr><td style="font-weight:500">' + esc(c.short_name || c.name) + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (gstTasks.join(', ') || '-') + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (hasEmp ? 'Payment' : '-') + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (hasEmp ? 'Challan' : '-') + '</td>' +
      '<td><select class="btn mt-assign" style="font-size:12px" data-cid="' + c.id + '"><option value="Atik Bhayani">Atik Bhayani</option><option value="Rushiraj" selected>Rushiraj</option><option value="Sahil">Sahil</option></select></td></tr>';
  });
  body.innerHTML = rows;
}
function setAllAssign(name) { document.querySelectorAll('.mt-assign').forEach(function(s) { s.value = name; }); }
function createMonthlyTasks() {
  var month = parseInt(document.getElementById('mt-month').value);
  var year  = parseInt(document.getElementById('mt-year').value);
  var assignees = {};
  document.querySelectorAll('.mt-assign').forEach(function(s) { assignees[s.dataset.cid] = s.value; });
  var btn = document.getElementById('mt-btn');
  btn.disabled = true; btn.textContent = 'Creating...'; setSyn(true);
  api('autoTasks', { year: year, month: month, assignees: assignees }).then(function(res) {
    setSyn(false); btn.disabled = false; btn.textContent = 'Create Tasks';
    closeMo('mo-monthtask');
    if (res.ok) { alert('Created ' + res.created + ' tasks for ' + res.month); return api('getAll').then(function(r) { if (r.ok) { TASKS = r.tasks || []; renderTasks(); renderDash(); } }); }
    else { alert('Error: ' + res.error); }
  }).catch(function(e) { setSyn(false); btn.disabled = false; btn.textContent = 'Create Tasks'; alert('Error: ' + e.message); });
}

function openYearTaskModal() {
  var now = new Date();
  var ys = document.getElementById('yt-year');
  if (!ys.options.length) { for (var y = 2026; y <= 2030; y++) { var o = document.createElement('option'); o.value = y; o.text = 'FY ' + y; ys.appendChild(o); } }
  ys.value = now.getFullYear();
  buildYearTable();
  document.getElementById('mo-yeartask').classList.add('open');
}
function buildYearTable() {
  var body = document.getElementById('yt-tbody'); if (!body) return;
  var rows = '';
  CLIENTS.forEach(function(c) {
    var hasAudit = c.turnover === 'above1cr', isPvtLLP = c.entity === 'Private Limited' || c.entity === 'LLP';
    var isProp = c.entity === 'Proprietorship' || c.entity === 'Partnership' || c.entity === 'HUF', hasEmp = c.has_employees === 'yes';
    rows += '<tr><td style="font-weight:500">' + esc(c.short_name || c.name) + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (hasAudit ? '31 Oct' : '31 Aug') + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (hasAudit ? '30 Sep' : '-') + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (isPvtLLP ? 'AOC-4, MGT-7' : '-') + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (isProp ? '4 dates' : '-') + '</td>' +
      '<td style="font-size:11px;color:var(--t2)">' + (hasEmp ? '4 quarters' : '-') + '</td>' +
      '<td><select class="btn yt-assign" style="font-size:12px" data-cid="' + c.id + '"><option value="Atik Bhayani" selected>Atik Bhayani</option><option value="Rushiraj">Rushiraj</option><option value="Sahil">Sahil</option></select></td></tr>';
  });
  body.innerHTML = rows;
}
function setAllYearAssign(name) { document.querySelectorAll('.yt-assign').forEach(function(s) { s.value = name; }); }
function createYearlyTasks() {
  var year = parseInt(document.getElementById('yt-year').value);
  var assignees = {};
  document.querySelectorAll('.yt-assign').forEach(function(s) { assignees[s.dataset.cid] = s.value; });
  var btn = document.getElementById('yt-btn');
  btn.disabled = true; btn.textContent = 'Creating...'; setSyn(true);
  api('yearlyTasks', { year: year, assignees: assignees }).then(function(res) {
    setSyn(false); btn.disabled = false; btn.textContent = 'Create Tasks';
    closeMo('mo-yeartask');
    if (res.ok) { alert('Created ' + res.created + ' yearly tasks for ' + year); return api('getAll').then(function(r) { if (r.ok) { TASKS = r.tasks || []; renderTasks(); renderDash(); } }); }
    else { alert('Error: ' + res.error); }
  }).catch(function(e) { setSyn(false); btn.disabled = false; btn.textContent = 'Create Tasks'; alert('Error: ' + e.message); });
}

function renderDocs() {
  var cf = (document.getElementById('dcf') || { value: '' }).value;
  var catf = (document.getElementById('dcat') || { value: '' }).value;
  var docs = DOCS.slice();
  if (cf) docs = docs.filter(function(d) { return d.client_id === cf; });
  if (catf) docs = docs.filter(function(d) { return d.category === catf; });
  var list = document.getElementById('dl'); if (!list) return;
  if (!docs.length) { list.innerHTML = '<div class="emp"><div class="empt">No documents recorded yet</div></div>'; return; }
  list.innerHTML = docs.map(function(d) {
    return '<div class="dr"><div class="di">F</div><div><div style="font-weight:500">' + esc(d.description) + '</div><div style="font-size:11px;color:var(--t3)">' + esc(d.client_name || '') + ' - ' + d.category + ' - ' + d.financial_year + '</div></div><span class="bdg bb">' + d.category + '</span><button class="btn btns btnr" onclick="delDoc(\'' + d.id + '\')">Remove</button></div>';
  }).join('');
}
function openUpload() { fillCliSel('dcli'); document.getElementById('ddesc').value = ''; document.getElementById('dfname').value = ''; document.getElementById('mo-doc').classList.add('open'); }
function saveDoc() {
  var cid = document.getElementById('dcli').value, desc = document.getElementById('ddesc').value.trim();
  if (!cid || !desc) { alert('Please select a client and add a description.'); return; }
  var client = gc(cid);
  var payload = { id: uid(), client_id: cid, client_name: client ? (client.short_name || client.name) : '', category: document.getElementById('dcat2').value, financial_year: document.getElementById('dfy').value, description: desc, filename: document.getElementById('dfname').value.trim(), uploaded_by: CU.name };
  var btn = document.getElementById('dsb');
  btn.disabled = true; btn.textContent = 'Saving...'; setSyn(true);
  api('saveDoc', payload).then(function() { DOCS.unshift(payload); setSyn(false); closeMo('mo-doc'); renderDocs(); }).catch(function(e) { alert('Error: ' + e.message); }).then(function() { btn.disabled = false; btn.textContent = 'Save'; });
}
function delDoc(id) { if (!confirm('Remove?')) return; setSyn(true); api('deleteDoc', { id: id }).then(function() { DOCS = DOCS.filter(function(d) { return d.id !== id; }); setSyn(false); renderDocs(); }); }

function renderPendingDocs() {
  var fc = (document.getElementById('pdcl') || { value: '' }).value;
  var list = PENDING_DOCS.slice();
  if (fc) list = list.filter(function(d) { return d.client_id === fc; });
  list.sort(function(a, b) { return new Date(a.needed_by || '2099-12-31') - new Date(b.needed_by || '2099-12-31'); });
  var el = document.getElementById('pdlist'); if (!el) return;
  if (!list.length) { el.innerHTML = '<div class="emp"><div class="empt">No pending documents.</div></div>'; return; }
  var html = '';
  list.forEach(function(d) {
    var od = isOD(d.needed_by), sn = isSoon(d.needed_by);
    var cls = od ? 'br' : sn ? 'ba' : 'bx';
    var actionBtn = d.received ? '<span class="bdg bg">Received</span>' : '<button class="btn btns" style="background:var(--gr-bg);color:var(--gr)" onclick="markReceived(\'' + d.id + '\')">Mark received</button>';
    html += '<div class="dr"><div class="di" style="background:var(--am-bg);color:var(--am)">!</div>' +
      '<div style="flex:1"><div style="font-weight:500">' + esc(d.name) + '</div><div style="font-size:11px;color:var(--t2)">' + esc(d.client_name || '') + ' - ' + (d.category || '') + '</div></div>' +
      '<span class="bdg ' + cls + '">' + (d.needed_by ? fmt(d.needed_by) : 'No date') + '</span>' +
      actionBtn + '<button class="btn btns btnr" onclick="delPendingDoc(\'' + d.id + '\')">Del</button></div>';
  });
  el.innerHTML = html;
}
function renderDashPending() {
  var el = document.getElementById('dpd'); if (!el) return;
  var pending = PENDING_DOCS.filter(function(d) { return !d.received; });
  if (!pending.length) { el.innerHTML = '<div style="font-size:12px;color:var(--t2);padding:8px 0">No pending items</div>'; return; }
  el.innerHTML = pending.slice(0, 6).map(function(d) {
    var od = isOD(d.needed_by), sn = isSoon(d.needed_by);
    return '<div class="trow"><div class="tdot ' + (od ? 'ph' : sn ? 'pm' : 'pl') + '"></div><div style="flex:1;font-size:12px;font-weight:500">' + esc(d.name) + '</div><div style="color:var(--t2);font-size:12px;min-width:100px">' + esc(d.client_name || '') + '</div><div style="font-size:11px;' + (od ? 'color:var(--rd);font-weight:600' : sn ? 'color:var(--am)' : 'color:var(--t3)') + '">' + (d.needed_by ? fmt(d.needed_by) : '-') + '</div></div>';
  }).join('') + (pending.length > 6 ? '<div style="font-size:11px;color:var(--t2);padding-top:8px">+ ' + (pending.length - 6) + ' more</div>' : '');
}
function openAddPendingDoc() { document.getElementById('pdid').value = ''; document.getElementById('pdname').value = ''; document.getElementById('pddue').value = ''; document.getElementById('pdrm').value = ''; fillCliSel('pdclient'); document.getElementById('mo-pd').classList.add('open'); }
function savePendingDoc() {
  var cid = document.getElementById('pdclient').value, name = document.getElementById('pdname').value.trim();
  if (!cid || !name) { alert('Please select a client and enter document name.'); return; }
  var client = gc(cid);
  var eid = document.getElementById('pdid').value;
  var payload = { id: eid || uid(), client_id: cid, client_name: client ? (client.short_name || client.name) : '', name: name, category: document.getElementById('pdcat').value, needed_by: document.getElementById('pddue').value, remarks: document.getElementById('pdrm').value.trim(), received: false, created_by: CU.name };
  var btn = document.getElementById('pdsb');
  btn.disabled = true; btn.textContent = 'Saving...'; setSyn(true);
  api('savePendingDoc', payload).then(function() {
    if (eid) { var idx = -1; for (var i = 0; i < PENDING_DOCS.length; i++) { if (PENDING_DOCS[i].id === eid) { idx = i; break; } } if (idx > -1) PENDING_DOCS[idx] = payload; } else { PENDING_DOCS.push(payload); }
    setSyn(false); closeMo('mo-pd'); renderPendingDocs(); renderDashPending();
  }).catch(function(e) { alert('Error: ' + e.message); }).then(function() { btn.disabled = false; btn.textContent = 'Save'; });
}
function markReceived(id) { var d = PENDING_DOCS.filter(function(x) { return x.id === id; })[0]; if (!d) return; d.received = true; setSyn(true); api('savePendingDoc', d).then(function() { setSyn(false); renderPendingDocs(); renderDashPending(); }); }
function delPendingDoc(id) { if (!confirm('Delete?')) return; setSyn(true); api('deletePendingDoc', { id: id }).then(function() { PENDING_DOCS = PENDING_DOCS.filter(function(x) { return x.id !== id; }); setSyn(false); renderPendingDocs(); renderDashPending(); }); }

var DD_DATA = [
  { date: '2026-05-07', lbl: '7 May', task: 'TDS Payment - Apr 2026', category: 'TDS', sum: '3 clients' },
  { date: '2026-05-11', lbl: '11 May', task: 'GSTR-1 - Apr 2026', category: 'GST', sum: '4 clients' },
  { date: '2026-05-15', lbl: '15 May', task: 'PF / ESIC - Apr 2026', category: 'PF / ESIC', sum: '3 clients' },
  { date: '2026-05-20', lbl: '20 May', task: 'GSTR-3B - Apr 2026', category: 'GST', sum: '4 clients' },
  { date: '2026-05-31', lbl: '31 May', task: 'TDS Return Q4 FY25-26', category: 'TDS', sum: '3 clients' },
  { date: '2026-06-07', lbl: '7 Jun', task: 'TDS Payment - May 2026', category: 'TDS', sum: '3 clients' },
  { date: '2026-06-11', lbl: '11 Jun', task: 'GSTR-1 - May 2026', category: 'GST', sum: '4 clients' },
  { date: '2026-06-15', lbl: '15 Jun', task: 'PF / ESIC - May 2026', category: 'PF / ESIC', sum: '3 clients' },
  { date: '2026-06-15', lbl: '15 Jun', task: 'Advance Tax - 1st (15%)', category: 'Income Tax', sum: 'Proprietorships' },
  { date: '2026-06-20', lbl: '20 Jun', task: 'GSTR-3B - May 2026', category: 'GST', sum: '4 clients' },
  { date: '2026-07-07', lbl: '7 Jul', task: 'TDS Payment - Jun 2026', category: 'TDS', sum: '3 clients' },
  { date: '2026-07-11', lbl: '11 Jul', task: 'GSTR-1 - Jun 2026', category: 'GST', sum: '4 clients' },
  { date: '2026-07-15', lbl: '15 Jul', task: 'PF / ESIC - Jun 2026', category: 'PF / ESIC', sum: '3 clients' },
  { date: '2026-07-20', lbl: '20 Jul', task: 'GSTR-3B - Jun 2026', category: 'GST', sum: '4 clients' },
  { date: '2026-07-31', lbl: '31 Jul', task: 'TDS Return Q1 FY 2026-27', category: 'TDS', sum: '3 clients' },
  { date: '2026-08-31', lbl: '31 Aug', task: 'ITR Filing - Business clients', category: 'Income Tax', sum: 'All clients' },
  { date: '2026-09-15', lbl: '15 Sep', task: 'Advance Tax - 2nd (45%)', category: 'Income Tax', sum: 'Proprietorships' },
  { date: '2026-09-30', lbl: '30 Sep', task: 'Tax Audit Form 3CD', category: 'Audit', sum: 'Audit clients' },
  { date: '2026-10-31', lbl: '31 Oct', task: 'ITR - Audit cases + TDS Return Q2', category: 'Income Tax', sum: 'Audit clients' },
  { date: '2026-11-29', lbl: '29 Nov', task: 'ROC MGT-7 Annual Return', category: 'ROC / MCA', sum: 'Pvt Ltd / LLP' },
  { date: '2026-12-15', lbl: '15 Dec', task: 'Advance Tax - 3rd (75%)', category: 'Income Tax', sum: 'Proprietorships' },
  { date: '2027-01-31', lbl: '31 Jan', task: 'TDS Return Q3 FY 2026-27', category: 'TDS', sum: '3 clients' },
  { date: '2027-03-15', lbl: '15 Mar', task: 'Advance Tax - 4th (100%)', category: 'Income Tax', sum: 'Proprietorships' },
  { date: '2027-03-31', lbl: '31 Mar', task: 'ROC AOC-4 Financial Statements', category: 'ROC / MCA', sum: 'Pvt Ltd / LLP' },
  { date: '2027-05-31', lbl: '31 May', task: 'TDS Return Q4 FY 2026-27', category: 'TDS', sum: '3 clients' }
];

function ddTab(cat, el) {
  DD_CAT = cat;
  document.querySelectorAll('#ddt .tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderDD();
}
function renderDD() {
  var live = TASKS.filter(function(t) { return t.status !== 'done'; });
  if (DD_CAT !== 'all') live = live.filter(function(t) { return t.category === DD_CAT; });
  live.sort(function(a, b) { return new Date(a.due_date) - new Date(b.due_date); });
  var ltb = document.getElementById('livetb');
  if (ltb) {
    if (!live.length) { ltb.innerHTML = '<tr><td colspan="7"><div class="emp"><div class="empt">No pending tasks</div></div></td></tr>'; }
    else {
      ltb.innerHTML = live.slice(0, 15).map(function(tk) {
        return '<tr>' + '<td>' + pdot(tk.priority, tk.status) + '</td>' + '<td style="font-weight:500">' + esc(tk.name) + '</td>' + '<td style="font-size:12px;color:var(--t2)">' + esc(tk.client_name || '') + '</td>' + '<td>' + catBdg(tk.category) + '</td>' + '<td>' + whoBdg(tk.assignee) + '</td>' + '<td ' + dueStyle(tk.due_date, tk.status) + ' style="white-space:nowrap;font-size:12px">' + fmt(tk.due_date) + '</td>' + '<td>' + stBdg(tk.status) + '</td>' + '</tr>';
      }).join('');
    }
  }
  var items = DD_CAT === 'all' ? DD_DATA : DD_DATA.filter(function(d) { return d.category === DD_CAT; });
  var ddtb = document.getElementById('ddtb');
  if (ddtb) {
    ddtb.innerHTML = items.map(function(d) {
      var od = isOD(d.date), sn = isSoon(d.date);
      return '<tr>' + '<td style="font-weight:600;white-space:nowrap;' + (od ? 'color:var(--rd)' : sn ? 'color:var(--am)' : 'color:var(--bl)') + '">' + fmt(d.date) + '</td>' + '<td style="font-weight:500">' + d.task + '</td>' + '<td>' + catBdg(d.category) + '</td>' + '<td style="font-size:12px;color:var(--t2)">' + d.sum + '</td>' + '<td>' + (od ? '<span class="bdg br">Overdue</span>' : sn ? '<span class="bdg ba">Due soon</span>' : '<span class="bdg bg">Upcoming</span>') + '</td>' + '</tr>';
    }).join('');
  }
}

function closeMo(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', function(e) { if (e.target.classList.contains('mo')) e.target.classList.remove('open'); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { document.querySelectorAll('.mo.open').forEach(function(m) { m.classList.remove('open'); }); } });
