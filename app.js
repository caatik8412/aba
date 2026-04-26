var URL = 'https://script.google.com/macros/s/AKfycbx2fNc9ribnFkaZN5nuT4N9tSK_y5UmmHAUZCzXcCchm4EdD4Tk5cjImFGAPxQvwPJ1/exec';
var CU=null,CLIENTS=[],TASKS=[],PENDING=[];
var TTAB='active',MTAB='active',TIMER=null;

function api(a,d){
  return fetch(URL+'?action='+a+'&d='+encodeURIComponent(JSON.stringify(d||{}))).then(function(r){return r.json();});
}

function doLogin(){
  var u=document.getElementById('lu').value.trim().toLowerCase();
  var p=document.getElementById('lp').value;
  var btn=document.getElementById('lbtn'),err=document.getElementById('le');
  err.style.display='none';
  if(!u||!p){err.textContent='Enter username and password';err.style.display='block';return;}
  btn.disabled=true;btn.textContent='Signing in...';
  api('login',{username:u,password:p}).then(function(r){
    if(!r.ok){err.textContent=r.error||'Login failed';err.style.display='block';btn.disabled=false;btn.textContent='Sign in';return;}
    CU=r.user;btn.textContent='Loading...';
    return api('getAll').then(function(a){
      if(a.ok){CLIENTS=a.clients||[];TASKS=a.tasks||[];PENDING=a.pending||[];}
      document.getElementById('login').style.display='none';
      document.getElementById('app').style.display='block';
      setup();
    });
  }).catch(function(e){err.textContent='Error: '+e.message;err.style.display='block';btn.disabled=false;btn.textContent='Sign in';});
}

function doLogout(){
  if(TIMER)clearInterval(TIMER);
  CU=null;CLIENTS=[];TASKS=[];PENDING=[];
  document.getElementById('app').style.display='none';
  document.getElementById('login').style.display='flex';
  document.getElementById('lp').value='';
  document.getElementById('lbtn').disabled=false;document.getElementById('lbtn').textContent='Sign in';
}

function setup(){
  var avm={'Atik Bhayani':'av0','Rushiraj':'av1','Sahil':'av2'};
  var im={'Atik Bhayani':'AB','Rushiraj':'RJ','Sahil':'SH'};
  var av=document.getElementById('uav');
  av.textContent=im[CU.name]||'?';av.className='av '+(avm[CU.name]||'av1');
  document.getElementById('uname').textContent=CU.name;
  document.getElementById('urole').textContent=CU.role==='admin'?'Admin':'Staff';
  fillSelects();
  if(CU.role==='admin'){
    document.getElementById('anav').style.display='block';
    go('dash',document.querySelector('#anav .ni'));
  } else {
    document.getElementById('snav').style.display='block';
    go('mine',document.querySelector('#snav .ni'));
  }
  var countdown=30;
  TIMER=setInterval(function(){
    countdown--;
    var st=document.getElementById('stext');
    if(st&&st.textContent!=='Saving...'&&st.textContent!=='Synced')st.textContent='Refresh in '+countdown+'s';
    if(countdown<=0){
      countdown=30;
      var ae=document.activeElement;
      if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'))return;
      silentRefresh();
    }
  },1000);
}

function sync(on){
  var d=document.getElementById('sdot'),t=document.getElementById('stext');
  if(on){d.classList.add('sp');t.textContent='Saving...';}
  else{d.classList.remove('sp');t.textContent='Synced';}
}

function refresh(){
  sync(true);
  api('getAll').then(function(r){
    if(r.ok){CLIENTS=r.clients||[];TASKS=r.tasks||[];PENDING=r.pending||[];}
    sync(false);fillSelects();
    var pg=document.querySelector('.pg.on');
    if(pg){
      var pgid=pg.id.replace('p-','');
      // Force reload for dates since it depends on CLIENTS
      if(pgid==='dates'){
        var ddm=document.getElementById('ddmon');
        if(ddm)delete ddm.dataset.init; // allow re-init
      }
      renderPage(pgid);
    }
    var t=document.getElementById('stext');
    t.textContent='Updated '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    setTimeout(function(){t.textContent='Live';},3000);
  }).catch(function(){sync(false);});
}

function silentRefresh(){
  api('getAll').then(function(r){
    if(r.ok){CLIENTS=r.clients||[];TASKS=r.tasks||[];PENDING=r.pending||[];}
    var pg=document.querySelector('.pg.on');
    if(pg)renderPage(pg.id.replace('p-',''));
    fillSelects();
  }).catch(function(){});
}

function go(pg,el){
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('.ni').forEach(function(n){n.classList.remove('on');});
  var p=document.getElementById('p-'+pg);if(p)p.classList.add('on');
  if(el)el.classList.add('on');
  var titles={dash:'Dashboard',tasks:'Tasks',dates:'Due Dates',gst:'GST Compliance',clients:'Clients',pendoc:'Pending Documents',mine:'My Tasks'};
  document.getElementById('ptitle').textContent=titles[pg]||pg;
  var act=document.getElementById('pact');
  if(act){
    if(pg==='tasks'){
      act.innerHTML='<button class="btn btk" onclick="openTaskModal()">+ Add Task</button>';
    } else if(pg==='clients'&&CU&&CU.role==='admin'){
      act.innerHTML='<button class="btn btk" onclick="openAddClient()">+ Add Client</button>';
    } else {
      act.innerHTML='';
    }
  }
  renderPage(pg);
}

function renderPage(pg){
  if(pg==='dash')renderDash();
  if(pg==='tasks'){fillSel('tscl');renderTasks();}
  if(pg==='dates'){
    fillSel('ddcli');
    // Only set month on first visit
    var ddm=document.getElementById('ddmon');
    var ddy=document.getElementById('ddyr');
    if(ddm&&!ddm.dataset.init){
      var now=new Date();
      ddm.value=now.getMonth()+1;
      ddy.value=now.getFullYear();
      ddm.dataset.init='1';
    }
    renderDD();
  }
  if(pg==='gst')initGST();
  if(pg==='clients')renderClients();
  if(pg==='pendoc'){fillSel('pdcl');renderPD();}
  if(pg==='mine'){fillSel('mscl');renderMine();}
}

// HELPERS
function parseD(d){
  if(!d||d==='')return null;
  if(typeof d==='number')return new Date(Math.round((d-25569)*86400*1000));
  if(d instanceof Date)return d;
  var s=String(d).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s))return new Date(s.substring(0,10)+'T00:00:00');
  var dt=new Date(s);return isNaN(dt.getTime())?null:dt;
}
function fmt(d){var dt=parseD(d);if(!dt)return '-';return dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
function isOD(d){var dt=parseD(d);return dt&&dt<new Date(new Date().toDateString());}
function isSoon(d){var dt=parseD(d);if(!dt)return false;var x=(dt-new Date(new Date().toDateString()))/86400000;return x>=0&&x<=7;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');}
function gc(id){return CLIENTS.find(function(c){return c.id===id;});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5);}
function pArr(v){if(Array.isArray(v))return v;if(typeof v==='string'&&v[0]==='['){try{return JSON.parse(v);}catch(e){}}return [];}
function catBdg(c){var m={'GST':'bb','TDS':'bg','Income Tax':'ba','ROC / MCA':'bp','PF / ESIC':'bg','Audit':'br','Other':'bx'};return '<span class="bdg '+(m[c]||'bx')+'">'+esc(c)+'</span>';}
function whoBdg(w){var m={'Atik Bhayani':'bx','Rushiraj':'bb','Sahil':'bp'};return '<span class="bdg '+(m[w]||'bx')+'">'+esc(w)+'</span>';}
function stBdg(s){var m={pending:['ba','Pending'],inprogress:['bb','In Progress'],done:['bg','Done']};var r=m[s]||['bx',s];return '<span class="bdg '+r[0]+'">'+r[1]+'</span>';}
function pdot(d,s){
  if(s==='done')return '<div class="dot2 dd"></div>';
  if(isOD(d))return '<div class="dot2 dh"></div>';
  if(isSoon(d))return '<div class="dot2 dm"></div>';
  return '<div class="dot2 dl"></div>';
}
function dStyle(d,s){if(s==='done')return '';if(isOD(d))return 'style="color:var(--rd);font-weight:600"';if(isSoon(d))return 'style="color:var(--am);font-weight:500"';return '';}
function getT(id){return TASKS.find(function(t){return t.id===id;});}

function fillSelects(){fillSel('tscl');fillSel('tcli');fillSel('mscl');fillSel('ddcli');fillSel('pdcl');fillSel('pdcli');}
function fillSel(id){
  var el=document.getElementById(id);if(!el)return;
  var cur=el.value;
  var isSel=(id==='tcli'||id==='pdcli');
  el.innerHTML=(isSel?'<option value="">Select client</option>':'<option value="">All clients</option>')+
    CLIENTS.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('');
  if(cur)el.value=cur;
}

// DASHBOARD
function renderDash(){
  var ov=TASKS.filter(function(t){return t.status!=='done'&&isOD(t.due_date);}).length;
  var pe=TASKS.filter(function(t){return t.status==='pending'||t.status==='inprogress';}).length;
  var dn=TASKS.filter(function(t){return t.status==='done';}).length;
  document.getElementById('dstats').innerHTML=
    '<div class="stat"><div class="sl">Clients</div><div class="sv">'+CLIENTS.length+'</div></div>'+
    '<div class="stat"><div class="sl">Active Tasks</div><div class="sv" style="color:var(--am)">'+pe+'</div></div>'+
    '<div class="stat"><div class="sl">Overdue</div><div class="sv" style="color:var(--rd)">'+ov+'</div></div>'+
    '<div class="stat"><div class="sl">Completed</div><div class="sv" style="color:var(--gr)">'+dn+'</div></div>';
  var top=TASKS.filter(function(t){return t.status!=='done';}).sort(function(a,b){return new Date(a.due_date)-new Date(b.due_date);}).slice(0,8);
  document.getElementById('dtasks').innerHTML=top.length?top.map(function(t){
    return '<div class="trow">'+pdot(t.due_date,t.status)+
      '<div style="flex:1;font-size:12px;font-weight:500">'+esc(t.name)+'</div>'+
      '<div style="color:var(--t2);font-size:11px;min-width:80px">'+esc(t.client_name||'')+'</div>'+
      whoBdg(t.assignee)+
      '<div '+dStyle(t.due_date,t.status)+' style="font-size:11px;min-width:70px;text-align:right">'+fmt(t.due_date)+'</div></div>';
  }).join(''):'<div class="emp">All tasks up to date</div>';
  // Upcoming due dates - current + next month, not overdue
  var now=new Date(),m=now.getMonth()+1,y=now.getFullYear();
  var nm=m===12?1:m+1, ny=m===12?y+1:y;
  var dues=genDueDates(m,y).concat(genDueDates(nm,ny));
  dues=dues.filter(function(d){return !isOD(d.due);});
  dues.sort(function(a,b){return new Date(a.due)-new Date(b.due);});
  dues=dues.slice(0,8);
  document.getElementById('ddates').innerHTML=dues.length?dues.map(function(d){
    var linked=findLinkedTask(d.ddid);
    var st=linked?(linked.status==='done'?'<span class="bdg bg">Done</span>':stBdg(linked.status)):'<span class="bdg bx">Not started</span>';
    return '<div class="trow">'+
      '<div style="font-size:11px;font-weight:600;color:var(--bl);min-width:65px">'+fmt(d.due)+'</div>'+
      '<div style="flex:1;font-size:12px">'+esc(d.label)+'</div>'+
      '<div style="font-size:11px;color:var(--t2);min-width:70px">'+esc(d.cname)+'</div>'+
      st+'</div>';
  }).join(''):'<div class="emp">No upcoming dues this month</div>';
  var pend=PENDING.filter(function(d){return !d.received;});
  document.getElementById('dpend').innerHTML=pend.length?pend.slice(0,6).map(function(d){
    return '<div class="trow">'+pdot(d.needed_by,'pending')+
      '<div style="flex:1;font-size:12px;font-weight:500">'+esc(d.name)+'</div>'+
      '<div style="color:var(--t2);font-size:11px;min-width:90px">'+esc(d.client_name||'')+'</div>'+
      '<div '+dStyle(d.needed_by,'pending')+' style="font-size:11px">'+fmt(d.needed_by)+'</div></div>';
  }).join(''):'<div class="emp">No pending document requests</div>';
}

// DUE DATES ENGINE
// Generate due dates for a given display month/year
// Display month = month in which the return is DUE (not the period)
// e.g. April display -> March GSTR-3B (due 20 Apr), March GSTR-1 (due 11 Apr)
function genDueDates(dispMonth, dispYear){
  var dues=[];
  // Period month = previous month (for monthly returns due in this month)
  var pm=dispMonth===1?12:dispMonth-1;
  var py=dispMonth===1?dispYear-1:dispYear;
  var isQE=(pm%3===0); // is period month a quarter end?
  var mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var period=mn[pm-1]+' '+py;

  function dd(cid,cname,label,due,cat,type,pMonth,pYear){
    var ddid=cid+'_'+type+'_'+pMonth+'_'+pYear;
    dues.push({ddid:ddid,cid:cid,cname:cname,label:label,due:due,cat:cat,type:type,period:period});
  }
  function dtStr(y,m,d){return y+'-'+(m<10?'0'+m:m)+'-'+(d<10?'0'+d:d);}

  CLIENTS.forEach(function(c){
    // Skip if client was added after period
    var cstart=c.start_date?new Date(c.start_date):new Date('2025-04-01');
    var periodEnd=new Date(py,pm-1,28);
    if(cstart>periodEnd)return;

    var g=c.gst_type||'none',f=c.gst_freq||'monthly',emp=c.has_employees==='yes';
    var cn=c.short_name||c.name;

    // Monthly GST filers
    if(g==='regular'&&f==='monthly'){
      dd(c.id,cn,'GSTR-1 | '+period,dtStr(dispYear,dispMonth,11),  'GST','GSTR-1',pm,py);
      dd(c.id,cn,'GSTR-3B | '+period,dtStr(dispYear,dispMonth,20), 'GST','GSTR-3B',pm,py);
    }
    // QRMP filers
    if(g==='regular'&&f==='quarterly'){
      if(isQE){
        dd(c.id,cn,'GSTR-1 Qtr | '+period,dtStr(dispYear,dispMonth,13),'GST','GSTR-1 (Quarterly)',pm,py);
        dd(c.id,cn,'GSTR-3B Qtr | '+period,dtStr(dispYear,dispMonth,22),'GST','GSTR-3B (Quarterly)',pm,py);
      } else {
        dd(c.id,cn,'PMT-06 | '+period,dtStr(dispYear,dispMonth,25),'GST','PMT-06',pm,py);
      }
    }
    // Composition
    if(g==='composition'&&isQE){
      dd(c.id,cn,'CMP-08 | '+period,dtStr(dispYear,dispMonth,18),'GST','CMP-08',pm,py);
    }
    // TDS Payment (due 7th of next month)
    if(emp){
      dd(c.id,cn,'TDS Payment | '+period,dtStr(dispYear,dispMonth,7),'TDS','TDS Payment',pm,py);
      dd(c.id,cn,'PF / ESIC | '+period,dtStr(dispYear,dispMonth,15),'PF / ESIC','PF / ESIC',pm,py);
    }
    // TDS Returns - due in Jul(Q1), Oct(Q2), Jan(Q3), May(Q4)
    if(emp&&(dispMonth===7||dispMonth===10||dispMonth===1||dispMonth===5)){
      var qmap={7:'Q1',10:'Q2',1:'Q3',5:'Q4'};
      var qday={7:31,10:31,1:31,5:31};
      dd(c.id,cn,'TDS Return '+qmap[dispMonth]+' | FY '+py+'-'+String(py+1).slice(2),
        dtStr(dispYear,dispMonth,qday[dispMonth]),'TDS','TDS Returns',pm,py);
    }
    // Annual compliances shown in their due month
    var audit=c.turnover==='above1cr';
    var pvt=c.entity==='Private Limited'||c.entity==='LLP';
    // ITR - Aug for non-audit, Oct for audit
    if(dispMonth===8&&!audit) dd(c.id,cn,'ITR Filing | FY '+py+'-'+String(py+1).slice(2),dtStr(dispYear,8,31),'Income Tax','ITR Filing',py,py);
    if(dispMonth===10&&audit) dd(c.id,cn,'ITR Filing | FY '+py+'-'+String(py+1).slice(2),dtStr(dispYear,10,31),'Income Tax','ITR Filing',py,py);
    // Tax Audit
    if(dispMonth===9&&audit) dd(c.id,cn,'Tax Audit 3CD | FY '+py+'-'+String(py+1).slice(2),dtStr(dispYear,9,30),'Audit','Tax Audit',py,py);
    // ROC
    if(dispMonth===10&&pvt) dd(c.id,cn,'ROC AOC-4 | FY '+py+'-'+String(py+1).slice(2),dtStr(dispYear,10,30),'ROC / MCA','ROC AOC-4',py,py);
    if(dispMonth===11&&pvt) dd(c.id,cn,'ROC MGT-7 | FY '+py+'-'+String(py+1).slice(2),dtStr(dispYear,11,29),'ROC / MCA','ROC MGT-7',py,py);
    // Advance Tax
    if(dispMonth===6) dd(c.id,cn,'Advance Tax Q1 | FY '+dispYear+'-'+String(dispYear+1).slice(2),dtStr(dispYear,6,15),'Income Tax','Advance Tax Q1',dispYear,dispYear);
    if(dispMonth===9) dd(c.id,cn,'Advance Tax Q2 | FY '+dispYear+'-'+String(dispYear+1).slice(2),dtStr(dispYear,9,15),'Income Tax','Advance Tax Q2',dispYear,dispYear);
    if(dispMonth===12) dd(c.id,cn,'Advance Tax Q3 | FY '+dispYear+'-'+String(dispYear+1).slice(2),dtStr(dispYear,12,15),'Income Tax','Advance Tax Q3',dispYear,dispYear);
    if(dispMonth===3) dd(c.id,cn,'Advance Tax Q4 | FY '+(dispYear-1)+'-'+String(dispYear).slice(2),dtStr(dispYear,3,15),'Income Tax','Advance Tax Q4',dispYear-1,dispYear-1);
    // GSTR-9 - Dec
    if(dispMonth===12&&c.gstr9_applicable==='yes') dd(c.id,cn,'GSTR-9 Annual | FY '+py+'-'+String(py+1).slice(2),dtStr(dispYear,12,31),'GST','GSTR-9',py,py);
  });

  dues.sort(function(a,b){return new Date(a.due)-new Date(b.due);});
  return dues;
}

function findLinkedTask(ddid){
  return TASKS.find(function(t){return t.dd_id===ddid;});
}

function renderDD(){
  var m=parseInt(document.getElementById('ddmon').value);
  var y=parseInt(document.getElementById('ddyr').value);
  var fc=(document.getElementById('ddcli')||{value:''}).value;
  var fcat=(document.getElementById('ddcat')||{value:''}).value;
  var dues=genDueDates(m,y);
  if(fc) dues=dues.filter(function(d){return d.cid===fc;});
  if(fcat) dues=dues.filter(function(d){return d.cat===fcat;});
  var body=document.getElementById('ddtb');if(!body)return;
  if(!dues.length){body.innerHTML='<tr><td colspan="7"><div class="emp">No due dates for this month</div></td></tr>';return;}
  body.innerHTML=dues.map(function(d){
    var linked=findLinkedTask(d.ddid);
    var od=isOD(d.due),sn=isSoon(d.due);
    var dateStyle=od?'color:var(--rd);font-weight:600':sn?'color:var(--am);font-weight:500':'color:var(--bl)';
    var parts=d.label.split(' | ');
    var compName=parts[0],periodLabel=parts[1]||'';
    var statusCell,actionCell;
    if(linked){
      statusCell=stBdg(linked.status);
      if(linked.status==='done'){
        actionCell='<span style="color:var(--gr);font-size:18px">&#10003;</span>';
      } else {
        actionCell='<button class="btn bts" onclick="openEditTask(\''+linked.id+'\')" style="margin-right:4px">Edit</button>'+
          '<button class="btn bts btg" onclick="ddMarkDone(\''+linked.id+'\',\''+d.ddid+'\')">&#10003; Done</button>';
      }
    } else {
      statusCell='<span class="bdg bx">Not started</span>';
      actionCell='<button class="btn bts" onclick="ddAddTask(\''+esc(d.ddid)+'\',\''+esc(d.cid)+'\',\''+esc(d.type)+'\',\''+esc(d.due)+'\',\''+esc(compName)+'\',\''+esc(d.cat)+'\')" style="margin-right:4px">+ Task</button>'+
        '<button class="btn bts btg" onclick="ddFiledDirect(\''+esc(d.ddid)+'\',\''+esc(d.cid)+'\',\''+esc(d.type)+'\',\''+esc(d.due)+'\',\''+esc(compName)+'\',\''+esc(d.cat)+'\')">&#10003; Done</button>';
    }
    return '<tr>'+
      '<td style="'+dateStyle+';white-space:nowrap;font-size:12px;font-weight:600">'+fmt(d.due)+'</td>'+
      '<td style="font-weight:500">'+esc(compName)+'</td>'+
      '<td style="font-size:11px;color:var(--t2)">'+esc(periodLabel)+'</td>'+
      '<td style="font-size:12px">'+esc(d.cname)+'</td>'+
      '<td>'+catBdg(d.cat)+'</td>'+
      '<td>'+statusCell+'</td>'+
      '<td style="white-space:nowrap">'+actionCell+'</td></tr>';
  }).join('');
}

function ddAddTask(ddid,cid,type,due,name,cat){
  if(findLinkedTask(ddid)){alert('Task already exists for this due date.');return;}
  // Open task modal pre-filled, linked to due date
  document.getElementById('tmtit').textContent='Add Task';
  document.getElementById('tid').value='';
  document.getElementById('tddid').value=ddid;
  document.getElementById('tname').value=name;
  document.getElementById('tdue').value=due;
  document.getElementById('tcat').value=cat||'GST';
  document.getElementById('tsts').value='pending';
  document.getElementById('tpri').value='high';
  document.getElementById('trm').value='';
  document.getElementById('tassdiv').style.display='block';
  document.getElementById('tass').value='Rushiraj';
  fillSel('tcli');
  document.getElementById('tcli').value=cid;
  document.getElementById('mo-task').classList.add('on');
}

function ddFiledDirect(ddid,cid,type,due,name,cat){
  if(findLinkedTask(ddid)){renderDD();return;} // already exists
  var c=gc(cid);if(!c)return;
  var task={id:uid(),dd_id:ddid,name:name,client_id:cid,client_name:c.short_name||c.name,
    category:cat,assignee:CU.name,due_date:due,status:'done',priority:'high',
    remarks:name+' completed',type:'manual',compliance_type:type,created_by:CU.name};
  sync(true);TASKS.push(task);
  api('saveTask',task).then(function(){sync(false);renderDD();renderDash();}).catch(function(e){alert('Error: '+e.message);});
}

function ddMarkDone(tid,ddid){
  var t=getT(tid);if(!t)return;
  if(!t.remarks||!t.remarks.trim()){
    t.remarks=t.name+' completed';
    api('saveTask',t);
  }
  t.status='done';sync(true);
  api('saveTask',t).then(function(){sync(false);renderDD();renderDash();renderTasks();});
}

// TASKS
function setTTab(tab,el){
  TTAB=tab;
  document.querySelectorAll('#p-tasks .tabs .tab').forEach(function(t){t.classList.remove('on');});
  if(el)el.classList.add('on');
  renderTasks();
}
function renderTasks(){
  var q=(document.getElementById('tsq')||{value:''}).value.toLowerCase();
  var fc=(document.getElementById('tscl')||{value:''}).value;
  var fa=(document.getElementById('tsas')||{value:''}).value;
  var fcat=(document.getElementById('tscat')||{value:''}).value;
  var t=TASKS.slice();
  if(TTAB==='done')t=t.filter(function(x){return x.status==='done';});
  else t=t.filter(function(x){return x.status!=='done';});
  if(q)t=t.filter(function(x){return x.name.toLowerCase().indexOf(q)>-1||(x.client_name||'').toLowerCase().indexOf(q)>-1;});
  if(fc)t=t.filter(function(x){return x.client_id===fc;});
  if(fa)t=t.filter(function(x){return x.assignee===fa;});
  if(fcat)t=t.filter(function(x){return x.category===fcat;});
  t.sort(function(a,b){return new Date(a.due_date)-new Date(b.due_date);});
  var isAdmin=CU&&CU.role==='admin';
  var body=document.getElementById('ttb');if(!body)return;
  if(!t.length){body.innerHTML='<tr><td colspan="9"><div class="emp">'+(TTAB==='done'?'No completed tasks':'No active tasks')+'</div></td></tr>';return;}
  body.innerHTML=t.map(function(tk){
    var edit='<button class="btn bts" onclick="openEditTask(\''+tk.id+'\')">Edit</button>';
    var done=TTAB==='done'?'':'<button class="btn bts btg" onclick="markDone(\''+tk.id+'\')">Done</button>';
    var rev=TTAB==='done'?'<button class="btn bts" style="background:var(--am-b);color:var(--am)" onclick="revertT(\''+tk.id+'\')">Revert</button>':'';
    var del=isAdmin?'<button class="btn bts btr" onclick="delT(\''+tk.id+'\')">Del</button>':'';
    return '<tr><td>'+pdot(tk.due_date,tk.status)+'</td>'+
      '<td style="font-weight:500;min-width:140px">'+esc(tk.name)+'</td>'+
      '<td style="font-size:12px;color:var(--t2)">'+esc(tk.client_name||'')+'</td>'+
      '<td>'+catBdg(tk.category)+'</td>'+
      '<td>'+whoBdg(tk.assignee)+'</td>'+
      '<td '+dStyle(tk.due_date,tk.status)+' style="white-space:nowrap;font-size:12px">'+fmt(tk.due_date)+'</td>'+
      '<td>'+stBdg(tk.status)+'</td>'+
      '<td><input class="ri" value="'+esc(tk.remarks||'')+'" placeholder="Add remark..." onchange="qRem(\''+tk.id+'\',this.value)"></td>'+
      '<td style="display:flex;gap:3px">'+edit+done+rev+del+'</td></tr>';
  }).join('');
}
function qRem(id,v){var t=getT(id);if(!t)return;t.remarks=v;sync(true);api('saveTask',t).then(function(){sync(false);});}
function markDone(id){
  var t=getT(id);if(!t)return;
  if(!t.remarks||!t.remarks.trim()){
    // Auto-fill remark
    var ri=document.querySelector('input.ri[onchange*="'+id+'"]');
    var autoRem=t.name+' completed';
    if(ri){ri.value=autoRem;}
    t.remarks=autoRem;
    api('saveTask',t); // save remark first
  }
  t.status='done';sync(true);api('saveTask',t).then(function(){sync(false);renderTasks();renderDash();
    var ddpg=document.getElementById('p-dates');if(ddpg&&ddpg.classList.contains('on'))renderDD();
  });
}
function revertT(id){var t=getT(id);if(!t)return;t.status='pending';sync(true);api('saveTask',t).then(function(){sync(false);renderTasks();renderDash();});}
function delT(id){if(!confirm('Delete this task?'))return;sync(true);api('delTask',{id:id}).then(function(){TASKS=TASKS.filter(function(t){return t.id!==id;});sync(false);renderTasks();renderDash();});}


function openEditTask(id){
  var tk=getT(id);if(!tk)return;
  document.getElementById('tmtit').textContent='Edit Task';
  document.getElementById('tid').value=tk.id;document.getElementById('tddid').value=tk.dd_id||'';
  document.getElementById('tname').value=tk.name;document.getElementById('tdue').value=tk.due_date;
  document.getElementById('tcat').value=tk.category;document.getElementById('tass').value=tk.assignee;
  document.getElementById('tpri').value=tk.priority;document.getElementById('tsts').value=tk.status;
  document.getElementById('trm').value=tk.remarks||'';document.getElementById('tassdiv').style.display='block';
  fillSel('tcli');document.getElementById('tcli').value=tk.client_id||'';
  document.getElementById('mo-task').classList.add('on');
}
function saveTask(){
  var name=document.getElementById('tname').value.trim();
  var cid=document.getElementById('tcli').value;
  var due=document.getElementById('tdue').value;
  if(!name||!cid||!due){alert('Fill task name, client and due date.');return;}
  var client=gc(cid);
  var assignee=CU.role==='staff'?CU.name:document.getElementById('tass').value;
  var eid=document.getElementById('tid').value;
  var ddid=document.getElementById('tddid').value;
  var payload={id:eid||uid(),dd_id:ddid||null,name:name,client_id:cid,
    client_name:client?(client.short_name||client.name):'',
    category:document.getElementById('tcat').value,assignee:assignee,due_date:due,
    priority:document.getElementById('tpri').value,status:document.getElementById('tsts').value,
    remarks:document.getElementById('trm').value.trim(),type:'manual',created_by:CU.name};
  var btn=document.getElementById('tsavebtn');btn.disabled=true;btn.textContent='Saving...';sync(true);
  api('saveTask',payload).then(function(){
    if(eid){var i=TASKS.findIndex(function(t){return t.id===eid;});if(i>-1)TASKS[i]=payload;}else TASKS.push(payload);
    sync(false);closeMo('mo-task');
    renderTasks();renderDash();
    var ddpg=document.getElementById('p-dates');if(ddpg&&ddpg.classList.contains('on'))renderDD();
    if(CU.role!=='admin')renderMine();
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent='Save Task';});
}

// MY TASKS (Staff)
function setMTab(tab,el){
  MTAB=tab;
  document.querySelectorAll('#p-mine .tabs .tab').forEach(function(t){t.classList.remove('on');});
  if(el)el.classList.add('on');renderMine();
}
function renderMine(){
  var fc=(document.getElementById('mscl')||{value:''}).value;
  var my=TASKS.filter(function(t){return t.assignee===CU.name;});
  if(MTAB==='done')my=my.filter(function(t){return t.status==='done';});
  else my=my.filter(function(t){return t.status!=='done';});
  if(fc)my=my.filter(function(t){return t.client_id===fc;});
  my.sort(function(a,b){return new Date(a.due_date)-new Date(b.due_date);});
  var all=TASKS.filter(function(t){return t.assignee===CU.name;});
  var ov=all.filter(function(t){return t.status!=='done'&&isOD(t.due_date);}).length;
  var sw=all.filter(function(t){return t.status!=='done'&&isSoon(t.due_date);}).length;
  var dn=all.filter(function(t){return t.status==='done';}).length;
  document.getElementById('mystats').innerHTML=
    '<div class="stat"><div class="sl">Overdue</div><div class="sv" style="color:var(--rd)">'+ov+'</div></div>'+
    '<div class="stat"><div class="sl">Due this week</div><div class="sv" style="color:var(--am)">'+sw+'</div></div>'+
    '<div class="stat"><div class="sl">Completed</div><div class="sv" style="color:var(--gr)">'+dn+'</div></div>';
  var body=document.getElementById('mtb');if(!body)return;
  if(!my.length){body.innerHTML='<tr><td colspan="8"><div class="emp">'+(MTAB==='done'?'No completed tasks':'No active tasks')+'</div></td></tr>';return;}
  body.innerHTML=my.map(function(tk){
    var edit='<button class="btn bts" onclick="openEditTask(\''+tk.id+'\')">Edit</button>';
    var done=MTAB==='done'?'':'<button class="btn bts btg" onclick="stfDone(\''+tk.id+'\')">Done</button>';
    var rev=MTAB==='done'?'<button class="btn bts" style="background:var(--am-b);color:var(--am)" onclick="revertT(\''+tk.id+'\')">Revert</button>':'';
    return '<tr><td>'+pdot(tk.due_date,tk.status)+'</td>'+
      '<td style="font-weight:500;min-width:140px">'+esc(tk.name)+'</td>'+
      '<td style="font-size:12px;color:var(--t2)">'+esc(tk.client_name||'')+'</td>'+
      '<td>'+catBdg(tk.category)+'</td>'+
      '<td '+dStyle(tk.due_date,tk.status)+' style="white-space:nowrap;font-size:12px">'+fmt(tk.due_date)+'</td>'+
      '<td>'+stBdg(tk.status)+'</td>'+
      '<td><input class="ri" value="'+esc(tk.remarks||'')+'" placeholder="Add remark..." onchange="qRem(\''+tk.id+'\',this.value)"></td>'+
      '<td style="display:flex;gap:3px">'+edit+done+rev+'</td></tr>';
  }).join('');
}
function stfDone(id){
  var t=getT(id);if(!t)return;
  if(!t.remarks||!t.remarks.trim()){
    var autoRem=t.name+' completed';
    var ri=document.querySelector('input.ri[onchange*="'+id+'"]');
    if(ri)ri.value=autoRem;
    t.remarks=autoRem;
    api('saveTask',t);
  }
  t.status='done';sync(true);api('saveTask',t).then(function(){sync(false);renderMine();});
}

// GST COMPLIANCE
function initGST(){
  var gm=document.getElementById('gstm'),gy=document.getElementById('gsty');
  if(!gm.options.length){
    var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach(function(m,i){var o=document.createElement('option');o.value=i+1;o.text=m;gm.appendChild(o);});
    var now=new Date();gm.value=now.getMonth()+1;
    for(var y=2026;y<=2028;y++){var o=document.createElement('option');o.value=y;o.text=y;gy.appendChild(o);}
    gy.value=now.getFullYear();
    loadGST();
  }
}
function loadGST(){
  var m=parseInt(document.getElementById('gstm').value);
  var y=parseInt(document.getElementById('gsty').value);
  var card=document.getElementById('gcard');
  card.innerHTML='<div class="emp">Loading...</div>';sync(true);
  api('getGST',{month:m,year:y}).then(function(r){
    sync(false);
    if(!r.ok){card.innerHTML='<div class="emp">Error: '+r.error+'</div>';return;}
    renderGST(r,m);
  }).catch(function(e){sync(false);card.innerHTML='<div class="emp">Error: '+e.message+'</div>';});
}
function renderGST(res,mnum){
  var card=document.getElementById('gcard');
  if(!res.rows||!res.rows.length){card.innerHTML='<div class="emp">No GST clients found</div>';return;}
  var mn=mnum||parseInt(document.getElementById('gstm').value);
  var html='<div style="margin-bottom:14px;font-size:13px;font-weight:600">GST Compliance - '+res.month+'</div>';
  html+='<div class="tw"><table><thead><tr><th>#</th><th>Client</th><th>GSTIN</th><th>Type</th><th>R1/IFF Due</th><th style="text-align:center">R1 Filed</th><th>3B/PMT Due</th><th style="text-align:center">3B Filed</th></tr></thead><tbody>';
  res.rows.forEach(function(r,i){
    var isQ=r.gst_freq==='quarterly',isCmp=r.gst_type==='composition';
    var typeBdg=isCmp?'<span class="bdg ba">CMP</span>':isQ?'<span class="bdg bp">QRMP</span>':'<span class="bdg bb">Monthly</span>';
    var r1d=r.r1Due?fmt(r.r1Due)+' ('+r.r1Label+')':'-';
    var r3d=r.r3bDue?fmt(r.r3bDue)+' ('+r.r3bLabel+')':'-';
    var r1c=r.r1_filed||false,r3c=r.r3b_filed||false;
    var both=r1c&&(!r.r3bDue||r3c);
    html+='<tr'+(both?' style="opacity:0.5"':'')+'>';
    html+='<td>'+(i+1)+'</td><td style="font-weight:500">'+esc(r.name)+'</td>';
    html+='<td style="font-family:monospace;font-size:11px">'+esc(r.gstin||'-')+'</td>';
    html+='<td>'+typeBdg+'</td><td style="font-size:12px">'+r1d+'</td>';
    html+='<td style="text-align:center"><input type="checkbox" '+(r1c?'checked':'')+
      ' data-cid="'+r.id+'" data-field="r1" data-year="'+res.year+'" data-month="'+mn+'"'+
      ' onchange="tickGST(this)" style="width:18px;height:18px;cursor:pointer"></td>';
    html+='<td style="font-size:12px">'+r3d+'</td>';
    html+='<td style="text-align:center"><input type="checkbox" '+(r3c?'checked':'')+
      ' data-cid="'+r.id+'" data-field="r3b" data-year="'+res.year+'" data-month="'+mn+'"'+
      ' onchange="tickGST(this)" style="width:18px;height:18px;cursor:pointer"></td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  card.innerHTML=html;
}
function tickGST(el){
  var cid=el.dataset.cid,field=el.dataset.field;
  var year=parseInt(el.dataset.year),month=parseInt(el.dataset.month);
  var val=el.checked;
  el.disabled=true;sync(true);
  api('tickGST',{client_id:cid,field:field,value:val,year:year,month:month})
    .then(function(){
      return api('getGST',{month:month,year:year});
    })
    .then(function(r){
      sync(false);
      if(r&&r.ok)renderGST(r,month);
      else el.disabled=false;
    })
    .catch(function(e){sync(false);el.disabled=false;alert('Error: '+e.message);el.checked=!val;});
}

// CLIENTS
var CRULES=[
  {name:'GSTR-1',       freq:'Monthly',   rule:function(c){return c.gst==='regular'&&c.gstf==='monthly';}},
  {name:'GSTR-3B',      freq:'Monthly',   rule:function(c){return c.gst==='regular'&&c.gstf==='monthly';}},
  {name:'GSTR-1 Qtr',   freq:'Quarterly', rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'GSTR-3B Qtr',  freq:'Quarterly', rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'PMT-06',       freq:'Monthly',   rule:function(c){return c.gst==='regular'&&c.gstf==='quarterly';}},
  {name:'CMP-08',       freq:'Quarterly', rule:function(c){return c.gst==='composition';}},
  {name:'TDS Payment',  freq:'Monthly',   rule:function(c){return c.emp==='yes';}},
  {name:'PF / ESIC',    freq:'Monthly',   rule:function(c){return c.emp==='yes';}},
  {name:'TDS Returns',  freq:'Quarterly', rule:function(c){return c.emp==='yes';}},
  {name:'Advance Tax',  freq:'4 dates',   rule:function(){return true;}},
  {name:'ITR',          freq:'Annual',    rule:function(){return true;}},
  {name:'Tax Audit',    freq:'Annual',    rule:function(c){return c.tov==='above1cr';}},
  {name:'ROC AOC-4',    freq:'Annual',    rule:function(c){return c.ent==='Private Limited'||c.ent==='LLP';}},
  {name:'ROC MGT-7',    freq:'Annual',    rule:function(c){return c.ent==='Private Limited'||c.ent==='LLP';}}
];
function renderClients(q){
  if(!q)q='';
  var list=q?CLIENTS.filter(function(c){return c.name.toLowerCase().indexOf(q.toLowerCase())>-1||(c.pan||'').toLowerCase().indexOf(q.toLowerCase())>-1;}):CLIENTS.slice();
  buildCliTable(list);
}
function filterEnt(tp){buildCliTable(tp?CLIENTS.filter(function(c){return c.entity===tp;}):CLIENTS);}
function buildCliTable(list){
  var body=document.getElementById('ctb');if(!body)return;
  var oc=function(id){return TASKS.filter(function(t){return t.client_id===id&&t.status!=='done';}).length;};
  if(!list.length){body.innerHTML='<tr><td colspan="7"><div class="emp">No clients</div></td></tr>';return;}
  body.innerHTML=list.map(function(c){
    var freq=c.gst_type==='none'?'<span class="bdg bx">No GST</span>':c.gst_freq==='quarterly'?'<span class="bdg bp">QRMP</span>':c.gst_type==='composition'?'<span class="bdg ba">CMP</span>':'<span class="bdg bb">Monthly</span>';
    return '<tr><td style="font-weight:500">'+esc(c.name)+'</td>'+
      '<td><span class="bdg bx">'+esc(c.entity||'')+'</span></td>'+
      '<td style="font-family:monospace;font-size:12px">'+(c.pan||'-')+'</td>'+
      '<td style="font-family:monospace;font-size:12px">'+(c.gstin||'-')+'</td>'+
      '<td>'+freq+'</td>'+
      '<td>'+(oc(c.id)>0?'<span class="bdg ba">'+oc(c.id)+' open</span>':'<span class="bdg bg">Clear</span>')+'</td>'+
      '<td style="display:flex;gap:4px"><button class="btn bts" onclick="openEditClient(\''+c.id+'\')">Edit</button><button class="btn bts btr" onclick="delCli(\''+c.id+'\')">Remove</button></td></tr>';
  }).join('');
}
function delCli(id){if(!confirm('Remove this client?'))return;sync(true);api('delClient',{id:id}).then(function(){CLIENTS=CLIENTS.filter(function(c){return c.id!==id;});sync(false);renderClients();fillSelects();});}
function updComps(){
  var cfg={gst:document.getElementById('cgst').value,gstf:document.getElementById('cgstf').value,emp:document.getElementById('cemp').value,tov:document.getElementById('ctov').value,ent:document.getElementById('cent').value};
  var gn=cfg.gst==='none';
  document.getElementById('gstidiv').style.display=gn?'none':'block';
  document.getElementById('gstfdiv').style.display=gn?'none':'block';
  var on=CRULES.filter(function(r){return r.rule(cfg);});
  document.getElementById('ccnt').textContent=on.length;
  document.getElementById('cpllist').innerHTML=CRULES.map(function(r){
    var ok=r.rule(cfg);var cid2='chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_');
    return '<div class="cpi" style="'+(ok?'':'opacity:.4')+'">'+(ok?'<input type="checkbox" id="'+cid2+'" checked style="width:15px;height:15px;cursor:pointer;flex-shrink:0">':'<div style="width:15px;height:15px;background:var(--b);border-radius:3px;flex-shrink:0"></div>')+
      '<div style="font-size:12px;flex:1">'+r.name+'</div><div style="font-size:10px;color:var(--t3)">'+r.freq+'</div></div>';
  }).join('');
}
function getCheckedComps(){return CRULES.filter(function(r){var el=document.getElementById('chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_'));return el&&el.checked;}).map(function(r){return r.name;});}
function openAddClient(){
  document.getElementById('cid').value='';
  ['cname','cpan','cgstin','cemail','cnotes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('cent').value='';document.getElementById('cgst').value='regular';
  document.getElementById('cgstf').value='monthly';document.getElementById('cemp').value='no';
  document.getElementById('ctov').value='below40l';
  document.getElementById('cstart').value=new Date().toISOString().split('T')[0];
  document.getElementById('cmtit').textContent='Add Client';
  document.getElementById('csavebtn').textContent='Save Client';
  updComps();document.getElementById('mo-client').classList.add('on');
}
function openEditClient(id){
  var c=gc(id);if(!c)return;
  document.getElementById('cid').value=c.id;
  document.getElementById('cname').value=c.name||'';document.getElementById('cpan').value=c.pan||'';
  document.getElementById('cgstin').value=c.gstin||'';document.getElementById('cemail').value=c.email||'';
  document.getElementById('cnotes').value=c.notes||'';document.getElementById('cent').value=c.entity||'';
  document.getElementById('cgst').value=c.gst_type||'regular';document.getElementById('cgstf').value=c.gst_freq||'monthly';
  document.getElementById('cemp').value=c.has_employees||'no';document.getElementById('ctov').value=c.turnover||'below40l';
  document.getElementById('cstart').value=c.start_date||'2026-04-01';
  document.getElementById('cmtit').textContent='Edit Client';document.getElementById('csavebtn').textContent='Update Client';
  var existing=pArr(c.compliances);updComps();
  if(existing.length)CRULES.forEach(function(r){var el=document.getElementById('chk_'+r.name.replace(/[^a-zA-Z0-9]/g,'_'));if(el)el.checked=existing.indexOf(r.name)>-1;});
  document.getElementById('mo-client').classList.add('on');
}
function saveClient(){
  var name=document.getElementById('cname').value.trim();
  var pan=document.getElementById('cpan').value.trim().toUpperCase();
  var entity=document.getElementById('cent').value;
  if(!name||!pan||!entity){alert('Fill client name, PAN and entity type.');return;}
  var comps=getCheckedComps();
  var short=name.split(' ').filter(function(w){return w.length>2;}).map(function(w){return w[0];}).join('').toUpperCase()||name.slice(0,6);
  var eid=document.getElementById('cid').value;
  var payload={id:eid||uid(),name:name,short_name:short,entity:entity,pan:pan,
    gst_type:document.getElementById('cgst').value,gst_freq:document.getElementById('cgstf').value,
    gstin:document.getElementById('cgstin').value.trim().toUpperCase(),
    has_employees:document.getElementById('cemp').value,turnover:document.getElementById('ctov').value,
    start_date:document.getElementById('cstart').value,
    email:document.getElementById('cemail').value.trim(),notes:document.getElementById('cnotes').value.trim(),
    compliances:comps};
  var btn=document.getElementById('csavebtn');btn.disabled=true;btn.textContent='Saving...';sync(true);
  api('saveClient',payload).then(function(){
    if(eid){var i=CLIENTS.findIndex(function(c){return c.id===eid;});if(i>-1)CLIENTS[i]=payload;}else CLIENTS.push(payload);
    sync(false);closeMo('mo-client');renderClients();fillSelects();
    var ddpg=document.getElementById('p-dates');
    if(ddpg&&ddpg.classList.contains('on'))renderDD();
    alert((eid?'Updated':'Added')+': '+name);
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent=eid?'Update Client':'Save Client';});
}

// PENDING DOCS
function renderPD(){
  var fc=(document.getElementById('pdcl')||{value:''}).value;
  var list=PENDING.slice();if(fc)list=list.filter(function(d){return d.client_id===fc;});
  list.sort(function(a,b){return new Date(a.needed_by||'2099-12-31')-new Date(b.needed_by||'2099-12-31');});
  var el=document.getElementById('pdlist');if(!el)return;
  el.innerHTML=list.length?list.map(function(d){
    var od=isOD(d.needed_by),sn=isSoon(d.needed_by);
    var cls=od?'br':sn?'ba':'bx';
    var act=d.received?'<span class="bdg bg">Received</span>':'<button class="btn bts btg" onclick="markRec(\''+d.id+'\')">Received</button>';
    return '<div class="dr"><div style="width:28px;height:28px;background:var(--am-b);color:var(--am);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">!</div>'+
      '<div style="flex:1"><div style="font-weight:500">'+esc(d.name)+'</div><div style="font-size:11px;color:var(--t2)">'+esc(d.client_name||'')+' - '+esc(d.category||'')+(d.remarks?' - '+esc(d.remarks):'')+'</div></div>'+
      '<span class="bdg '+cls+'">'+(d.needed_by?fmt(d.needed_by):'No date')+'</span>'+act+
      '<button class="btn bts btr" onclick="delPD(\''+d.id+'\')">Del</button></div>';
  }).join(''):'<div class="emp">No pending document requests</div>';
}
function openPDModal(){document.getElementById('pdid').value='';document.getElementById('pdname').value='';document.getElementById('pddue').value='';document.getElementById('pdrm').value='';fillSel('pdcli');document.getElementById('mo-pd').classList.add('on');}
function savePD(){
  var cid=document.getElementById('pdcli').value,name=document.getElementById('pdname').value.trim();
  if(!cid||!name){alert('Select client and enter document name.');return;}
  var client=gc(cid);
  var eid=document.getElementById('pdid').value;
  var payload={id:eid||uid(),client_id:cid,client_name:client?(client.short_name||client.name):'',name:name,
    category:document.getElementById('pdcat').value,needed_by:document.getElementById('pddue').value,
    remarks:document.getElementById('pdrm').value.trim(),received:false,created_by:CU.name};
  var btn=document.getElementById('pdsavebtn');btn.disabled=true;btn.textContent='Saving...';sync(true);
  api('savePD',payload).then(function(){
    if(eid){var i=PENDING.findIndex(function(d){return d.id===eid;});if(i>-1)PENDING[i]=payload;}else PENDING.push(payload);
    sync(false);closeMo('mo-pd');renderPD();renderDash();
  }).catch(function(e){alert('Error: '+e.message);}).then(function(){btn.disabled=false;btn.textContent='Save';});
}
function markRec(id){var d=PENDING.find(function(x){return x.id===id;});if(!d)return;d.received=true;sync(true);api('savePD',d).then(function(){sync(false);renderPD();renderDash();});}
function delPD(id){if(!confirm('Delete?'))return;sync(true);api('delPD',{id:id}).then(function(){PENDING=PENDING.filter(function(d){return d.id!==id;});sync(false);renderPD();renderDash();});}

// MONTHLY TASKS MODAL








function openTaskModal(){
  document.getElementById('tmtit').textContent='Add Task';
  document.getElementById('tid').value='';document.getElementById('tddid').value='';
  document.getElementById('tname').value='';document.getElementById('tdue').value='';
  document.getElementById('trm').value='';document.getElementById('tsts').value='pending';
  document.getElementById('tpri').value='medium';document.getElementById('tcat').value='GST';
  var ad=document.getElementById('tassdiv'),as=document.getElementById('tass');
  if(CU.role==='staff'){as.value=CU.name;ad.style.display='none';}else{ad.style.display='block';as.value='Atik Bhayani';}
  fillSel('tcli');document.getElementById('mo-task').classList.add('on');
}

function closeMo(id){document.getElementById(id).classList.remove('on');}
document.addEventListener('click',function(e){if(e.target.classList.contains('mo'))e.target.classList.remove('on');});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.mo.on').forEach(function(m){m.classList.remove('on');});});
