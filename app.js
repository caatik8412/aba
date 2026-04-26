// ==========================
// 🔗 API URL
// ==========================
const URL = "https://script.google.com/macros/s/AKfycbwmhgsslgn5wG2N-1QqdOu5pL4MGk_9DFmnMxZfaRayTBYWAsuIIktJbgQUR5V9vqPO4Q/exec";

// ==========================
// 📦 GLOBAL DATA
// ==========================
let CLIENTS = [];
let TASKS = [];

// ==========================
// 🌐 API CALL
// ==========================
function api(action, data) {
  const url = URL + "?action=" + action + "&d=" + encodeURIComponent(JSON.stringify(data || {}));
  return fetch(url).then(res => res.json());
}

// ==========================
// 📥 LOAD DATA
// ==========================
function loadData() {
  api("getAllNew").then(res => {
    CLIENTS = res.clients;
    TASKS = res.tasks;

    renderDueDates();
    renderTasks();
  });
}

// ==========================
// 📅 COMPLIANCE RULES
// ==========================
const CAL = [
  { name:"GSTR-1", day:11, type:"GST" },
  { name:"GSTR-3B", day:20, type:"GST" },
  { name:"TDS Payment", day:7, type:"TDS" },
  { name:"PF Payment", day:15, type:"PF" }
];

// ==========================
// 🔍 FIND EXISTING TASK
// ==========================
function findTask(cid, name, m, y) {
  return TASKS.find(t =>
    t.client_id == cid &&
    t.name == name &&
    parseInt(t.period_month) == m &&
    parseInt(t.period_year) == y
  );
}

// ==========================
// 📅 RENDER DUE DATES
// ==========================
function renderDueDates() {
  const body = document.getElementById("dueBody");

  const m = new Date().getMonth() + 1;
  const y = new Date().getFullYear();

  let html = "";

  CLIENTS.forEach(c => {

    CAL.forEach(d => {

      // rule filtering
      if (d.type === "GST" && !c.gst_type) return;
      if (d.type === "TDS" && c.tds !== "yes") return;
      if (d.type === "PF" && c.pf !== "yes") return;

      const date = new Date(y, m-1, d.day);
      const existing = findTask(c.id, d.name, m, y);

      let status = "⚪ Not Added";
      if (existing) {
        status = existing.status === "done" ? "✅ Done" : "🟡 Task Created";
      }

      html += `
        <tr>
          <td>${c.name}</td>
          <td>${d.name}</td>
          <td>${date.toDateString()}</td>
          <td>${status}</td>
          <td>
            ${
              !existing ?
              `
              <button onclick="addTask('${c.id}','${d.name}','${date.toISOString()}')">+ Task</button>
              <button onclick="markDone('${c.id}','${d.name}','${date.toISOString()}')">✓ Done</button>
              `
              :
              `-`
            }
          </td>
        </tr>
      `;
    });

  });

  body.innerHTML = html || "<tr><td colspan='5'>No data</td></tr>";
}

// ==========================
// ➕ ADD TASK
// ==========================
function addTask(cid, name, dateISO) {

  const client = CLIENTS.find(c => c.id == cid);

  const payload = {
    id: Date.now().toString(),
    name: name,
    client_id: cid,
    client_name: client.name,
    due_date: dateISO,
    status: "pending",
    category: "Compliance",
    assignee: "Atik",
    period_month: new Date(dateISO).getMonth()+1,
    period_year: new Date(dateISO).getFullYear(),
    remarks: "",
    type: "compliance"
  };

  api("saveTaskNew", payload).then(() => {
    alert("Task Created");
    loadData();
  });
}

// ==========================
// ✅ MARK DONE
// ==========================
function markDone(cid, name, dateISO) {

  const client = CLIENTS.find(c => c.id == cid);

  const payload = {
    id: Date.now().toString(),
    name: name,
    client_id: cid,
    client_name: client.name,
    due_date: dateISO,
    status: "done",
    category: "Compliance",
    assignee: "Atik",
    period_month: new Date(dateISO).getMonth()+1,
    period_year: new Date(dateISO).getFullYear(),
    remarks: "Done directly",
    type: "compliance"
  };

  api("saveTaskNew", payload).then(() => {
    alert("Marked Done");
    loadData();
  });
}

// ==========================
// 📋 RENDER TASKS
// ==========================
function renderTasks() {
  const body = document.getElementById("taskBody");

  body.innerHTML = TASKS.map(t => `
    <tr>
      <td>${t.name}</td>
      <td>${t.client_name}</td>
      <td>${new Date(t.due_date).toDateString()}</td>
      <td class="${t.status === 'done' ? 'done' : 'pending'}">${t.status}</td>
      <td>${t.remarks || ""}</td>
    </tr>
  `).join("");
}

// ==========================
// 🚀 INIT
// ==========================
loadData();
