var URL = 'https://script.google.com/macros/s/AKfycbzVCSSljZUzleDp6bbiaKHiZIV82FxDexbS8vCQ3_38osL1CL5cVri0mxBY2hgmdSek/exec';
var CU = null, CLIENTS = [], TASKS = [], DOCS = [], PENDING = [];
var TTAB = 'active', MTAB = 'active', DDCAT = 'all', TIMER = null;

function api(action, data) {
  var url = URL + '?action=' + action + '&d=' + encodeURIComponent(JSON.stringify(data || {}));
  return fetch(url).then(function(r) { return r.json(); });
}

function doLogin() {
  var u = document.getElementById('lu').value.trim().toLowerCase();
  var p = document.getElementById('lp').value;
  var btn = document.getElementById('lbtn');
  var err = document.getElementById('le');
  err.style.display = 'none';
  if (!u || !p) { err.textContent = 'Enter username and password'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in...';
  api('login', { username: u, password: p }).then(function(r) {
    if (!r.ok) { err.textContent = r.error || 'Login failed'; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Sign in'; return; }
    CU = r.user;
    btn.textContent = 'Loading...';
    return api('getAll').then(function(a) {
      if (a.ok) { CLIENTS = a.clients||[]; TASKS = a.tasks||[]; DOCS = a.docs||[]; PENDING = a.pending||[]; }
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      setup();
    });
  }).catch(function(e) { err.textContent = 'Error: ' + e.message; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Sign in'; });
}

function doLogout() {
  if (TIMER) clearInterval(TIMER);
  CU = null; CLIENTS = []; TASKS = []; DOCS = []; PENDING = [];
  document.getElementById('app').style.display = 'none';
  document.getElementById('login').style.display = 'flex';
  document.getElementById('lp').value = '';
  document.getElementById('lbtn').textContent = 'Sign in';
  document.getElementById('lbtn').disabled = false;
}

function setup() {
  var av = document.getElementById('uav');
  var avm = {'Atik Bhayani':'av0','Rushiraj':'av1','Sahil':'av2'};
  var im = {'Atik Bhayani':'AB','Rushiraj':'RJ','Sahil':'SH'};
  av.textContent = im[CU.name] || '?';
  av.className = 'av ' + (avm[CU.name] || 'av1');
  document.getElementById('uname').textContent = CU.name;
  document.getElementById('urole').textContent = CU.role === 'admin' ? 'Admin' : 'Staff';
  if (CU.role === 'admin') { document.getElementById('anav').style.display = 'block'; go('dash', document.querySelector('#anav .ni')); }
  else { document.getElementById('snav').style.display = 'block'; go('mine', document.querySelector('#snav .ni')); }
  fillSelects();
  TIMER = setInterval(function() {
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    silentRefresh();
  }, 60000);
}

function sync(on) {
  var d = document.getElementById('sdot'), t = document.getElementById('stext');
  if (on) { d.classList.add('spin'); t.textContent = 'Saving...'; }
  else { d.classList.remove('spin'); t.textContent = 'Synced'; }
}

function refresh() {
  sync(true);
  api('getAll').then(function(r) {
    if (r.ok) { CLIENTS = r.clients||[]; TASKS = r.tasks||[]; DOCS = r.docs||[]; PENDING = r.pending||[]; }
    sync(false);
    var pg = document.querySelector('.pg.on');
    if (pg) { var id = pg.id.replace('p-',''); renderPage(id); }
    fillSelects();
    var st = document.getElementById('stext');
    st.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    setTimeout(function() { st.textContent = 'Live'; }, 3000);
  }).catch(function() { sync(false); });
}

function silentRefresh() {
  api('getAll').then(function(r) {
    if (r.ok) { CLIENTS = r.clients||[]; TASKS = r.tasks||[]; DOCS = r.docs||[]; PENDING = r.pending||[]; }
    var pg = document.querySelector('.pg.on');
    if (pg) { var id = pg.id.replace('p-',''); renderPage(id); }
    fillSelects();
  }).catch(function() {});
}

function go(pg, el) {
  document.querySelectorAll('.pg').forEach(function(p) { p.classList.remove('on'); });
  document.querySelectorAll('.ni').forEach(function(n) { n.classList.remove('on'); });
  var p = document.getElementById('p-' + pg); if (p) p.classList.add('on');
  if (el) el.classList.add('on');
  var titles = { dash:'Dashboard', tasks:'Tasks', dates:'Due Dates - FY 2026-27', gst:'GST Compliance', matrix:'Compliance Status', clients:'Clients', docs:'Documents', pendoc:'Pending Documents', mine:'My Tasks' };
  document.getElementById('ptitle').textContent = titles[pg] || pg;
  var act = document.getElementById('pact'); act.innerHTML = '';
  if (pg === 'tasks') act.innerHTML = '<button class="btn btk" onclick="openTaskModal()">+ Add Task</button>';
  if (pg === 'clients') act.innerHTML = '<button class="btn btk" onclick="openAddClient()">+ Add Client</button>';
  if (pg === 'dash' && CU.role === 'admin') act.innerHTML = '<button class="btn" onclick="openMonthModal()" style="margin-right:6px">+ Monthly Tasks</button><button class="btn btk" onclick="openYearModal()">+ Yearly Tasks</button>';
  renderPage(pg);
}

function renderPage(pg) {
  if (pg === 'dash')    renderDash();
  if (pg === 'tasks')   renderTasks();
  if (pg === 'dates')   { fillSel('ddcli'); renderDates(); }
  if (pg === 'gst')     initGST();
  if (pg === 'matrix')  initMatrix();
  if (pg === 'clients') renderClients();
  if (pg === 'docs')    { fillSel('doccl'); renderDocs(); }
  if (pg === 'pendoc')  { fillSel('pdcl'); renderPD(); }
  if (pg === 'mine')    renderMine();
}

// ---- HELPERS ----
function parseD(d) {
  if (!d || d === '') return null;
  if (typeof d === 'number') return new Date(Math.round((d-25569)*86400*1000));
  if (d instanceof Date) return d;
  var s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.substring(0,10)+'T00:00:00');
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { var pts=s.split('/'); return new Date(pts[2]+'-'+pts[1]+'-'+pts[0]+'T00:00:00'); }
  var dt = new Date(s); return isNaN(dt.getTime()) ? null : dt;
}
function fmt(d) { var dt=parseD(d); if(!dt) return '-'; return dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function isOD(d) { var dt=parseD(d); return dt && dt < new Date(new Date().toDateString()); }
function isSoon(d) { var dt=parseD(d); if(!dt) return false; var x=(dt-new Date(new Date().toDateString()))/86400000; return x>=0&&x<=7; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
function gc(id) { return CLIENTS.find(function(c){return c.id===id;}); }
function uid() { return Date.now().toString(36)+Math.random().toString(36).substr(2,5); }
function pArr(v) { if(Array.isArray(v)) return v; if(typeof v==='string'&&v[0]==='['){try{return JSON.parse(v);}catch(e){}} return []; }

function catBdg(c) { var m={'GST':'bb','TDS':'bg','Income Tax':'ba','ROC / MCA':'bp','PF / ESIC':'bg','Audit':'br','Other':'bx'}; return '<span class="bdg '+(m[c]||'bx')+'">'+esc(c)+'</span>'; }
function whoBdg(w) { var m={'Atik Bhayani':'bx','Rushiraj':'bb','Sahil':'bp'}; return '<span class="bdg '+(m[w]||'bx')+'">'+esc(w)+'</span>'; }
function stBdg(s) { var m={pending:['ba','Pending'],inprogress:['bb','In Progress'],done:['bg','Done']}; var r=m[s]||['bx',s]; return '<span class="bdg '+r[0]+'">'+r[1]+'</span>'; }
function pdot(d,s) {
  if(s==='done') return '<div class="dot2 dd2"></div>';
  if(isOD(d)) return '<div class="dot2 dh"></div>';
  if(isSoon(d)) return '<div class="dot2 dm"></div>';
  return '<div class="dot2 dl"></div>';
}
function dStyle(d,s) { if(s==='done') return ''; if(isOD(d)) return 'style="color:var(--rd);font-weight:600"'; if(isSoon(d)) return 'style="color:var(--am);font-weight:500"'; return ''; }

function fillSelects() { fillSel('tscl'); fillSel('tcli'); fillSel('mscl'); fillSel('doccl'); fillSel('doccli'); fillSel('pdcl'); fillSel('pdcli'); fillSel('ddcli'); }
function fillSel(id) {
  var el=document.getElementById(id); if(!el) return;
  var cur=el.value; var isSel=(id==='tcli'||id==='doccli'||id==='pdcli');
  el.innerHTML=(isSel?'<option value="">Select client</option>':'<option value="">All clients</option>')+
    CLIENTS.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('');
  if(cur) el.value=cur;
}

function getTask(id) { return TASKS.find(function(t){return t.id===id;}); }
function findCompliance(cid,type,m,y) {
  var pm=parseInt(m), py=parseInt(y);
  return TASKS.find(function(t){
    if(t.client_id!==cid) return false;
    if(t.compliance_type!==type) return false;
    if(t.status==='done') return true; // done tasks block duplicates too
    var tm=parseInt(t.period_month), ty=parseInt(t.period_year);
    return tm===pm && ty===py;
  });
}

// ---- DASHBOARD ----
function renderDash() {
  var ov=TASKS.filter(function(t){return t.status!=='done'&&isOD(t.due_date);}).length;
  var pe=TASKS.filter(function(t){return t.status==='pending';}).length;
  var dn=TASKS.filter(function(t){return t.status==='done';}).length;
  document.getElementById('dstats').innerHTML=
    '<div class="stat"><div class="sl">Clients</div><div class="sv">'+CLIENTS.length+'</div></div>'+
    '<div class="stat"><div class="sl">Pending</div><div class="sv" style="color:var(--am)">'+pe+'</div></div>'+
    '<div class="stat"><div class="sl">Overdue</div><div class="sv" style="color:var(--rd)">'+ov+'</div></div>'+
    '<div class="stat"><div class="sl">Completed</div><div class="sv" style="color:var(--gr)">'+dn+'</div></div>';
  var top=TASKS.filter(function(t){return t.status!=='done';}).sort(function(a,b){return new Date(a.due_date)-new Date(b.due_date);}).slice(0,7);
  document.getElementById('dtasks').innerHTML=top.length?top.map(function(t){
    return '<div class="trow">'+pdot(t.due_date,t.status)+
      '<div style="flex:1;font-size:12px;font-weight:500">'+esc(t.name)+'</div>'+
      '<div style="color:var(--t2);font-size:12px;min-width:80px">'+esc(t.client_name||'')+'</div>'+
      whoBdg(t.assignee)+'<div '+dStyle(t.due_date,t.status)+' style="font-size:11px;min-width:68px;text-align:right">'+fmt(t.due_date)+'</div></div>';
  }).join(''):'<div class="emp">All tasks up to date</div>';
  document.getElementById('ddates').innerHTML=CAL_DATA.filter(function(d){return !isOD(d.date);}).slice(0,8).map(function(d){
    return '<div class="trow"><div style="font-size:11px;font-weight:600;color:var(--bl);min-width:60px">'+d.lbl+'</div>'+
      '<div style="flex:1;font-size:12px">'+d.task+'</div>'+
      (isSoon(d.date)?'<span class="bdg ba">Soon</span>':'<span class="bdg bg">OK</span>')+'</div>';
  }).join('');
  var pend=PENDING.filter(function(d){return !d.received;});
  document.getElementById('dpend').innerHTML=pend.length?pend.slice(0,5).map(function(d){
    return '<div class="trow">'+pdot(d.needed_by,'pending')+
      '<div style="flex:1;font-size:12px;font-weight:500">'+esc(d.name)+'</div>'+
      '<div style="color:var(--t2);font-size:12px;min-width:100px">'+esc(d.client_name||'')+'</div>'+
      '<div '+dStyle(d.needed_by,'pending')+' style="font-size:11px">'+fmt(d.needed_by)+'</div></div>';
  }).join('')+(pend.length>5?'<div style="font-size:11px;color:var(--t2);padding-top:8px">+ '+(pend.length-5)+' more</div>':''):
    '<div class="emp">No pending items</div>';
  document.getElementById('dcli').innerHTML=CLIENTS.map(function(c){
    var comps=pArr(c.compliances);
    return '<div class="trow"><div style="width:34px;height:34px;border-radius:50%;background:var(--bl-b);color:var(--bl);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0">'+c.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()+'</div>'+
      '<div><div style="font-weight:500;font-size:13px">'+esc(c.name)+'</div><div style="font-size:11px;color:var(--t2)">'+esc(c.entity||'')+'</div></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-left:auto">'+comps.slice(0,5).map(function(x){return '<span class="bdg bx">'+x+'</span>';}).join('')+'</div></div>';
  }).join('');
  checkMissing();
}

function checkMissing() {
  var n=new Date(); var m=n.getMonth()+1; var y=n.getFullYear();
  var cols=getActiveCols(m,y); var missing=0;
  CLIENTS.forEach(function(c){cols.forEach(function(col){if(col.rule(c)&&!findCompliance(c.id,col.type,m,y))missing++;});});
  var el=document.getElementById('missbadge');
  if(missing>0){el.style.display='block';el.textContent=missing+' compliance tasks missing this month - click to view';}
  else el.style.display='none';
}

// ---- TASKS ----
function setTaskTab(tab, el) {
  TTAB=tab;
  document.querySelectorAll('#p-tasks .tab').forEach(function(t){t.classList.remove('on');});
  if(el) el.classList.add('on');
  var btn=document.getElementById('addtaskbtn');
  if(btn) btn.style.display=tab==='done'?'none':'block';
  renderTasks();
}

function renderTasks() {
  var q=(document.getElementById('tsq')||{value:''}).value.toLowerCase();
  var fc=(document.getElementById('tscl')||{value:''}).value;
  var fa=(document.getElementById('tsas')||{value:''}).value;
  var fcat=(document.getElementById('tscat')||{value:''}).value;
  var t=TASKS.slice();
  if(TTAB==='done') t=t.filter(function(x){return x.status==='done';});
  else t=t.filter(function(x){return x.status!=='done';});
  if(q) t=t.filter(function(x){return x.name.toLowerCase().indexOf(q)>-1||(x.client_name||'').toLowerCase().indexOf(q)>-1;});
  if(fc) t=t.filter(function(x){return x.client_id===fc;});
  if(fa) t=t.filter(function(x){return x.assignee===fa;});
  if(fcat) t=t.filter(function(x){return x.category===fcat;});
  t.sort(function(a,b){return new Date(a.due_date)-new Date(b.due_date);});
  var isAdmin=CU&&CU.role==='admin';
  var body=document.getElementById('ttb'); if(!body) return;
  if(!t.length){body.innerHTML='<tr><td colspan="9"><div class="emp">'+(TTAB==='done'?'No completed tasks':'No pending tasks')+'</div></td></tr>';return;}
  body.innerHTML=t.map(function(tk){
    var editBtn='<button class="btn bts" onclick="openEditTask(\''+tk.id+'\')">Edit</button>';
    var doneBtn=TTAB==='done'?'':'<button class="btn bts" onclick="markDone(\''+tk.id+'\')">Done</button>';
    var revert=TTAB==='done'?'<button class="btn bts" style="background:var(--am-b);color:var(--am)" onclick="revertTask(\''+tk.id+'\')">Revert</button>':'';
    var delBtn=isAdmin?'<button class="btn bts btr" onclick="delTask(\''+tk.id+'\')">Del</button>':'';
    return '<tr><td>'+pdot(tk.due_date,tk.status)+'</td>'+
      '<td style="font-weight:500;min-width:150px">'+esc(tk.name)+'</td>'+
      '<td style="font-size:12px;color:var(--t2)">'+esc(tk.client_name||'')+'</td>'+
      '<td>'+catBdg(tk.category)+'</td>'+
      '<td>'+whoBdg(tk.assignee)+'</td>'+
      '<td '+dStyle(tk.due_date,tk.status)+' style="white-space:nowrap;font-size:12px">'+fmt(tk.due_date)+'</td>'+
      '<td>'+stBdg(tk.status)+'</td>'+
      '<td><input class="ri" value="'+esc(tk.remarks||'')+'" placeholder="Add remark..." onchange="quickRemark(\''+tk.id+'\',this.value)"></td>'+
      '<td style="white-space:nowrap;display:flex;gap:4px">'+editBtn+doneBtn+revert+delBtn+'</td></tr>';
  }).join('');
}

function quickRemark(id, val) { var t=getTask(id); if(!t) return; t.remarks=val; sync(true); api('saveTask',t).then(function(){sync(false);}); }
function markDone(id) {
  var t=getTask(id); if(!t) return;
  if(!t.remarks||t.remarks.trim()===''){alert('Please add a remark before marking done.');return;}
  t.status='done'; sync(true); api('saveTask',t).then(function(){sync(false);renderTasks();renderDash();});
}
function revertTask(id) { var t=getTask(id); if(!t) return; t.status='pending'; sync(true); api('saveTask',t).then(function(){sync(false);renderTasks();renderDash();}); }
function delTask(id) {
  if(!confirm('Delete this task?')) return;
  sync(true); api('delTask',{id:id}).then(function(){TASKS=TASKS.filter(function(t){return t.id!==id;});sync(false);renderTasks();renderDash();});
}

function openTaskModal() {
  document.getElementById('tmtitle').textContent='Add Task';
  document.getElementById('tid').value='';
  document.getElementById('tname').value='';
  document.getElementById('tdue').value='';
  document.getElementById('trm').value='';
  document.getElementById('tsts').value='pending';
  document.getElementById('tpri').value='medium';
  document.getElementById('tcat').value='GST';
  var ad=document.getElementById('tassdiv'); var as=document.getElementById('tass');
  if(CU.role==='staff'){as.value=CU.name;ad.style.display='none';}else{ad.style.display='block';as.value='Atik Bhayani';}
  fillSel('tcli'); document.getElementById('mo-task').classList.add('on');
}
function openEditTask(id) {
  var tk=getTask(id); if(!tk) return;
  document.getElementById('tmtitle').textContent='Edit Task';
  document.getElementById('tid').value=tk.id;
  document.getElementById('tname').value=tk.name;
  document.getElementById('tdue').value=tk.due_date;
  document.getElementById('tcat').value=tk.category;
  document.getElementById('tass').value=tk.assignee;
  document.getElementById('tpri').value=tk.priority;
  document.getElementById('tsts').value=tk.status;
  document.getElementById('trm').value=tk.remarks||'';
  document.getElementById('tassdiv').style.display='block';
  fillSel('tcli'); document.getElementById('tcli').value=tk.client_id||'';
  document.getElementById('mo-task').classList.add('on');
}
function saveTask() {
  var name=document.getElementById('tname').value.trim();
  var cid=document.getElementById('tcli').value;
  var due=document.getElementById('tdue').value;
  if(!name||!cid||!due){alert('Please fill task name, client and due date.');return;}
  var client=gc(cid);
  var assignee=CU.role==='staff'?CU.name:document.getElementById('tass').value;
  var eid=document.getElementById('tid').value;
  var payload={id:eid||uid(),name:name,client_id:cid,client_name:client?(client.short_name||client.name):'',
    category:document.getElementById('tcat').value,assignee:assignee,due_date:due,
    priority:document.getElementById('tpri').value,status:document.getElementById('tsts').value,
    remarks:document.getElementById('trm').value.trim(),type:'manual',compliance_type:'manual',created_by:CU.name};
  var btn=document.getElementById('tsavebtn'); btn.disabled=true; btn.textContent='Saving...'; sync(true);
  api('saveTask',payload).then(function(){
    if(eid){var i=TASKS.findIndex(function(t){return t.id===eid;});if(i>-1)TASKS[i]=payload;}else TASKS.push(payload);
    sync(false);closeMo('mo-task');
    if(CU.role==='admin'){renderTasks();renderDash();}else renderMine();
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent='Save';});
}

// ---- MY TASKS ----
function setMineTab(tab,el) {
  MTAB=tab;
  document.querySelectorAll('#p-mine .tab').forEach(function(t){t.classList.remove('on');});
  if(el) el.classList.add('on');
  renderMine();
}
function renderMine() {
  var fc=(document.getElementById('mscl')||{value:''}).value;
  var my=TASKS.filter(function(t){return t.assignee===CU.name;});
  if(MTAB==='done') my=my.filter(function(t){return t.status==='done';});
  else my=my.filter(function(t){return t.status!=='done';});
  if(fc) my=my.filter(function(t){return t.client_id===fc;});
  my.sort(function(a,b){return new Date(a.due_date)-new Date(b.due_date);});
  var all=TASKS.filter(function(t){return t.assignee===CU.name;});
  var ov=all.filter(function(t){return t.status!=='done'&&isOD(t.due_date);}).length;
  var sw=all.filter(function(t){return t.status!=='done'&&isSoon(t.due_date);}).length;
  var dn=all.filter(function(t){return t.status==='done';}).length;
  document.getElementById('mystats').innerHTML=
    '<div class="stat"><div class="sl">Overdue</div><div class="sv" style="color:var(--rd)">'+ov+'</div></div>'+
    '<div class="stat"><div class="sl">Due this week</div><div class="sv" style="color:var(--am)">'+sw+'</div></div>'+
    '<div class="stat"><div class="sl">Completed</div><div class="sv" style="color:var(--gr)">'+dn+'</div></div>';
  var body=document.getElementById('mtb'); if(!body) return;
  if(!my.length){body.innerHTML='<tr><td colspan="8"><div class="emp">'+(MTAB==='done'?'No completed tasks':'No pending tasks')+'</div></td></tr>';return;}
  body.innerHTML=my.map(function(tk){
    var editBtn='<button class="btn bts" onclick="openEditTask(\''+tk.id+'\')">Edit</button>';
    var doneBtn=MTAB==='done'?'':'<button class="btn bts" onclick="stfDone(\''+tk.id+'\')">Done</button>';
    var revert=MTAB==='done'?'<button class="btn bts" style="background:var(--am-b);color:var(--am)" onclick="revertTask(\''+tk.id+'\')">Revert</button>':'';
    return '<tr><td>'+pdot(tk.due_date,tk.status)+'</td>'+
      '<td style="font-weight:500;min-width:140px">'+esc(tk.name)+'</td>'+
      '<td style="font-size:12px;color:var(--t2)">'+esc(tk.client_name||'')+'</td>'+
      '<td>'+catBdg(tk.category)+'</td>'+
      '<td '+dStyle(tk.due_date,tk.status)+' style="white-space:nowrap;font-size:12px">'+fmt(tk.due_date)+'</td>'+
      '<td>'+stBdg(tk.status)+'</td>'+
      '<td><input class="ri" value="'+esc(tk.remarks||'')+'" placeholder="Add remark..." onchange="quickRemark(\''+tk.id+'\',this.value)"></td>'+
      '<td style="white-space:nowrap;display:flex;gap:4px">'+editBtn+doneBtn+revert+'</td></tr>';
  }).join('');
}
function stfDone(id) {
  var t=getTask(id); if(!t) return;
  if(!t.remarks||t.remarks.trim()===''){alert('Please add a remark before marking done.');return;}
  t.status='done'; sync(true); api('saveTask',t).then(function(){sync(false);renderMine();});
}

// ---- DUE DATES ----
var CAL_DATA=[
  {date:'2026-04-07',lbl:'7 Apr',task:'TCS Payment | March 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-04-11',lbl:'11 Apr',task:'GSTR 1 (Monthly) | March 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-04-13',lbl:'13 Apr',task:'GSTR 1 Q4 FY 25-26 (QRMP) | Jan-Mar 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-04-15',lbl:'15 Apr',task:'PF / ESIC Payment | March 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-04-18',lbl:'18 Apr',task:'GST CMP-08 | Q4 FY 2025-26',cat:'GST',rule:'gstComp'},
  {date:'2026-04-30',lbl:'30 Apr',task:'TDS Payment (March) | March 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-04-30',lbl:'30 Apr',task:'QRMP Election Window closes | Q1 FY 2026-27 (opt-in/out: 1-30 Apr)',cat:'GST',rule:'gstQRMP'},
  {date:'2026-04-30',lbl:'30 Apr',task:'MSME Form I (Half-Yearly) | Oct 2025-Mar 2026 outstanding payments',cat:'ROC / MCA',rule:'pvtLLP'},
  {date:'2026-05-07',lbl:'7 May',task:'TDS/TCS Payment | April 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-05-11',lbl:'11 May',task:'GSTR 1 (Monthly) | April 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-05-13',lbl:'13 May',task:'IFF (QRMP) | April 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-05-15',lbl:'15 May',task:'TCS Return Q4 | FY 2025-26',cat:'TDS',rule:'hasTDS'},
  {date:'2026-05-15',lbl:'15 May',task:'PF / ESIC Payment | April 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-05-25',lbl:'25 May',task:'GST PMT-06 (QRMP) | April 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-05-30',lbl:'30 May',task:'TCS Certificate Q4 | FY 2025-26',cat:'TDS',rule:'hasTDS'},
  {date:'2026-05-30',lbl:'30 May',task:'LLP Form 11 - Annual Return | FY 2025-26',cat:'ROC / MCA',rule:'pvtLLP'},
  {date:'2026-05-31',lbl:'31 May',task:'TDS Return Q4 | FY 2025-26',cat:'TDS',rule:'hasTDS'},
  {date:'2026-06-07',lbl:'7 Jun',task:'TDS/TCS Payment | May 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-06-11',lbl:'11 Jun',task:'GSTR 1 (Monthly) | May 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-06-13',lbl:'13 Jun',task:'IFF (QRMP) | May 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-06-15',lbl:'15 Jun',task:'TDS Certificate Q4 | FY 2025-26',cat:'TDS',rule:'hasTDS'},
  {date:'2026-06-15',lbl:'15 Jun',task:'Advance Tax 1st Instalment | TY 2026-27 . minimum 15% of tax liability',cat:'Income Tax',rule:'propOnly'},
  {date:'2026-06-15',lbl:'15 Jun',task:'PF / ESIC Payment | May 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-06-25',lbl:'25 Jun',task:'GST PMT-06 (QRMP) | May 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-06-30',lbl:'30 Jun',task:'Equalisation Levy Statement | FY 2025-26',cat:'Other',rule:'allClients'},
  {date:'2026-06-30',lbl:'30 Jun',task:'GSTR 4 | FY 2025-26',cat:'GST',rule:'gstAll'},
  {date:'2026-07-07',lbl:'7 Jul',task:'TDS/TCS Payment | June 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-07-11',lbl:'11 Jul',task:'GSTR 1 (Monthly) | June 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-07-13',lbl:'13 Jul',task:'GSTR 1 Q1 FY 26-27 (QRMP) | Apr-Jun 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-07-15',lbl:'15 Jul',task:'TCS Return Q1 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-07-15',lbl:'15 Jul',task:'PF / ESIC Payment | June 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-07-18',lbl:'18 Jul',task:'GST CMP-08 | Q1 FY 2026-27',cat:'GST',rule:'gstComp'},
  {date:'2026-07-30',lbl:'30 Jul',task:'TCS Certificate Q1 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-07-31',lbl:'31 Jul',task:'TDS Return Q1 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-07-31',lbl:'31 Jul',task:'ITR Filing - Non-Audit (ITR 1 & ITR 2) | AY 2026-27',cat:'Income Tax',rule:'allClients'},
  {date:'2026-07-31',lbl:'31 Jul',task:'QRMP Election Window closes | Q2 FY 2026-27 (opt-in/out: 1-31 Jul)',cat:'GST',rule:'gstQRMP'},
  {date:'2026-08-07',lbl:'7 Aug',task:'TDS/TCS Payment | July 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-08-11',lbl:'11 Aug',task:'GSTR 1 (Monthly) | July 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-08-13',lbl:'13 Aug',task:'IFF (QRMP) | July 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-08-15',lbl:'15 Aug',task:'TDS Certificate Q1 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-08-15',lbl:'15 Aug',task:'PF / ESIC Payment | July 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-08-25',lbl:'25 Aug',task:'GST PMT-06 (QRMP) | July 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-08-31',lbl:'31 Aug',task:'ITR Filing - Non-Audit (ITR 3, ITR 4 & ITR 5) | AY 2026-27',cat:'Income Tax',rule:'allClients'},
  {date:'2026-09-07',lbl:'7 Sep',task:'TDS/TCS Payment | August 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-09-11',lbl:'11 Sep',task:'GSTR 1 (Monthly) | August 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-09-13',lbl:'13 Sep',task:'IFF (QRMP) | August 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-09-15',lbl:'15 Sep',task:'Advance Tax 2nd Instalment | TY 2026-27 . cumulative 45% of tax liability',cat:'Income Tax',rule:'propOnly'},
  {date:'2026-09-15',lbl:'15 Sep',task:'PF / ESIC Payment | August 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-09-25',lbl:'25 Sep',task:'GST PMT-06 (QRMP) | August 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-09-30',lbl:'30 Sep',task:'Tax Audit Report | AY 2026-27',cat:'Income Tax',rule:'auditOnly'},
  {date:'2026-09-30',lbl:'30 Sep',task:'AGM | FY 2025-26 (Listed & Unlisted)',cat:'ROC / MCA',rule:'allClients'},
  {date:'2026-10-07',lbl:'7 Oct',task:'TDS/TCS Payment | September 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-10-11',lbl:'11 Oct',task:'GSTR 1 (Monthly) | September 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-10-13',lbl:'13 Oct',task:'GSTR 1 Q2 FY 26-27 (QRMP) | Jul-Sep 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-10-15',lbl:'15 Oct',task:'TCS Return Q2 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-10-15',lbl:'15 Oct',task:'PF / ESIC Payment | September 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-10-15',lbl:'15 Oct',task:'ADT-1 - Auditor Appointment | Within 15 days of AGM',cat:'ROC / MCA',rule:'allClients'},
  {date:'2026-10-18',lbl:'18 Oct',task:'GST CMP-08 | Q2 FY 2026-27',cat:'GST',rule:'gstComp'},
  {date:'2026-10-30',lbl:'30 Oct',task:'TCS Certificate Q2 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-10-30',lbl:'30 Oct',task:'AOC-4 - Financial Statements | Within 30 days of AGM',cat:'ROC / MCA',rule:'pvtLLP'},
  {date:'2026-10-30',lbl:'30 Oct',task:'LLP Form 8 - Accounts & Solvency | FY 2025-26',cat:'ROC / MCA',rule:'allClients'},
  {date:'2026-10-31',lbl:'31 Oct',task:'TDS Return Q2 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-10-31',lbl:'31 Oct',task:'ITR Filing (Audit Cases) | AY 2026-27',cat:'Income Tax',rule:'allClients'},
  {date:'2026-10-31',lbl:'31 Oct',task:'Transfer Pricing Audit | AY 2026-27',cat:'Income Tax',rule:'allClients'},
  {date:'2026-10-31',lbl:'31 Oct',task:'QRMP Election Window closes | Q3 FY 2026-27 (opt-in/out: 1-31 Oct)',cat:'GST',rule:'gstQRMP'},
  {date:'2026-10-31',lbl:'31 Oct',task:'MSME Form I (Half-Yearly) | Apr-Sep 2026 outstanding payments',cat:'ROC / MCA',rule:'pvtLLP'},
  {date:'2026-11-07',lbl:'7 Nov',task:'TDS/TCS Payment | October 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-11-11',lbl:'11 Nov',task:'GSTR 1 (Monthly) | October 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-11-13',lbl:'13 Nov',task:'IFF (QRMP) | October 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-11-15',lbl:'15 Nov',task:'TDS Certificate Q2 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2026-11-15',lbl:'15 Nov',task:'PF / ESIC Payment | October 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-11-25',lbl:'25 Nov',task:'GST PMT-06 (QRMP) | October 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-11-29',lbl:'29 Nov',task:'MGT-7 / 7A - Annual Return | Within 60 days of AGM',cat:'ROC / MCA',rule:'pvtLLP'},
  {date:'2026-11-30',lbl:'30 Nov',task:'ITR - Transfer Pricing Cases (S. 92E) | AY 2026-27',cat:'Income Tax',rule:'allClients'},
  {date:'2026-12-07',lbl:'7 Dec',task:'TDS/TCS Payment | November 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2026-12-11',lbl:'11 Dec',task:'GSTR 1 (Monthly) | November 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2026-12-13',lbl:'13 Dec',task:'IFF (QRMP) | November 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-12-15',lbl:'15 Dec',task:'Advance Tax 3rd Instalment | TY 2026-27 . cumulative 75% of tax liability',cat:'Income Tax',rule:'propOnly'},
  {date:'2026-12-15',lbl:'15 Dec',task:'PF / ESIC Payment | November 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2026-12-25',lbl:'25 Dec',task:'GST PMT-06 (QRMP) | November 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2026-12-31',lbl:'31 Dec',task:'Belated ITR | AY 2026-27',cat:'Income Tax',rule:'allClients'},
  {date:'2026-12-31',lbl:'31 Dec',task:'GSTR 9 / GSTR 9C | FY 2025-26',cat:'GST',rule:'gstAll'},
  {date:'2027-01-07',lbl:'7 Jan',task:'TDS/TCS Payment | December 2026',cat:'TDS',rule:'hasTDS'},
  {date:'2027-01-11',lbl:'11 Jan',task:'GSTR 1 (Monthly) | December 2026',cat:'GST',rule:'gstMonthly'},
  {date:'2027-01-13',lbl:'13 Jan',task:'GSTR 1 Q3 FY 26-27 (QRMP) | Oct-Dec 2026',cat:'GST',rule:'gstQRMP'},
  {date:'2027-01-15',lbl:'15 Jan',task:'TCS Return Q3 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2027-01-15',lbl:'15 Jan',task:'PF / ESIC Payment | December 2026',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2027-01-18',lbl:'18 Jan',task:'GST CMP-08 | Q3 FY 2026-27',cat:'GST',rule:'gstComp'},
  {date:'2027-01-30',lbl:'30 Jan',task:'TCS Certificate Q3 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2027-01-31',lbl:'31 Jan',task:'TDS Return Q3 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2027-01-31',lbl:'31 Jan',task:'QRMP Election Window closes | Q4 FY 2026-27 (opt-in/out: 1-31 Jan)',cat:'GST',rule:'gstQRMP'},
  {date:'2027-02-07',lbl:'7 Feb',task:'TDS/TCS Payment | January 2027',cat:'TDS',rule:'hasTDS'},
  {date:'2027-02-11',lbl:'11 Feb',task:'GSTR 1 (Monthly) | January 2027',cat:'GST',rule:'gstMonthly'},
  {date:'2027-02-13',lbl:'13 Feb',task:'IFF (QRMP) | January 2027',cat:'GST',rule:'gstQRMP'},
  {date:'2027-02-15',lbl:'15 Feb',task:'TDS Certificate Q3 | TY 2026-27',cat:'TDS',rule:'hasTDS'},
  {date:'2027-02-15',lbl:'15 Feb',task:'PF / ESIC Payment | January 2027',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2027-02-25',lbl:'25 Feb',task:'GST PMT-06 (QRMP) | January 2027',cat:'GST',rule:'gstQRMP'},
  {date:'2027-03-07',lbl:'7 Mar',task:'TDS/TCS Payment | February 2027',cat:'TDS',rule:'hasTDS'},
  {date:'2027-03-11',lbl:'11 Mar',task:'GSTR 1 (Monthly) | February 2027',cat:'GST',rule:'gstMonthly'},
  {date:'2027-03-13',lbl:'13 Mar',task:'IFF (QRMP) | February 2027',cat:'GST',rule:'gstQRMP'},
  {date:'2027-03-15',lbl:'15 Mar',task:'Advance Tax 4th Instalment | TY 2026-27 . 100% of tax liability',cat:'Income Tax',rule:'propOnly'},
  {date:'2027-03-15',lbl:'15 Mar',task:'PF / ESIC Payment | February 2027',cat:'PF / ESIC',rule:'hasPF'},
  {date:'2027-03-25',lbl:'25 Mar',task:'GST PMT-06 (QRMP) | February 2027',cat:'GST',rule:'gstQRMP'},
  {date:'2027-03-31',lbl:'31 Mar',task:'Revised ITR | AY 2026-27',cat:'Income Tax',rule:'allClients'}
];

function setDdTab(cat,el) {
  DDCAT=cat;
  document.querySelectorAll('#p-dates .tab').forEach(function(t){t.classList.remove('on');});
  if(el) el.classList.add('on');
  renderDates();
}
function clientRule(c, rule) {
  if (!c) return true;
  var g=c.gst_type||'none', f=c.gst_freq||'monthly';
  var ent=c.entity||'';
  var isPvt=ent==='Private Limited'||ent==='LLP';
  var isProp=ent==='Proprietorship'||ent==='Partnership'||ent==='HUF';
  var hasTDS=c.tds_applicable==='yes';
  var hasPF=c.pf_esic_applicable==='yes';
  var hasAudit=c.tax_scheme==='audit';
  var hasGSTR9=c.gstr9_applicable==='yes';
  if(rule==='gstMonthly') return g==='regular'&&f==='monthly';
  if(rule==='gstQRMP')    return g==='regular'&&f==='quarterly';
  if(rule==='gstComp')    return g==='composition';
  if(rule==='gstAll')     return g!=='none';
  if(rule==='hasTDS')     return hasTDS;
  if(rule==='hasPF')      return hasPF;
  if(rule==='pvtLLP')     return isPvt;
  if(rule==='propOnly')   return isProp&&!hasAudit;
  if(rule==='auditOnly')  return hasAudit;
  if(rule==='gstr9')      return hasGSTR9;
  return true;
}

function renderDates() {
  var selCli=(document.getElementById('ddcli')||{value:''}).value;
  var selClient=selCli?gc(selCli):null;
  var live=TASKS.filter(function(t){return t.status!=='done';});
  if(selCli) live=live.filter(function(t){return t.client_id===selCli;});
  if(DDCAT!=='all') live=live.filter(function(t){return t.category===DDCAT;});
  live.sort(function(a,b){return new Date(a.due_date)-new Date(b.due_date);});
  var ltb=document.getElementById('ltb');
  ltb.innerHTML=live.length?live.slice(0,20).map(function(tk){
    return '<tr><td>'+pdot(tk.due_date,tk.status)+'</td>'+
      '<td style="font-weight:500">'+esc(tk.name)+'</td>'+
      '<td style="font-size:12px;color:var(--t2)">'+esc(tk.client_name||'')+'</td>'+
      '<td>'+catBdg(tk.category)+'</td>'+
      '<td>'+whoBdg(tk.assignee)+'</td>'+
      '<td '+dStyle(tk.due_date,tk.status)+' style="white-space:nowrap;font-size:12px">'+fmt(tk.due_date)+'</td>'+
      '<td>'+stBdg(tk.status)+'</td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="emp">No pending tasks</div></td></tr>';
  var items=CAL_DATA.filter(function(d){
    var catOk=DDCAT==='all'||d.cat===DDCAT;
    var ruleOk=clientRule(selClient,d.rule);
    return catOk&&ruleOk;
  });
  var caltb=document.getElementById('caltb');
  caltb.innerHTML=items.map(function(d){
    var od=isOD(d.date),sn=isSoon(d.date);
    return '<tr>'+
      '<td style="font-weight:600;white-space:nowrap;'+(od?'color:var(--rd)':sn?'color:var(--am)':'color:var(--bl)')+'">'+fmt(d.date)+'</td>'+
      '<td style="font-weight:500">'+d.task+'</td>'+
      '<td>'+catBdg(d.cat)+'</td>'+
      '<td>'+(od?'<span class="bdg br">Overdue</span>':sn?'<span class="bdg ba">Due soon</span>':'<span class="bdg bg">Upcoming</span>')+'</td></tr>';
  }).join('');
}


function initGST() {
  var gm=document.getElementById('gstm'), gy=document.getElementById('gsty');
  if(!gm.options.length) {
    var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach(function(m,i){var o=document.createElement('option');o.value=i+1;o.text=m;gm.appendChild(o);});
    var now=new Date(); gm.value=now.getMonth()+1;
    for(var y=2026;y<=2028;y++){var o=document.createElement('option');o.value=y;o.text=y;gy.appendChild(o);}
    gy.value=now.getFullYear();
  }
  loadGST();
}

function loadGST() {
  var m=parseInt(document.getElementById('gstm').value);
  var y=parseInt(document.getElementById('gsty').value);
  var card=document.getElementById('gcard');
  card.innerHTML='<div class="emp">Loading...</div>'; sync(true);
  api('getGST',{month:m,year:y}).then(function(r){
    sync(false);
    if(!r.ok){card.innerHTML='<div class="emp">Error: '+r.error+'</div>';return;}
    renderGST(r);
  }).catch(function(e){sync(false);card.innerHTML='<div class="emp">Error: '+e.message+'</div>';});
}

function renderGST(res) {
  var card=document.getElementById('gcard');
  if(!res.rows||!res.rows.length){card.innerHTML='<div class="emp">No GST clients found</div>';return;}
  var html='<div style="margin-bottom:14px;font-size:13px;font-weight:600">GST Compliance - '+res.month+'</div>';
  html+='<div class="tw"><table><thead><tr><th>#</th><th>Client</th><th>GSTIN</th><th>Type</th><th>R1/IFF Due</th><th style="text-align:center">R1 Filed</th><th>3B/PMT Due</th><th style="text-align:center">3B Filed</th></tr></thead><tbody>';
  res.rows.forEach(function(r,i){
    var isQ=r.gst_freq==='quarterly', isCmp=r.gst_type==='composition';
    var typeBdg=isCmp?'<span class="bdg ba">CMP</span>':isQ?'<span class="bdg bp">QRMP</span>':'<span class="bdg bb">Monthly</span>';
    var r1d=r.r1Due?fmt(r.r1Due)+' ('+r.r1Label+')':'-';
    var r3d=r.r3bDue?fmt(r.r3bDue)+' ('+r.r3bLabel+')':'-';
    var r1c=r.r1_filed||false, r3c=r.r3b_filed||false;
    var bothDone=r1c&&(!r.r3bDue||r3c);
    html+='<tr'+(bothDone?' style="opacity:0.55"':'')+'>';
    html+='<td>'+(i+1)+'</td><td style="font-weight:500">'+esc(r.name)+'</td>';
    html+='<td style="font-family:monospace;font-size:11px">'+esc(r.gstin||'-')+'</td>';
    html+='<td>'+typeBdg+'</td><td style="font-size:12px">'+r1d+'</td>';
    html+='<td style="text-align:center"><input type="checkbox" '+(r1c?'checked':'')+
      ' data-cid="'+r.id+'" data-field="r1" data-year="'+res.year+'" data-month="'+res.month_num+'"'+
      ' onchange="tickGST(this)" style="width:18px;height:18px;cursor:pointer"></td>';
    html+='<td style="font-size:12px">'+r3d+'</td>';
    html+='<td style="text-align:center"><input type="checkbox" '+(r3c?'checked':'')+
      ' data-cid="'+r.id+'" data-field="r3b" data-year="'+res.year+'" data-month="'+res.month_num+'"'+
      ' onchange="tickGST(this)" style="width:18px;height:18px;cursor:pointer"></td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  card.innerHTML=html;
}

function tickGST(el) {
  var cid=el.dataset.cid, field=el.dataset.field;
  var year=parseInt(el.dataset.year), month=parseInt(el.dataset.month);
  var val=el.checked;
  el.disabled=true; sync(true);
  api('tickGST',{client_id:cid,field:field,value:val,year:year,month:month})
    .then(function(){
      if(val){
        var c=gc(cid); if(c){
          var isQE=(month%3===0), f=c.gst_freq||'monthly', g=c.gst_type||'regular';
          var type;
          if(g==='composition') type=field==='r1'?'CMP-08':null;
          else if(f==='quarterly') type=field==='r1'?(isQE?'GSTR-1 (Quarterly)':'IFF'):(isQE?'GSTR-3B (Quarterly)':'PMT-06');
          else type=field==='r1'?'GSTR-1':'GSTR-3B';
          if(type){ var t=findCompliance(cid,type,month,year); if(t&&t.status!=='done'){t.status='done';t.remarks=t.remarks||'Filed via GST module';api('saveTask',t);} }
        }
      }
      return api('getGST',{month:month,year:year});
    })
    .then(function(r){
      sync(false);
      if(r&&r.ok) renderGST(r);
      else el.disabled=false;
    })
    .catch(function(e){
      sync(false); el.disabled=false;
      alert('Error: '+e.message); el.checked=!val;
    });
}


// ---- COMPLIANCE MATRIX ----
function getActiveCols(m, y) {
  var isQE=(m%3===0), isTQ=(m===7||m===10||m===1||m===5);
  var isAT=(m===6||m===9||m===12||m===3);
  var isITR=(m>=7&&m<=10), isAuditM=(m===9||m===10), isROC=(m===10||m===11);
  var isGSTR9M=(m===12||m===1);
  function hasTDS(c)   { return c.tds_applicable==='yes'; }
  function hasPF(c)    { return c.pf_esic_applicable==='yes'; }
  function hasAudit(c) { return c.tax_scheme==='audit'; }
  function hasGSTR9(c) { return c.gstr9_applicable==='yes'; }
  function isPvt(c)    { return c.entity==='Private Limited'||c.entity==='LLP'; }
  function isProp(c)   { return c.entity==='Proprietorship'||c.entity==='Partnership'||c.entity==='HUF'; }
  var cols=[
    {type:'GSTR-1',             label:'GSTR-1',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='monthly';}},
    {type:'GSTR-3B',            label:'GSTR-3B',   rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='monthly';}},
    {type:'GSTR-1 (Quarterly)', label:'R1 Qtr',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='quarterly'&&isQE;}},
    {type:'GSTR-3B (Quarterly)',label:'3B Qtr',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='quarterly'&&isQE;}},
    {type:'PMT-06',             label:'PMT-06',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='quarterly'&&!isQE;}},
    {type:'CMP-08',             label:'CMP-08',    rule:function(c){return c.gst_type==='composition'&&isQE;}},
    {type:'GSTR-9',             label:'GSTR-9',    rule:function(c){return hasGSTR9(c)&&isGSTR9M;}},
    {type:'TDS Payment',        label:'TDS Pay',   rule:function(c){return hasTDS(c);}},
    {type:'PF / ESIC',          label:'PF/ESIC',   rule:function(c){return hasPF(c);}},
    {type:'TDS Returns',        label:'TDS Rtn',   rule:function(c){return hasTDS(c)&&isTQ;}},
    {type:'Advance Tax',        label:'Adv Tax',   rule:function(c){return isAT&&isProp(c)&&!hasAudit(c);}},
    {type:'ITR Filing',         label:'ITR',       rule:function(c){return isITR;}},
    {type:'Tax Audit',          label:'Tax Audit', rule:function(c){return isAuditM&&hasAudit(c);}},
    {type:'ROC AOC-4',          label:'AOC-4',     rule:function(c){return isROC&&isPvt(c);}},
    {type:'ROC MGT-7',          label:'MGT-7',     rule:function(c){return isROC&&isPvt(c);}}
  ];
  return cols.filter(function(col){return CLIENTS.some(function(c){return col.rule(c);});});
}

function initMatrix() {
  var mm=document.getElementById('mxm'), my=document.getElementById('mxy');
  if(!mm.options.length) {
    var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach(function(m,i){var o=document.createElement('option');o.value=i+1;o.text=m;mm.appendChild(o);});
    var now=new Date(); mm.value=now.getMonth()+1;
    for(var y=2026;y<=2028;y++){var o=document.createElement('option');o.value=y;o.text=y;my.appendChild(o);}
    my.value=now.getFullYear();
    loadMatrix();
  }
}
function loadMatrix() {
  var card=document.getElementById('mxcard');
  card.innerHTML='<div class="emp">Loading...</div>'; sync(true);
  api('getAll').then(function(r){
    if(r.ok){CLIENTS=r.clients||[];TASKS=r.tasks||[];}
    sync(false); renderMatrix();
  }).catch(function(){sync(false);renderMatrix();});
}
function renderMatrix() {
  var m=parseInt(document.getElementById('mxm').value);
  var y=parseInt(document.getElementById('mxy').value);
  var card=document.getElementById('mxcard');
  var cols=getActiveCols(m,y);
  var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  var total=0,done=0,overdue=0,pending=0,missing=0;
  CLIENTS.forEach(function(c){cols.forEach(function(col){if(!col.rule(c)) return; total++; var t=findCompliance(c.id,col.type,m,y); if(!t)missing++; else if(t.status==='done')done++; else if(isOD(t.due_date))overdue++; else pending++;});});
  var ccat=function(type){
    if(type.indexOf('GSTR')>-1||type.indexOf('PMT')>-1||type.indexOf('CMP')>-1) return 'bb';
    if(type.indexOf('TDS')>-1) return 'bg'; if(type.indexOf('PF')>-1) return 'bg';
    if(type.indexOf('ITR')>-1||type.indexOf('Adv')>-1||type.indexOf('Audit')>-1) return 'ba';
    if(type.indexOf('ROC')>-1||type.indexOf('AOC')>-1||type.indexOf('MGT')>-1) return 'bp'; return 'bx';
  };
  var html='<div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  html+='<div style="font-size:13px;font-weight:600">Compliance Control - '+mname+' '+y+'</div>';
  html+='<span class="bdg bg">'+done+' done</span><span class="bdg ba">'+pending+' pending</span>';
  html+='<span class="bdg br">'+overdue+' overdue</span>';
  if(missing) html+='<span class="bdg bx">'+missing+' missing</span>';
  html+='</div>';
  html+='<div class="tw"><table><thead><tr><th style="min-width:130px;position:sticky;left:0;background:var(--bg)">Client</th>';
  cols.forEach(function(col){html+='<th style="text-align:center;min-width:80px"><span class="bdg '+ccat(col.type)+'">'+col.label+'</span></th>';});
  html+='</tr></thead><tbody>';
  CLIENTS.forEach(function(c){
    html+='<tr><td style="font-weight:500;position:sticky;left:0;background:var(--s)">'+esc(c.short_name||c.name)+'</td>';
    cols.forEach(function(col){
      if(!col.rule(c)){html+='<td style="background:var(--bg);text-align:center;color:var(--t3)">-</td>';return;}
      var t=findCompliance(c.id,col.type,m,y);
      var cell,bg='';
      if(!t){
        cell='<div style="display:flex;gap:3px;justify-content:center">'+
          '<button class="btn bts" style="font-size:10px;background:var(--rd-b);color:var(--rd);border-color:#FCA5A5;padding:3px 6px" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" data-action="create" onclick="mxClick(this)" title="Create task">+ Task</button>'+
          '<button class="btn bts" style="font-size:10px;background:var(--gr-b);color:var(--gr);border-color:#86EFAC;padding:3px 6px" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" data-action="done" onclick="mxClick(this)" title="Mark as already filed">&#10003; Filed</button>'+
        '</div>';
        bg='background:var(--rd-b)';
      } else if(t.status==='done'){
        cell='<span style="color:var(--gr);font-size:18px" title="'+esc(t.remarks||'')+'">&#10003;</span>'; bg='background:var(--gr-b)';
      } else if(isOD(t.due_date)){
        cell='<span style="color:var(--rd);font-size:11px;font-weight:600;cursor:pointer" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" onclick="mxClick(this)">OVERDUE</span>'; bg='background:var(--rd-b)';
      } else if(isSoon(t.due_date)){
        cell='<span style="color:var(--am);font-size:11px;cursor:pointer" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" onclick="mxClick(this)">'+fmt(t.due_date)+'</span>'; bg='background:var(--am-b)';
      } else {
        cell='<span style="color:var(--t2);font-size:11px">'+fmt(t.due_date)+'</span>';
      }
      html+='<td style="text-align:center;'+bg+'">'+cell+'</td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  if(missing){
    html+='<div style="margin-top:14px;padding:10px 14px;background:var(--rd-b);border-radius:var(--rs);border:1px solid #FCA5A5"><div style="font-size:12px;font-weight:600;color:var(--rd);margin-bottom:6px">Missing tasks:</div>';
    var miss=[];
    CLIENTS.forEach(function(c){cols.forEach(function(col){if(col.rule(c)&&!findCompliance(c.id,col.type,m,y)) miss.push(esc(c.short_name||c.name)+' - '+col.label);});});
    html+=miss.map(function(x){return '<span class="bdg br" style="margin:2px">'+x+'</span>';}).join('');
    html+='</div>';
  }
  card.innerHTML=html;
}
function mxClick(el) {
  var cid=el.dataset.cid, type=el.dataset.type, m=parseInt(el.dataset.m), y=parseInt(el.dataset.y);
  var action=el.dataset.action||'create';
  var t=findCompliance(cid,type,m,y);
  if(t) {
    // Task exists - mark done
    if(t.status!=='done'){
      t.status='done'; t.remarks=t.remarks||'Marked from Compliance Matrix';
      sync(true); api('saveTask',t).then(function(){sync(false);renderMatrix();});
    }
  } else {
    if(action==='done') {
      // Mark filed directly - create task already done
      markFiledDirect(cid,type,m,y);
    } else {
      // Create pending task with assignee picker
      createFromMatrix(cid,type,m,y);
    }
  }
}

function markFiledDirect(cid,type,m,y) {
  var c=gc(cid); if(!c) return;
  var nm=m===12?1:m+1, ny=m===12?y+1:y;
  var dayMap={'GSTR-1':11,'GSTR-3B':20,'GSTR-1 (Quarterly)':13,'GSTR-3B (Quarterly)':22,'PMT-06':25,'CMP-08':18,'TDS Payment':7,'PF / ESIC':15,'TDS Returns':31,'ITR Filing':31,'Tax Audit':30,'ROC AOC-4':30,'ROC MGT-7':29,'Advance Tax':15};
  var day=dayMap[type]||20;
  var due=ny+'-'+(nm<10?'0'+nm:''+nm)+'-'+(day<10?'0'+day:''+day);
  var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  var catMap=function(t){if(t.indexOf('GSTR')>-1||t.indexOf('PMT')>-1||t.indexOf('CMP')>-1)return 'GST';if(t.indexOf('TDS')>-1)return 'TDS';if(t.indexOf('PF')>-1)return 'PF / ESIC';if(t.indexOf('ROC')>-1||t.indexOf('AOC')>-1||t.indexOf('MGT')>-1)return 'ROC / MCA';return 'Income Tax';};
  var task={id:uid(),name:type+' - '+mname+' '+y,client_id:cid,client_name:c.short_name||c.name,
    category:catMap(type),assignee:CU.name,due_date:due,
    status:'done',priority:'high',remarks:'Marked filed from Compliance Matrix',
    type:'auto',compliance_type:type,period_month:m,period_year:y,created_by:CU.name};
  sync(true); TASKS.push(task);
  api('saveTask',task).then(function(){sync(false);renderMatrix();checkMissing();}).catch(function(e){alert('Error: '+e.message);});
}
function createFromMatrix(cid,type,m,y) {
  if(findCompliance(cid,type,m,y)) return;
  var c=gc(cid); if(!c) return;
  // Show assignee picker
  openAssignPicker(function(assignee) {
    var nm=m===12?1:m+1, ny=m===12?y+1:y;
    var dayMap={'GSTR-1':11,'GSTR-3B':20,'GSTR-1 (Quarterly)':13,'GSTR-3B (Quarterly)':22,'PMT-06':25,'CMP-08':18,'TDS Payment':7,'PF / ESIC':15,'TDS Returns':31,'ITR Filing':31,'Tax Audit':30,'ROC AOC-4':30,'ROC MGT-7':29,'Advance Tax':15};
    var day=dayMap[type]||20;
    var due=ny+'-'+(nm<10?'0'+nm:''+nm)+'-'+(day<10?'0'+day:''+day);
    var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
    var catMap=function(t){if(t.indexOf('GSTR')>-1||t.indexOf('PMT')>-1||t.indexOf('CMP')>-1)return 'GST';if(t.indexOf('TDS')>-1)return 'TDS';if(t.indexOf('PF')>-1)return 'PF / ESIC';if(t.indexOf('ROC')>-1||t.indexOf('AOC')>-1||t.indexOf('MGT')>-1)return 'ROC / MCA';return 'Income Tax';};
    var task={id:uid(),name:type+' - '+mname+' '+y,client_id:cid,client_name:c.short_name||c.name,category:catMap(type),assignee:assignee,due_date:due,status:'pending',priority:'high',remarks:'',type:'auto',compliance_type:type,period_month:m,period_year:y,created_by:CU.name};
    if(findCompliance(cid,type,m,y)) return; // double check
    sync(true); TASKS.push(task);
    api('saveTask',task).then(function(){sync(false);renderMatrix();}).catch(function(e){alert('Error: '+e.message);});
  });
}
function genMissing() {
  var m=parseInt(document.getElementById('mxm').value);
  var y=parseInt(document.getElementById('mxy').value);
  var cols=getActiveCols(m,y);
  // Count missing first
  var missingCount=0;
  CLIENTS.forEach(function(c){cols.forEach(function(col){if(col.rule(c)&&!findCompliance(c.id,col.type,m,y))missingCount++;});});
  if(!missingCount){alert('No missing tasks - all compliances have tasks.');return;}
  // Ask assignee once for all
  openAssignPicker(function(assignee) {
    var nm=m===12?1:m+1, ny=m===12?y+1:y;
    var dayMap={'GSTR-1':11,'GSTR-3B':20,'GSTR-1 (Quarterly)':13,'GSTR-3B (Quarterly)':22,'PMT-06':25,'CMP-08':18,'TDS Payment':7,'PF / ESIC':15,'TDS Returns':31,'ITR Filing':31,'Tax Audit':30,'ROC AOC-4':30,'ROC MGT-7':29,'Advance Tax':15};
    var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
    var catMap=function(t){if(t.indexOf('GSTR')>-1||t.indexOf('PMT')>-1||t.indexOf('CMP')>-1)return 'GST';if(t.indexOf('TDS')>-1)return 'TDS';if(t.indexOf('PF')>-1)return 'PF / ESIC';if(t.indexOf('ROC')>-1||t.indexOf('AOC')>-1||t.indexOf('MGT')>-1)return 'ROC / MCA';return 'Income Tax';};
    var created=0; var promises=[];
    CLIENTS.forEach(function(c){
      cols.forEach(function(col){
        if(!col.rule(c)||findCompliance(c.id,col.type,m,y)) return;
        var day=dayMap[col.type]||20;
        var due=ny+'-'+(nm<10?'0'+nm:''+nm)+'-'+(day<10?'0'+day:''+day);
        var task={id:uid(),name:col.type+' - '+mname+' '+y,client_id:c.id,client_name:c.short_name||c.name,category:catMap(col.type),assignee:assignee,due_date:due,status:'pending',priority:'high',remarks:'',type:'auto',compliance_type:col.type,period_month:m,period_year:y,created_by:CU.name};
        TASKS.push(task); promises.push(api('saveTask',task)); created++;
      });
    });
    sync(true);
    Promise.all(promises).then(function(){sync(false);alert(created+' tasks created and assigned to '+assignee+'.');renderMatrix();checkMissing();}).catch(function(e){sync(false);alert('Error: '+e.message);});
  });
}

// ---- CLIENTS ----
var CRULES=[
  {name:'GSTR-1',       freq:'Monthly',    rule:function(c){return c.gst==='regular'&&c.gstf==='monthly';}},
  {name:'GSTR-3B',      freq:'Monthly',    rule:function(c){return c.gst==='regular'&&c.gstf==='monthly';}},
  {name:'GSTR-1 (Qtr)', freq:'Quarterly',  rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'GSTR-3B (Qtr)',freq:'Quarterly',  rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'PMT-06',        freq:'Monthly',   rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'CMP-08',        freq:'Quarterly', rule:function(c){return c.gst==='composition';}},
  {name:'GSTR-9',        freq:'Annual',    rule:function(c){return c.gstr9==='yes';}},
  {name:'TDS Payment',   freq:'Monthly',   rule:function(c){return c.tds==='yes';}},
  {name:'TDS Returns',   freq:'Quarterly', rule:function(c){return c.tds==='yes';}},
  {name:'PF / ESIC',     freq:'Monthly',   rule:function(c){return c.pf==='yes';}},
  {name:'Advance Tax',   freq:'4 dates',   rule:function(c){return (c.ent==='Proprietorship'||c.ent==='Partnership'||c.ent==='HUF')&&c.scheme!=='audit';}},
  {name:'Tax Audit',     freq:'Annual',    rule:function(c){return c.scheme==='audit';}},
  {name:'ITR',           freq:'Annual',    rule:function(c){return true;}},
  {name:'ROC AOC-4',     freq:'Annual',    rule:function(c){return c.ent==='Private Limited'||c.ent==='LLP';}},
  {name:'ROC MGT-7',     freq:'Annual',    rule:function(c){return c.ent==='Private Limited'||c.ent==='LLP';}}
];
function renderClients(q) {
  if(!q) q='';
  var list=q?CLIENTS.filter(function(c){return c.name.toLowerCase().indexOf(q.toLowerCase())>-1||(c.pan||'').toLowerCase().indexOf(q.toLowerCase())>-1;}):CLIENTS.slice();
  buildCliTable(list);
}
function filterEnt(tp) { buildCliTable(tp?CLIENTS.filter(function(c){return c.entity===tp;}):CLIENTS); }
function buildCliTable(list) {
  var body=document.getElementById('ctb'); if(!body) return;
  var oc=function(id){return TASKS.filter(function(t){return t.client_id===id&&t.status!=='done';}).length;};
  if(!list.length){body.innerHTML='<tr><td colspan="7"><div class="emp">No clients found</div></td></tr>';return;}
  body.innerHTML=list.map(function(c){
    var freq=c.gst_type==='none'?'<span class="bdg bx">No GST</span>':c.gst_freq==='quarterly'?'<span class="bdg bp">QRMP</span>':c.gst_type==='composition'?'<span class="bdg ba">CMP</span>':'<span class="bdg bb">Monthly</span>';
    var scheme=c.tax_scheme==='audit'?'<span class="bdg br">Audit</span>':c.tax_scheme==='presumptive'?'<span class="bdg bg">44AD</span>':'<span class="bdg bx">Regular</span>';
    var extras=(c.tds_applicable==='yes'?'<span class="bdg bb" style="margin-left:2px">TDS</span>':'')+(c.pf_esic_applicable==='yes'?'<span class="bdg bp" style="margin-left:2px">PF</span>':'')+(c.gstr9_applicable==='yes'?'<span class="bdg ba" style="margin-left:2px">9</span>':'');
    return '<tr><td style="font-weight:500">'+esc(c.name)+'</td>'+
      '<td><span class="bdg bx">'+esc(c.entity||'')+'</span></td>'+
      '<td style="font-family:monospace;font-size:12px">'+(c.pan||'-')+'</td>'+
      '<td style="font-family:monospace;font-size:12px">'+(c.gstin||'-')+'</td>'+
      '<td>'+freq+' '+scheme+extras+'</td>'+
      '<td>'+(oc(c.id)>0?'<span class="bdg ba">'+oc(c.id)+' open</span>':'<span class="bdg bg">Clear</span>')+'</td>'+
      '<td style="white-space:nowrap;display:flex;gap:4px"><button class="btn bts" onclick="openEditClient(\''+c.id+'\')">Edit</button><button class="btn bts btr" onclick="delClient(\''+c.id+'\')">Remove</button></td></tr>';
  }).join('');
}
function delClient(id) {
  if(!confirm('Remove this client?')) return;
  sync(true); api('delClient',{id:id}).then(function(){CLIENTS=CLIENTS.filter(function(c){return c.id!==id;});sync(false);renderClients();fillSelects();});
}
function updComps() {
  var gst=document.getElementById('cgst').value;
  var gstf=document.getElementById('cgstf').value;
  var tds=document.getElementById('ctds').value;
  var pf=document.getElementById('cpf').value;
  var gstr9=document.getElementById('cgstr9').value;
  var scheme=document.getElementById('cscheme').value;
  var ent=document.getElementById('cent').value;
  var cfg={gst:gst,gstf:gstf,tds:tds,pf:pf,gstr9:gstr9,scheme:scheme,ent:ent};
  var gstNone=gst==='none';
  document.getElementById('gstindiv').style.display=gstNone?'none':'block';
  document.getElementById('gstfdiv').style.display=gstNone?'none':'block';
  var on=CRULES.filter(function(r){return r.rule(cfg);});
  document.getElementById('ccnt').textContent=on.length;
  document.getElementById('cpllist').innerHTML=CRULES.map(function(r){
    var ok=r.rule(cfg);
    var cid2='chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_');
    return '<div class="cpi" style="'+(ok?'':'opacity:.4')+'">'+(ok?'<input type="checkbox" id="'+cid2+'" checked style="width:15px;height:15px;cursor:pointer;flex-shrink:0">':'<div style="width:15px;height:15px;background:var(--b);border-radius:3px;flex-shrink:0"></div>')+
      '<div style="font-size:12px;flex:1">'+r.name+'</div><div style="font-size:10px;color:var(--t3)">'+r.freq+'</div></div>';
  }).join('');
}
function getCheckedComps() { return CRULES.filter(function(r){var el=document.getElementById('chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_'));return el&&el.checked;}).map(function(r){return r.name;}); }
function openAddClient() {
  document.getElementById('cid').value='';
  ['cname','cpan','cgstin','cemail','cnotes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('cent').value=''; document.getElementById('cgst').value='regular';
  document.getElementById('cgstf').value='monthly'; document.getElementById('cemp').value='yes';
  document.getElementById('ctov').value='above1cr';
  document.getElementById('cscheme').value='presumptive';
  document.getElementById('ctds').value='no';
  document.getElementById('cpf').value='no';
  document.getElementById('cgstr9').value='no';
  document.getElementById('cmtitle').textContent='Add Client';
  document.getElementById('csavebtn').textContent='Save Client';
  updComps(); document.getElementById('mo-client').classList.add('on');
}
function openEditClient(id) {
  var c=gc(id); if(!c) return;
  document.getElementById('cid').value=c.id;
  document.getElementById('cname').value=c.name||'';
  document.getElementById('cpan').value=c.pan||'';
  document.getElementById('cgstin').value=c.gstin||'';
  document.getElementById('cemail').value=c.email||'';
  document.getElementById('cnotes').value=c.notes||'';
  document.getElementById('cent').value=c.entity||'';
  document.getElementById('cgst').value=c.gst_type||'regular';
  document.getElementById('cgstf').value=c.gst_freq||'monthly';
  document.getElementById('cscheme').value=c.tax_scheme||'presumptive';
  document.getElementById('ctds').value=c.tds_applicable||'no';
  document.getElementById('cpf').value=c.pf_esic_applicable||'no';
  document.getElementById('cgstr9').value=c.gstr9_applicable||'no';
  document.getElementById('cmtitle').textContent='Edit Client';
  document.getElementById('csavebtn').textContent='Update Client';
  var existing=pArr(c.compliances);
  updComps();
  if(existing.length) CRULES.forEach(function(r){var el=document.getElementById('chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_'));if(el)el.checked=existing.indexOf(r.name)>-1;});
  document.getElementById('mo-client').classList.add('on');
}
function saveClient() {
  var name=document.getElementById('cname').value.trim();
  var pan=document.getElementById('cpan').value.trim().toUpperCase();
  var entity=document.getElementById('cent').value;
  if(!name||!pan||!entity){alert('Please fill client name, PAN and entity type.');return;}
  var comps=getCheckedComps();
  var short=name.split(' ').filter(function(w){return w.length>2;}).map(function(w){return w[0];}).join('').toUpperCase()||name.slice(0,6);
  var eid=document.getElementById('cid').value;
  var payload={id:eid||uid(),name:name,short_name:short,entity:entity,pan:pan,
    gst_type:document.getElementById('cgst').value,
    gst_freq:document.getElementById('cgstf').value,
    gstin:document.getElementById('cgstin').value.trim().toUpperCase(),
    tax_scheme:document.getElementById('cscheme').value,
    tds_applicable:document.getElementById('ctds').value,
    pf_esic_applicable:document.getElementById('cpf').value,
    gstr9_applicable:document.getElementById('cgstr9').value,
    has_employees:document.getElementById('ctds').value,
    email:document.getElementById('cemail').value.trim(),
    notes:document.getElementById('cnotes').value.trim(),compliances:comps};
  var btn=document.getElementById('csavebtn'); btn.disabled=true; btn.textContent='Saving...'; sync(true);
  api('saveClient',payload).then(function(){
    if(eid){var i=CLIENTS.findIndex(function(c){return c.id===eid;});if(i>-1)CLIENTS[i]=payload;}else CLIENTS.push(payload);
    sync(false);closeMo('mo-client');renderClients();fillSelects();
    alert((eid?'Updated':'Added')+': '+name);
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent=eid?'Update Client':'Save Client';});
}

// ---- DOCS ----
function renderDocs() {
  var cf=(document.getElementById('doccl')||{value:''}).value;
  var docs=DOCS.slice(); if(cf) docs=docs.filter(function(d){return d.client_id===cf;});
  var el=document.getElementById('doclist'); if(!el) return;
  el.innerHTML=docs.length?docs.map(function(d){
    return '<div class="dr"><div style="width:30px;height:30px;background:var(--bl-b);color:var(--bl);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">F</div>'+
      '<div style="flex:1"><div style="font-weight:500">'+esc(d.description)+'</div><div style="font-size:11px;color:var(--t3)">'+esc(d.client_name||'')+' - '+d.category+' - '+d.financial_year+'</div></div>'+
      '<span class="bdg bb">'+esc(d.category)+'</span>'+
      '<button class="btn bts btr" onclick="delDoc(\''+d.id+'\')">Remove</button></div>';
  }).join(''):'<div class="emp">No documents recorded yet</div>';
}
function openDocModal() { fillSel('doccli'); document.getElementById('docdesc').value=''; document.getElementById('docfile').value=''; document.getElementById('mo-doc').classList.add('on'); }
function saveDoc() {
  var cid=document.getElementById('doccli').value, desc=document.getElementById('docdesc').value.trim();
  if(!cid||!desc){alert('Select client and add description.');return;}
  var client=gc(cid);
  var payload={id:uid(),client_id:cid,client_name:client?(client.short_name||client.name):'',category:document.getElementById('doccat').value,financial_year:document.getElementById('docfy').value,description:desc,filename:document.getElementById('docfile').value.trim(),uploaded_by:CU.name};
  var btn=document.getElementById('docsavebtn'); btn.disabled=true; btn.textContent='Saving...'; sync(true);
  api('saveDoc',payload).then(function(){DOCS.unshift(payload);sync(false);closeMo('mo-doc');renderDocs();}).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent='Save';});
}
function delDoc(id) { if(!confirm('Remove?')) return; sync(true); api('delDoc',{id:id}).then(function(){DOCS=DOCS.filter(function(d){return d.id!==id;});sync(false);renderDocs();}); }

// ---- PENDING DOCS ----
function renderPD() {
  var fc=(document.getElementById('pdcl')||{value:''}).value;
  var list=PENDING.slice(); if(fc) list=list.filter(function(d){return d.client_id===fc;});
  list.sort(function(a,b){return new Date(a.needed_by||'2099-12-31')-new Date(b.needed_by||'2099-12-31');});
  var el=document.getElementById('pdlist'); if(!el) return;
  el.innerHTML=list.length?list.map(function(d){
    var od=isOD(d.needed_by),sn=isSoon(d.needed_by);
    var cls=od?'br':sn?'ba':'bx';
    var actionBtn=d.received?'<span class="bdg bg">Received</span>':'<button class="btn bts" style="background:var(--gr-b);color:var(--gr)" onclick="markReceived(\''+d.id+'\')">Mark Received</button>';
    return '<div class="dr"><div style="width:30px;height:30px;background:var(--am-b);color:var(--am);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">!</div>'+
      '<div style="flex:1"><div style="font-weight:500">'+esc(d.name)+'</div><div style="font-size:11px;color:var(--t2)">'+esc(d.client_name||'')+' - '+(d.category||'')+(d.remarks?' - '+esc(d.remarks):'')+'</div></div>'+
      '<span class="bdg '+cls+'">'+(d.needed_by?fmt(d.needed_by):'No date')+'</span>'+actionBtn+
      '<button class="btn bts btr" onclick="delPD(\''+d.id+'\')">Del</button></div>';
  }).join(''):'<div class="emp">No pending items</div>';
}
function openPDModal() { document.getElementById('pdid').value=''; document.getElementById('pdname').value=''; document.getElementById('pddue').value=''; document.getElementById('pdrm').value=''; fillSel('pdcli'); document.getElementById('mo-pd').classList.add('on'); }
function savePD() {
  var cid=document.getElementById('pdcli').value, name=document.getElementById('pdname').value.trim();
  if(!cid||!name){alert('Select client and enter document name.');return;}
  var client=gc(cid);
  var eid=document.getElementById('pdid').value;
  var payload={id:eid||uid(),client_id:cid,client_name:client?(client.short_name||client.name):'',name:name,category:document.getElementById('pdcat').value,needed_by:document.getElementById('pddue').value,remarks:document.getElementById('pdrm').value.trim(),received:false,created_by:CU.name};
  var btn=document.getElementById('pdsavebtn'); btn.disabled=true; btn.textContent='Saving...'; sync(true);
  api('savePD',payload).then(function(){
    if(eid){var i=PENDING.findIndex(function(d){return d.id===eid;});if(i>-1)PENDING[i]=payload;}else PENDING.push(payload);
    sync(false);closeMo('mo-pd');renderPD();renderDash();
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent='Save';});
}
function markReceived(id) { var d=PENDING.find(function(x){return x.id===id;}); if(!d) return; d.received=true; sync(true); api('savePD',d).then(function(){sync(false);renderPD();renderDash();}); }
function delPD(id) { if(!confirm('Delete?')) return; sync(true); api('delPD',{id:id}).then(function(){PENDING=PENDING.filter(function(d){return d.id!==id;});sync(false);renderPD();renderDash();}); }

// ---- MONTHLY/YEARLY TASK MODALS ----
function openMonthModal() {
  var mm=document.getElementById('mmm'), my=document.getElementById('mmy');
  if(!mm.options.length){
    var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach(function(m,i){var o=document.createElement('option');o.value=i+1;o.text=m;mm.appendChild(o);});
    var now=new Date(); mm.value=now.getMonth()+1;
    for(var y=2026;y<=2028;y++){var o=document.createElement('option');o.value=y;o.text=y;my.appendChild(o);}
    my.value=now.getFullYear();
  }
  buildMonthTable(); document.getElementById('mo-month').classList.add('on');
}
function buildMonthTable() {
  var m=parseInt(document.getElementById('mmm').value), y=parseInt(document.getElementById('mmy').value);
  var isQE=(m%3===0), nm=m===12?1:m+1, ny=m===12?y+1:y;
  var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  document.getElementById('mmtitle').textContent=mname+' '+y;
  var gstCli=CLIENTS.filter(function(c){return c.gst_type&&c.gst_type!=='none';});
  var body=document.getElementById('mmtb');
  body.innerHTML=gstCli.map(function(c){
    var f=c.gst_freq||'monthly', g=c.gst_type||'regular', emp=c.has_employees==='yes';
    var tasks=[];
    if(g==='regular'&&f==='monthly') tasks=['GSTR-1','GSTR-3B'];
    else if(g==='regular'&&f==='quarterly') tasks=isQE?['GSTR-1 Qtr','GSTR-3B Qtr']:['PMT-06'];
    else if(g==='composition'&&isQE) tasks=['CMP-08'];
    if(c.tds_applicable==='yes') tasks=tasks.concat(['TDS Payment']);
    if(c.pf_esic_applicable==='yes') tasks=tasks.concat(['PF/ESIC']);
    return '<tr><td style="font-weight:500">'+esc(c.short_name||c.name)+'</td>'+
      '<td style="font-size:11px;color:var(--t2)">'+(tasks.join(', ')||'-')+'</td>'+
      '<td><select class="btn mm-assign" data-cid="'+c.id+'" style="font-size:12px"><option value="Atik Bhayani">Atik Bhayani</option><option value="Rushiraj" selected>Rushiraj</option><option value="Sahil">Sahil</option></select></td></tr>';
  }).join('');
}
function setAllMonthAssign(name) { document.querySelectorAll('.mm-assign').forEach(function(s){s.value=name;}); }
function createMonthTasks() {
  var m=parseInt(document.getElementById('mmm').value), y=parseInt(document.getElementById('mmy').value);
  var assignees={};
  document.querySelectorAll('.mm-assign').forEach(function(s){assignees[s.dataset.cid]=s.value;});
  var btn=document.getElementById('mmbtn'); btn.disabled=true; btn.textContent='Creating...'; sync(true);
  api('autoTasks',{year:y,month:m,assignees:assignees}).then(function(r){
    sync(false); btn.disabled=false; btn.textContent='Create Tasks'; closeMo('mo-month');
    if(r.ok){alert('Created '+r.created+' tasks for '+r.month); return api('getAll').then(function(a){if(a.ok){TASKS=a.tasks||[];renderDash();}});}
    else alert('Error: '+r.error);
  }).catch(function(e){sync(false);btn.disabled=false;btn.textContent='Create Tasks';alert('Error: '+e.message);});
}
function openYearModal() {
  var yy=document.getElementById('yry');
  if(!yy.options.length){for(var y=2026;y<=2030;y++){var o=document.createElement('option');o.value=y;o.text='FY '+y;yy.appendChild(o);}yy.value=new Date().getFullYear();}
  buildYearTable(); document.getElementById('mo-year').classList.add('on');
}
function buildYearTable() {
  var body=document.getElementById('yrtb');
  body.innerHTML=CLIENTS.map(function(c){
    var audit=c.tax_scheme==='audit';
    var pvt=c.entity==='Private Limited'||c.entity==='LLP';
    var prop=c.entity==='Proprietorship'||c.entity==='Partnership'||c.entity==='HUF';
    var hasTDS=c.tds_applicable==='yes';
    var hasGSTR9=c.gstr9_applicable==='yes';
    var tasks=[];
    if(audit) tasks.push('ITR(Oct)','Tax Audit(Sep)'); else tasks.push('ITR(Aug)');
    if(pvt) tasks.push('AOC-4','MGT-7');
    if(prop&&!audit) tasks.push('Adv Tax x4');
    if(hasTDS) tasks.push('TDS Returns x4');
    if(hasGSTR9) tasks.push('GSTR-9');
    return '<tr><td style="font-weight:500">'+esc(c.short_name||c.name)+'</td>'+
      '<td style="font-size:11px;color:var(--t2)">'+tasks.join(', ')+'</td>'+
      '<td><select class="btn yr-assign" data-cid="'+c.id+'" style="font-size:12px"><option value="Atik Bhayani" selected>Atik Bhayani</option><option value="Rushiraj">Rushiraj</option><option value="Sahil">Sahil</option></select></td></tr>';
  }).join('');
}
function setAllYearAssign(name) { document.querySelectorAll('.yr-assign').forEach(function(s){s.value=name;}); }
function createYearTasks() {
  var y=parseInt(document.getElementById('yry').value);
  var assignees={};
  document.querySelectorAll('.yr-assign').forEach(function(s){assignees[s.dataset.cid]=s.value;});
  var btn=document.getElementById('yrbtn'); btn.disabled=true; btn.textContent='Creating...'; sync(true);
  api('yearTasks',{year:y,assignees:assignees}).then(function(r){
    sync(false); btn.disabled=false; btn.textContent='Create Tasks'; closeMo('mo-year');
    if(r.ok){alert('Created '+r.created+' yearly tasks for '+y); return api('getAll').then(function(a){if(a.ok){TASKS=a.tasks||[];renderDash();}});}
    else alert('Error: '+r.error);
  }).catch(function(e){sync(false);btn.disabled=false;btn.textContent='Create Tasks';alert('Error: '+e.message);});
}


function openAssignPicker(callback) {
  window._assignCallback = callback;
  document.getElementById('mo-assign').classList.add('on');
  document.getElementById('apsel').value = 'Rushiraj';
}
function confirmAssign() {
  var v = document.getElementById('apsel').value;
  closeMo('mo-assign');
  if (window._assignCallback) { window._assignCallback(v); window._assignCallback = null; }
}

function closeMo(id) { document.getElementById(id).classList.remove('on'); }
document.addEventListener('click', function(e) { if(e.target.classList.contains('mo')) e.target.classList.remove('on'); });
document.addEventListener('keydown', function(e) { if(e.key==='Escape') document.querySelectorAll('.mo.on').forEach(function(m){m.classList.remove('on');}); });
// ---- COMPLIANCE MATRIX ----
function getActiveCols(m, y) {
  var isQE=(m%3===0), isTQ=(m===7||m===10||m===1||m===5);
  var isAT=(m===6||m===9||m===12||m===3);
  var isITR=(m>=7&&m<=10), isAuditM=(m===9||m===10), isROC=(m===10||m===11);
  var isGSTR9M=(m===12||m===1);
  function hasTDS(c)   { return c.tds_applicable==='yes'; }
  function hasPF(c)    { return c.pf_esic_applicable==='yes'; }
  function hasAudit(c) { return c.tax_scheme==='audit'; }
  function hasGSTR9(c) { return c.gstr9_applicable==='yes'; }
  function isPvt(c)    { return c.entity==='Private Limited'||c.entity==='LLP'; }
  function isProp(c)   { return c.entity==='Proprietorship'||c.entity==='Partnership'||c.entity==='HUF'; }
  var cols=[
    {type:'GSTR-1',             label:'GSTR-1',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='monthly';}},
    {type:'GSTR-3B',            label:'GSTR-3B',   rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='monthly';}},
    {type:'GSTR-1 (Quarterly)', label:'R1 Qtr',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='quarterly'&&isQE;}},
    {type:'GSTR-3B (Quarterly)',label:'3B Qtr',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='quarterly'&&isQE;}},
    {type:'PMT-06',             label:'PMT-06',    rule:function(c){return c.gst_type==='regular'&&c.gst_freq==='quarterly'&&!isQE;}},
    {type:'CMP-08',             label:'CMP-08',    rule:function(c){return c.gst_type==='composition'&&isQE;}},
    {type:'GSTR-9',             label:'GSTR-9',    rule:function(c){return hasGSTR9(c)&&isGSTR9M;}},
    {type:'TDS Payment',        label:'TDS Pay',   rule:function(c){return hasTDS(c);}},
    {type:'PF / ESIC',          label:'PF/ESIC',   rule:function(c){return hasPF(c);}},
    {type:'TDS Returns',        label:'TDS Rtn',   rule:function(c){return hasTDS(c)&&isTQ;}},
    {type:'Advance Tax',        label:'Adv Tax',   rule:function(c){return isAT&&isProp(c)&&!hasAudit(c);}},
    {type:'ITR Filing',         label:'ITR',       rule:function(c){return isITR;}},
    {type:'Tax Audit',          label:'Tax Audit', rule:function(c){return isAuditM&&hasAudit(c);}},
    {type:'ROC AOC-4',          label:'AOC-4',     rule:function(c){return isROC&&isPvt(c);}},
    {type:'ROC MGT-7',          label:'MGT-7',     rule:function(c){return isROC&&isPvt(c);}}
  ];
  return cols.filter(function(col){return CLIENTS.some(function(c){return col.rule(c);});});
}

function initMatrix() {
  var mm=document.getElementById('mxm'), my=document.getElementById('mxy');
  if(!mm.options.length) {
    var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach(function(m,i){var o=document.createElement('option');o.value=i+1;o.text=m;mm.appendChild(o);});
    var now=new Date(); mm.value=now.getMonth()+1;
    for(var y=2026;y<=2028;y++){var o=document.createElement('option');o.value=y;o.text=y;my.appendChild(o);}
    my.value=now.getFullYear();
    loadMatrix();
  }
}
function loadMatrix() {
  var card=document.getElementById('mxcard');
  card.innerHTML='<div class="emp">Loading...</div>'; sync(true);
  api('getAll').then(function(r){
    if(r.ok){CLIENTS=r.clients||[];TASKS=r.tasks||[];}
    sync(false); renderMatrix();
  }).catch(function(){sync(false);renderMatrix();});
}
function renderMatrix() {
  var m=parseInt(document.getElementById('mxm').value);
  var y=parseInt(document.getElementById('mxy').value);
  var card=document.getElementById('mxcard');
  var cols=getActiveCols(m,y);
  var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  var total=0,done=0,overdue=0,pending=0,missing=0;
  CLIENTS.forEach(function(c){cols.forEach(function(col){if(!col.rule(c)) return; total++; var t=findCompliance(c.id,col.type,m,y); if(!t)missing++; else if(t.status==='done')done++; else if(isOD(t.due_date))overdue++; else pending++;});});
  var ccat=function(type){
    if(type.indexOf('GSTR')>-1||type.indexOf('PMT')>-1||type.indexOf('CMP')>-1) return 'bb';
    if(type.indexOf('TDS')>-1) return 'bg'; if(type.indexOf('PF')>-1) return 'bg';
    if(type.indexOf('ITR')>-1||type.indexOf('Adv')>-1||type.indexOf('Audit')>-1) return 'ba';
    if(type.indexOf('ROC')>-1||type.indexOf('AOC')>-1||type.indexOf('MGT')>-1) return 'bp'; return 'bx';
  };
  var html='<div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  html+='<div style="font-size:13px;font-weight:600">Compliance Control - '+mname+' '+y+'</div>';
  html+='<span class="bdg bg">'+done+' done</span><span class="bdg ba">'+pending+' pending</span>';
  html+='<span class="bdg br">'+overdue+' overdue</span>';
  if(missing) html+='<span class="bdg bx">'+missing+' missing</span>';
  html+='</div>';
  html+='<div class="tw"><table><thead><tr><th style="min-width:130px;position:sticky;left:0;background:var(--bg)">Client</th>';
  cols.forEach(function(col){html+='<th style="text-align:center;min-width:80px"><span class="bdg '+ccat(col.type)+'">'+col.label+'</span></th>';});
  html+='</tr></thead><tbody>';
  CLIENTS.forEach(function(c){
    html+='<tr><td style="font-weight:500;position:sticky;left:0;background:var(--s)">'+esc(c.short_name||c.name)+'</td>';
    cols.forEach(function(col){
      if(!col.rule(c)){html+='<td style="background:var(--bg);text-align:center;color:var(--t3)">-</td>';return;}
      var t=findCompliance(c.id,col.type,m,y);
      var cell,bg='';
      if(!t){
        cell='<div style="display:flex;gap:3px;justify-content:center">'+
          '<button class="btn bts" style="font-size:10px;background:var(--rd-b);color:var(--rd);border-color:#FCA5A5;padding:3px 6px" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" data-action="create" onclick="mxClick(this)" title="Create task">+ Task</button>'+
          '<button class="btn bts" style="font-size:10px;background:var(--gr-b);color:var(--gr);border-color:#86EFAC;padding:3px 6px" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" data-action="done" onclick="mxClick(this)" title="Mark as already filed">&#10003; Filed</button>'+
        '</div>';
        bg='background:var(--rd-b)';
      } else if(t.status==='done'){
        cell='<span style="color:var(--gr);font-size:18px" title="'+esc(t.remarks||'')+'">&#10003;</span>'; bg='background:var(--gr-b)';
      } else if(isOD(t.due_date)){
        cell='<span style="color:var(--rd);font-size:11px;font-weight:600;cursor:pointer" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" onclick="mxClick(this)">OVERDUE</span>'; bg='background:var(--rd-b)';
      } else if(isSoon(t.due_date)){
        cell='<span style="color:var(--am);font-size:11px;cursor:pointer" data-cid="'+c.id+'" data-type="'+col.type+'" data-m="'+m+'" data-y="'+y+'" onclick="mxClick(this)">'+fmt(t.due_date)+'</span>'; bg='background:var(--am-b)';
      } else {
        cell='<span style="color:var(--t2);font-size:11px">'+fmt(t.due_date)+'</span>';
      }
      html+='<td style="text-align:center;'+bg+'">'+cell+'</td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  if(missing){
    html+='<div style="margin-top:14px;padding:10px 14px;background:var(--rd-b);border-radius:var(--rs);border:1px solid #FCA5A5"><div style="font-size:12px;font-weight:600;color:var(--rd);margin-bottom:6px">Missing tasks:</div>';
    var miss=[];
    CLIENTS.forEach(function(c){cols.forEach(function(col){if(col.rule(c)&&!findCompliance(c.id,col.type,m,y)) miss.push(esc(c.short_name||c.name)+' - '+col.label);});});
    html+=miss.map(function(x){return '<span class="bdg br" style="margin:2px">'+x+'</span>';}).join('');
    html+='</div>';
  }
  card.innerHTML=html;
}
function mxClick(el) {
  var cid=el.dataset.cid, type=el.dataset.type, m=parseInt(el.dataset.m), y=parseInt(el.dataset.y);
  var action=el.dataset.action||'create';
  var t=findCompliance(cid,type,m,y);
  if(t) {
    // Task exists - mark done
    if(t.status!=='done'){
      t.status='done'; t.remarks=t.remarks||'Marked from Compliance Matrix';
      sync(true); api('saveTask',t).then(function(){sync(false);renderMatrix();});
    }
  } else {
    if(action==='done') {
      // Mark filed directly - create task already done
      markFiledDirect(cid,type,m,y);
    } else {
      // Create pending task with assignee picker
      createFromMatrix(cid,type,m,y);
    }
  }
}

function markFiledDirect(cid,type,m,y) {
  var c=gc(cid); if(!c) return;
  var nm=m===12?1:m+1, ny=m===12?y+1:y;
  var dayMap={'GSTR-1':11,'GSTR-3B':20,'GSTR-1 (Quarterly)':13,'GSTR-3B (Quarterly)':22,'PMT-06':25,'CMP-08':18,'TDS Payment':7,'PF / ESIC':15,'TDS Returns':31,'ITR Filing':31,'Tax Audit':30,'ROC AOC-4':30,'ROC MGT-7':29,'Advance Tax':15};
  var day=dayMap[type]||20;
  var due=ny+'-'+(nm<10?'0'+nm:''+nm)+'-'+(day<10?'0'+day:''+day);
  var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  var catMap=function(t){if(t.indexOf('GSTR')>-1||t.indexOf('PMT')>-1||t.indexOf('CMP')>-1)return 'GST';if(t.indexOf('TDS')>-1)return 'TDS';if(t.indexOf('PF')>-1)return 'PF / ESIC';if(t.indexOf('ROC')>-1||t.indexOf('AOC')>-1||t.indexOf('MGT')>-1)return 'ROC / MCA';return 'Income Tax';};
  var task={id:uid(),name:type+' - '+mname+' '+y,client_id:cid,client_name:c.short_name||c.name,
    category:catMap(type),assignee:CU.name,due_date:due,
    status:'done',priority:'high',remarks:'Marked filed from Compliance Matrix',
    type:'auto',compliance_type:type,period_month:m,period_year:y,created_by:CU.name};
  sync(true); TASKS.push(task);
  api('saveTask',task).then(function(){sync(false);renderMatrix();checkMissing();}).catch(function(e){alert('Error: '+e.message);});
}
function createFromMatrix(cid,type,m,y) {
  if(findCompliance(cid,type,m,y)) return;
  var c=gc(cid); if(!c) return;
  // Show assignee picker
  openAssignPicker(function(assignee) {
    var nm=m===12?1:m+1, ny=m===12?y+1:y;
    var dayMap={'GSTR-1':11,'GSTR-3B':20,'GSTR-1 (Quarterly)':13,'GSTR-3B (Quarterly)':22,'PMT-06':25,'CMP-08':18,'TDS Payment':7,'PF / ESIC':15,'TDS Returns':31,'ITR Filing':31,'Tax Audit':30,'ROC AOC-4':30,'ROC MGT-7':29,'Advance Tax':15};
    var day=dayMap[type]||20;
    var due=ny+'-'+(nm<10?'0'+nm:''+nm)+'-'+(day<10?'0'+day:''+day);
    var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
    var catMap=function(t){if(t.indexOf('GSTR')>-1||t.indexOf('PMT')>-1||t.indexOf('CMP')>-1)return 'GST';if(t.indexOf('TDS')>-1)return 'TDS';if(t.indexOf('PF')>-1)return 'PF / ESIC';if(t.indexOf('ROC')>-1||t.indexOf('AOC')>-1||t.indexOf('MGT')>-1)return 'ROC / MCA';return 'Income Tax';};
    var task={id:uid(),name:type+' - '+mname+' '+y,client_id:cid,client_name:c.short_name||c.name,category:catMap(type),assignee:assignee,due_date:due,status:'pending',priority:'high',remarks:'',type:'auto',compliance_type:type,period_month:m,period_year:y,created_by:CU.name};
    if(findCompliance(cid,type,m,y)) return; // double check
    sync(true); TASKS.push(task);
    api('saveTask',task).then(function(){sync(false);renderMatrix();}).catch(function(e){alert('Error: '+e.message);});
  });
}
function genMissing() {
  var m=parseInt(document.getElementById('mxm').value);
  var y=parseInt(document.getElementById('mxy').value);
  var cols=getActiveCols(m,y);
  // Count missing first
  var missingCount=0;
  CLIENTS.forEach(function(c){cols.forEach(function(col){if(col.rule(c)&&!findCompliance(c.id,col.type,m,y))missingCount++;});});
  if(!missingCount){alert('No missing tasks - all compliances have tasks.');return;}
  // Ask assignee once for all
  openAssignPicker(function(assignee) {
    var nm=m===12?1:m+1, ny=m===12?y+1:y;
    var dayMap={'GSTR-1':11,'GSTR-3B':20,'GSTR-1 (Quarterly)':13,'GSTR-3B (Quarterly)':22,'PMT-06':25,'CMP-08':18,'TDS Payment':7,'PF / ESIC':15,'TDS Returns':31,'ITR Filing':31,'Tax Audit':30,'ROC AOC-4':30,'ROC MGT-7':29,'Advance Tax':15};
    var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
    var catMap=function(t){if(t.indexOf('GSTR')>-1||t.indexOf('PMT')>-1||t.indexOf('CMP')>-1)return 'GST';if(t.indexOf('TDS')>-1)return 'TDS';if(t.indexOf('PF')>-1)return 'PF / ESIC';if(t.indexOf('ROC')>-1||t.indexOf('AOC')>-1||t.indexOf('MGT')>-1)return 'ROC / MCA';return 'Income Tax';};
    var created=0; var promises=[];
    CLIENTS.forEach(function(c){
      cols.forEach(function(col){
        if(!col.rule(c)||findCompliance(c.id,col.type,m,y)) return;
        var day=dayMap[col.type]||20;
        var due=ny+'-'+(nm<10?'0'+nm:''+nm)+'-'+(day<10?'0'+day:''+day);
        var task={id:uid(),name:col.type+' - '+mname+' '+y,client_id:c.id,client_name:c.short_name||c.name,category:catMap(col.type),assignee:assignee,due_date:due,status:'pending',priority:'high',remarks:'',type:'auto',compliance_type:col.type,period_month:m,period_year:y,created_by:CU.name};
        TASKS.push(task); promises.push(api('saveTask',task)); created++;
      });
    });
    sync(true);
    Promise.all(promises).then(function(){sync(false);alert(created+' tasks created and assigned to '+assignee+'.');renderMatrix();checkMissing();}).catch(function(e){sync(false);alert('Error: '+e.message);});
  });
}

// ---- CLIENTS ----
var CRULES=[
  {name:'GSTR-1',       freq:'Monthly',    rule:function(c){return c.gst==='regular'&&c.gstf==='monthly';}},
  {name:'GSTR-3B',      freq:'Monthly',    rule:function(c){return c.gst==='regular'&&c.gstf==='monthly';}},
  {name:'GSTR-1 (Qtr)', freq:'Quarterly',  rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'GSTR-3B (Qtr)',freq:'Quarterly',  rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'PMT-06',        freq:'Monthly',   rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'CMP-08',        freq:'Quarterly', rule:function(c){return c.gst==='composition';}},
  {name:'GSTR-9',        freq:'Annual',    rule:function(c){return c.gstr9==='yes';}},
  {name:'TDS Payment',   freq:'Monthly',   rule:function(c){return c.tds==='yes';}},
  {name:'TDS Returns',   freq:'Quarterly', rule:function(c){return c.tds==='yes';}},
  {name:'PF / ESIC',     freq:'Monthly',   rule:function(c){return c.pf==='yes';}},
  {name:'Advance Tax',   freq:'4 dates',   rule:function(c){return (c.ent==='Proprietorship'||c.ent==='Partnership'||c.ent==='HUF')&&c.scheme!=='audit';}},
  {name:'Tax Audit',     freq:'Annual',    rule:function(c){return c.scheme==='audit';}},
  {name:'ITR',           freq:'Annual',    rule:function(c){return true;}},
  {name:'ROC AOC-4',     freq:'Annual',    rule:function(c){return c.ent==='Private Limited'||c.ent==='LLP';}},
  {name:'ROC MGT-7',     freq:'Annual',    rule:function(c){return c.ent==='Private Limited'||c.ent==='LLP';}}
];
function renderClients(q) {
  if(!q) q='';
  var list=q?CLIENTS.filter(function(c){return c.name.toLowerCase().indexOf(q.toLowerCase())>-1||(c.pan||'').toLowerCase().indexOf(q.toLowerCase())>-1;}):CLIENTS.slice();
  buildCliTable(list);
}
function filterEnt(tp) { buildCliTable(tp?CLIENTS.filter(function(c){return c.entity===tp;}):CLIENTS); }
function buildCliTable(list) {
  var body=document.getElementById('ctb'); if(!body) return;
  var oc=function(id){return TASKS.filter(function(t){return t.client_id===id&&t.status!=='done';}).length;};
  if(!list.length){body.innerHTML='<tr><td colspan="7"><div class="emp">No clients found</div></td></tr>';return;}
  body.innerHTML=list.map(function(c){
    var freq=c.gst_type==='none'?'<span class="bdg bx">No GST</span>':c.gst_freq==='quarterly'?'<span class="bdg bp">QRMP</span>':c.gst_type==='composition'?'<span class="bdg ba">CMP</span>':'<span class="bdg bb">Monthly</span>';
    var scheme=c.tax_scheme==='audit'?'<span class="bdg br">Audit</span>':c.tax_scheme==='presumptive'?'<span class="bdg bg">44AD</span>':'<span class="bdg bx">Regular</span>';
    var extras=(c.tds_applicable==='yes'?'<span class="bdg bb" style="margin-left:2px">TDS</span>':'')+(c.pf_esic_applicable==='yes'?'<span class="bdg bp" style="margin-left:2px">PF</span>':'')+(c.gstr9_applicable==='yes'?'<span class="bdg ba" style="margin-left:2px">9</span>':'');
    return '<tr><td style="font-weight:500">'+esc(c.name)+'</td>'+
      '<td><span class="bdg bx">'+esc(c.entity||'')+'</span></td>'+
      '<td style="font-family:monospace;font-size:12px">'+(c.pan||'-')+'</td>'+
      '<td style="font-family:monospace;font-size:12px">'+(c.gstin||'-')+'</td>'+
      '<td>'+freq+' '+scheme+extras+'</td>'+
      '<td>'+(oc(c.id)>0?'<span class="bdg ba">'+oc(c.id)+' open</span>':'<span class="bdg bg">Clear</span>')+'</td>'+
      '<td style="white-space:nowrap;display:flex;gap:4px"><button class="btn bts" onclick="openEditClient(\''+c.id+'\')">Edit</button><button class="btn bts btr" onclick="delClient(\''+c.id+'\')">Remove</button></td></tr>';
  }).join('');
}
function delClient(id) {
  if(!confirm('Remove this client?')) return;
  sync(true); api('delClient',{id:id}).then(function(){CLIENTS=CLIENTS.filter(function(c){return c.id!==id;});sync(false);renderClients();fillSelects();});
}
function updComps() {
  var gst=document.getElementById('cgst').value;
  var gstf=document.getElementById('cgstf').value;
  var tds=document.getElementById('ctds').value;
  var pf=document.getElementById('cpf').value;
  var gstr9=document.getElementById('cgstr9').value;
  var scheme=document.getElementById('cscheme').value;
  var ent=document.getElementById('cent').value;
  var cfg={gst:gst,gstf:gstf,tds:tds,pf:pf,gstr9:gstr9,scheme:scheme,ent:ent};
  var gstNone=gst==='none';
  document.getElementById('gstindiv').style.display=gstNone?'none':'block';
  document.getElementById('gstfdiv').style.display=gstNone?'none':'block';
  var on=CRULES.filter(function(r){return r.rule(cfg);});
  document.getElementById('ccnt').textContent=on.length;
  document.getElementById('cpllist').innerHTML=CRULES.map(function(r){
    var ok=r.rule(cfg);
    var cid2='chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_');
    return '<div class="cpi" style="'+(ok?'':'opacity:.4')+'">'+(ok?'<input type="checkbox" id="'+cid2+'" checked style="width:15px;height:15px;cursor:pointer;flex-shrink:0">':'<div style="width:15px;height:15px;background:var(--b);border-radius:3px;flex-shrink:0"></div>')+
      '<div style="font-size:12px;flex:1">'+r.name+'</div><div style="font-size:10px;color:var(--t3)">'+r.freq+'</div></div>';
  }).join('');
}
function getCheckedComps() { return CRULES.filter(function(r){var el=document.getElementById('chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_'));return el&&el.checked;}).map(function(r){return r.name;}); }
function openAddClient() {
  document.getElementById('cid').value='';
  ['cname','cpan','cgstin','cemail','cnotes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('cent').value=''; document.getElementById('cgst').value='regular';
  document.getElementById('cgstf').value='monthly'; document.getElementById('cemp').value='yes';
  document.getElementById('ctov').value='above1cr';
  document.getElementById('cscheme').value='presumptive';
  document.getElementById('ctds').value='no';
  document.getElementById('cpf').value='no';
  document.getElementById('cgstr9').value='no';
  document.getElementById('cmtitle').textContent='Add Client';
  document.getElementById('csavebtn').textContent='Save Client';
  updComps(); document.getElementById('mo-client').classList.add('on');
}
function openEditClient(id) {
  var c=gc(id); if(!c) return;
  document.getElementById('cid').value=c.id;
  document.getElementById('cname').value=c.name||'';
  document.getElementById('cpan').value=c.pan||'';
  document.getElementById('cgstin').value=c.gstin||'';
  document.getElementById('cemail').value=c.email||'';
  document.getElementById('cnotes').value=c.notes||'';
  document.getElementById('cent').value=c.entity||'';
  document.getElementById('cgst').value=c.gst_type||'regular';
  document.getElementById('cgstf').value=c.gst_freq||'monthly';
  document.getElementById('cscheme').value=c.tax_scheme||'presumptive';
  document.getElementById('ctds').value=c.tds_applicable||'no';
  document.getElementById('cpf').value=c.pf_esic_applicable||'no';
  document.getElementById('cgstr9').value=c.gstr9_applicable||'no';
  document.getElementById('cmtitle').textContent='Edit Client';
  document.getElementById('csavebtn').textContent='Update Client';
  var existing=pArr(c.compliances);
  updComps();
  if(existing.length) CRULES.forEach(function(r){var el=document.getElementById('chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_'));if(el)el.checked=existing.indexOf(r.name)>-1;});
  document.getElementById('mo-client').classList.add('on');
}
function saveClient() {
  var name=document.getElementById('cname').value.trim();
  var pan=document.getElementById('cpan').value.trim().toUpperCase();
  var entity=document.getElementById('cent').value;
  if(!name||!pan||!entity){alert('Please fill client name, PAN and entity type.');return;}
  var comps=getCheckedComps();
  var short=name.split(' ').filter(function(w){return w.length>2;}).map(function(w){return w[0];}).join('').toUpperCase()||name.slice(0,6);
  var eid=document.getElementById('cid').value;
  var payload={id:eid||uid(),name:name,short_name:short,entity:entity,pan:pan,
    gst_type:document.getElementById('cgst').value,
    gst_freq:document.getElementById('cgstf').value,
    gstin:document.getElementById('cgstin').value.trim().toUpperCase(),
    tax_scheme:document.getElementById('cscheme').value,
    tds_applicable:document.getElementById('ctds').value,
    pf_esic_applicable:document.getElementById('cpf').value,
    gstr9_applicable:document.getElementById('cgstr9').value,
    has_employees:document.getElementById('ctds').value,
    email:document.getElementById('cemail').value.trim(),
    notes:document.getElementById('cnotes').value.trim(),compliances:comps};
  var btn=document.getElementById('csavebtn'); btn.disabled=true; btn.textContent='Saving...'; sync(true);
  api('saveClient',payload).then(function(){
    if(eid){var i=CLIENTS.findIndex(function(c){return c.id===eid;});if(i>-1)CLIENTS[i]=payload;}else CLIENTS.push(payload);
    sync(false);closeMo('mo-client');renderClients();fillSelects();
    alert((eid?'Updated':'Added')+': '+name);
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent=eid?'Update Client':'Save Client';});
}

// ---- DOCS ----
function renderDocs() {
  var cf=(document.getElementById('doccl')||{value:''}).value;
  var docs=DOCS.slice(); if(cf) docs=docs.filter(function(d){return d.client_id===cf;});
  var el=document.getElementById('doclist'); if(!el) return;
  el.innerHTML=docs.length?docs.map(function(d){
    return '<div class="dr"><div style="width:30px;height:30px;background:var(--bl-b);color:var(--bl);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">F</div>'+
      '<div style="flex:1"><div style="font-weight:500">'+esc(d.description)+'</div><div style="font-size:11px;color:var(--t3)">'+esc(d.client_name||'')+' - '+d.category+' - '+d.financial_year+'</div></div>'+
      '<span class="bdg bb">'+esc(d.category)+'</span>'+
      '<button class="btn bts btr" onclick="delDoc(\''+d.id+'\')">Remove</button></div>';
  }).join(''):'<div class="emp">No documents recorded yet</div>';
}
function openDocModal() { fillSel('doccli'); document.getElementById('docdesc').value=''; document.getElementById('docfile').value=''; document.getElementById('mo-doc').classList.add('on'); }
function saveDoc() {
  var cid=document.getElementById('doccli').value, desc=document.getElementById('docdesc').value.trim();
  if(!cid||!desc){alert('Select client and add description.');return;}
  var client=gc(cid);
  var payload={id:uid(),client_id:cid,client_name:client?(client.short_name||client.name):'',category:document.getElementById('doccat').value,financial_year:document.getElementById('docfy').value,description:desc,filename:document.getElementById('docfile').value.trim(),uploaded_by:CU.name};
  var btn=document.getElementById('docsavebtn'); btn.disabled=true; btn.textContent='Saving...'; sync(true);
  api('saveDoc',payload).then(function(){DOCS.unshift(payload);sync(false);closeMo('mo-doc');renderDocs();}).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent='Save';});
}
function delDoc(id) { if(!confirm('Remove?')) return; sync(true); api('delDoc',{id:id}).then(function(){DOCS=DOCS.filter(function(d){return d.id!==id;});sync(false);renderDocs();}); }

// ---- PENDING DOCS ----
function renderPD() {
  var fc=(document.getElementById('pdcl')||{value:''}).value;
  var list=PENDING.slice(); if(fc) list=list.filter(function(d){return d.client_id===fc;});
  list.sort(function(a,b){return new Date(a.needed_by||'2099-12-31')-new Date(b.needed_by||'2099-12-31');});
  var el=document.getElementById('pdlist'); if(!el) return;
  el.innerHTML=list.length?list.map(function(d){
    var od=isOD(d.needed_by),sn=isSoon(d.needed_by);
    var cls=od?'br':sn?'ba':'bx';
    var actionBtn=d.received?'<span class="bdg bg">Received</span>':'<button class="btn bts" style="background:var(--gr-b);color:var(--gr)" onclick="markReceived(\''+d.id+'\')">Mark Received</button>';
    return '<div class="dr"><div style="width:30px;height:30px;background:var(--am-b);color:var(--am);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">!</div>'+
      '<div style="flex:1"><div style="font-weight:500">'+esc(d.name)+'</div><div style="font-size:11px;color:var(--t2)">'+esc(d.client_name||'')+' - '+(d.category||'')+(d.remarks?' - '+esc(d.remarks):'')+'</div></div>'+
      '<span class="bdg '+cls+'">'+(d.needed_by?fmt(d.needed_by):'No date')+'</span>'+actionBtn+
      '<button class="btn bts btr" onclick="delPD(\''+d.id+'\')">Del</button></div>';
  }).join(''):'<div class="emp">No pending items</div>';
}
function openPDModal() { document.getElementById('pdid').value=''; document.getElementById('pdname').value=''; document.getElementById('pddue').value=''; document.getElementById('pdrm').value=''; fillSel('pdcli'); document.getElementById('mo-pd').classList.add('on'); }
function savePD() {
  var cid=document.getElementById('pdcli').value, name=document.getElementById('pdname').value.trim();
  if(!cid||!name){alert('Select client and enter document name.');return;}
  var client=gc(cid);
  var eid=document.getElementById('pdid').value;
  var payload={id:eid||uid(),client_id:cid,client_name:client?(client.short_name||client.name):'',name:name,category:document.getElementById('pdcat').value,needed_by:document.getElementById('pddue').value,remarks:document.getElementById('pdrm').value.trim(),received:false,created_by:CU.name};
  var btn=document.getElementById('pdsavebtn'); btn.disabled=true; btn.textContent='Saving...'; sync(true);
  api('savePD',payload).then(function(){
    if(eid){var i=PENDING.findIndex(function(d){return d.id===eid;});if(i>-1)PENDING[i]=payload;}else PENDING.push(payload);
    sync(false);closeMo('mo-pd');renderPD();renderDash();
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent='Save';});
}
function markReceived(id) { var d=PENDING.find(function(x){return x.id===id;}); if(!d) return; d.received=true; sync(true); api('savePD',d).then(function(){sync(false);renderPD();renderDash();}); }
function delPD(id) { if(!confirm('Delete?')) return; sync(true); api('delPD',{id:id}).then(function(){PENDING=PENDING.filter(function(d){return d.id!==id;});sync(false);renderPD();renderDash();}); }

// ---- MONTHLY/YEARLY TASK MODALS ----
function openMonthModal() {
  var mm=document.getElementById('mmm'), my=document.getElementById('mmy');
  if(!mm.options.length){
    var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach(function(m,i){var o=document.createElement('option');o.value=i+1;o.text=m;mm.appendChild(o);});
    var now=new Date(); mm.value=now.getMonth()+1;
    for(var y=2026;y<=2028;y++){var o=document.createElement('option');o.value=y;o.text=y;my.appendChild(o);}
    my.value=now.getFullYear();
  }
  buildMonthTable(); document.getElementById('mo-month').classList.add('on');
}
function buildMonthTable() {
  var m=parseInt(document.getElementById('mmm').value), y=parseInt(document.getElementById('mmy').value);
  var isQE=(m%3===0), nm=m===12?1:m+1, ny=m===12?y+1:y;
  var mname=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  document.getElementById('mmtitle').textContent=mname+' '+y;
  var gstCli=CLIENTS.filter(function(c){return c.gst_type&&c.gst_type!=='none';});
  var body=document.getElementById('mmtb');
  body.innerHTML=gstCli.map(function(c){
    var f=c.gst_freq||'monthly', g=c.gst_type||'regular', emp=c.has_employees==='yes';
    var tasks=[];
    if(g==='regular'&&f==='monthly') tasks=['GSTR-1','GSTR-3B'];
    else if(g==='regular'&&f==='quarterly') tasks=isQE?['GSTR-1 Qtr','GSTR-3B Qtr']:['PMT-06'];
    else if(g==='composition'&&isQE) tasks=['CMP-08'];
    if(c.tds_applicable==='yes') tasks=tasks.concat(['TDS Payment']);
    if(c.pf_esic_applicable==='yes') tasks=tasks.concat(['PF/ESIC']);
    return '<tr><td style="font-weight:500">'+esc(c.short_name||c.name)+'</td>'+
      '<td style="font-size:11px;color:var(--t2)">'+(tasks.join(', ')||'-')+'</td>'+
      '<td><select class="btn mm-assign" data-cid="'+c.id+'" style="font-size:12px"><option value="Atik Bhayani">Atik Bhayani</option><option value="Rushiraj" selected>Rushiraj</option><option value="Sahil">Sahil</option></select></td></tr>';
  }).join('');
}
function setAllMonthAssign(name) { document.querySelectorAll('.mm-assign').forEach(function(s){s.value=name;}); }
function createMonthTasks() {
  var m=parseInt(document.getElementById('mmm').value), y=parseInt(document.getElementById('mmy').value);
  var assignees={};
  document.querySelectorAll('.mm-assign').forEach(function(s){assignees[s.dataset.cid]=s.value;});
  var btn=document.getElementById('mmbtn'); btn.disabled=true; btn.textContent='Creating...'; sync(true);
  api('autoTasks',{year:y,month:m,assignees:assignees}).then(function(r){
    sync(false); btn.disabled=false; btn.textContent='Create Tasks'; closeMo('mo-month');
    if(r.ok){alert('Created '+r.created+' tasks for '+r.month); return api('getAll').then(function(a){if(a.ok){TASKS=a.tasks||[];renderDash();}});}
    else alert('Error: '+r.error);
  }).catch(function(e){sync(false);btn.disabled=false;btn.textContent='Create Tasks';alert('Error: '+e.message);});
}
function openYearModal() {
  var yy=document.getElementById('yry');
  if(!yy.options.length){for(var y=2026;y<=2030;y++){var o=document.createElement('option');o.value=y;o.text='FY '+y;yy.appendChild(o);}yy.value=new Date().getFullYear();}
  buildYearTable(); document.getElementById('mo-year').classList.add('on');
}
function buildYearTable() {
  var body=document.getElementById('yrtb');
  body.innerHTML=CLIENTS.map(function(c){
    var audit=c.tax_scheme==='audit';
    var pvt=c.entity==='Private Limited'||c.entity==='LLP';
    var prop=c.entity==='Proprietorship'||c.entity==='Partnership'||c.entity==='HUF';
    var hasTDS=c.tds_applicable==='yes';
    var hasGSTR9=c.gstr9_applicable==='yes';
    var tasks=[];
    if(audit) tasks.push('ITR(Oct)','Tax Audit(Sep)'); else tasks.push('ITR(Aug)');
    if(pvt) tasks.push('AOC-4','MGT-7');
    if(prop&&!audit) tasks.push('Adv Tax x4');
    if(hasTDS) tasks.push('TDS Returns x4');
    if(hasGSTR9) tasks.push('GSTR-9');
    return '<tr><td style="font-weight:500">'+esc(c.short_name||c.name)+'</td>'+
      '<td style="font-size:11px;color:var(--t2)">'+tasks.join(', ')+'</td>'+
      '<td><select class="btn yr-assign" data-cid="'+c.id+'" style="font-size:12px"><option value="Atik Bhayani" selected>Atik Bhayani</option><option value="Rushiraj">Rushiraj</option><option value="Sahil">Sahil</option></select></td></tr>';
  }).join('');
}
function setAllYearAssign(name) { document.querySelectorAll('.yr-assign').forEach(function(s){s.value=name;}); }
function createYearTasks() {
  var y=parseInt(document.getElementById('yry').value);
  var assignees={};
  document.querySelectorAll('.yr-assign').forEach(function(s){assignees[s.dataset.cid]=s.value;});
  var btn=document.getElementById('yrbtn'); btn.disabled=true; btn.textContent='Creating...'; sync(true);
  api('yearTasks',{year:y,assignees:assignees}).then(function(r){
    sync(false); btn.disabled=false; btn.textContent='Create Tasks'; closeMo('mo-year');
    if(r.ok){alert('Created '+r.created+' yearly tasks for '+y); return api('getAll').then(function(a){if(a.ok){TASKS=a.tasks||[];renderDash();}});}
    else alert('Error: '+r.error);
  }).catch(function(e){sync(false);btn.disabled=false;btn.textContent='Create Tasks';alert('Error: '+e.message);});
}


function openAssignPicker(callback) {
  window._assignCallback = callback;
  document.getElementById('mo-assign').classList.add('on');
  document.getElementById('apsel').value = 'Rushiraj';
}
function confirmAssign() {
  var v = document.getElementById('apsel').value;
  closeMo('mo-assign');
  if (window._assignCallback) { window._assignCallback(v); window._assignCallback = null; }
}

function closeMo(id) { document.getElementById(id).classList.remove('on'); }
document.addEventListener('click', function(e) { if(e.target.classList.contains('mo')) e.target.classList.remove('on'); });
document.addEventListener('keydown', function(e) { if(e.key==='Escape') document.querySelectorAll('.mo.on').forEach(function(m){m.classList.remove('on');}); });
