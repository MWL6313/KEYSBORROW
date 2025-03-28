// record.js（整合版）第一段
const token = localStorage.getItem("authToken");
if (!token) location.href = "index.html";

let allRecords = [];
let currentRole = "";
let showOnlyAbnormal = false;

document.getElementById("filterAbnormalBtn").addEventListener("click", () => {
  showOnlyAbnormal = !showOnlyAbnormal;
  document.getElementById("filterAbnormalBtn").innerText = showOnlyAbnormal
    ? "✅ 顯示全部"
    : "🚨 僅顯示異常（逾時未巡檢）";
  filterAndRender();
});

document.getElementById("searchUser").addEventListener("input", filterAndRender);
document.getElementById("searchCar").addEventListener("input", filterAndRender);

// function createButton(text, handler, color = "#a73232") {
//   const btn = document.createElement("button");
//   btn.innerText = text;
//   btn.style.marginRight = "6px";
//   btn.style.padding = "6px 10px";
//   btn.style.borderRadius = "6px";
//   btn.style.border = "none";
//   btn.style.cursor = "pointer";
//   btn.style.color = "white";
//   btn.style.background = color;
//   btn.onmouseover = () => btn.style.opacity = "0.85";
//   btn.onmouseout = () => btn.style.opacity = "1";
//   btn.onclick = handler;
//   return btn;
// }

function formatDate(str) {
  if (!str) return "";
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleString("zh-TW");
}

// record.js（整合版）第二段

// 載入資料
async function loadRecords() {
  const tableBody = document.querySelector("#recordTable tbody");
  tableBody.innerHTML = "";
  const statusMsg = document.getElementById("statusMsg");

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success || !Array.isArray(data.records)) {
      statusMsg.innerText = "資料載入失敗，請稍後再試。";
      return;
    }

    const currentUser = data.user?.id || "(未知)";
    document.getElementById("currentUser").innerText = currentUser;

    allRecords = data.records;
    currentRole = data.role;
    filterAndRender();
  } catch (err) {
    console.error("載入失敗", err);
    statusMsg.innerText = "無法連線伺服器。";
  }
}

function filterAndRender() {
  const searchUser = document.getElementById("searchUser").value.toLowerCase();
  const searchCar = document.getElementById("searchCar").value.toLowerCase();
  const tableBody = document.querySelector("#recordTable tbody");
  tableBody.innerHTML = "";

  const filtered = allRecords.filter(r => {
    const matchUser = !searchUser || r.借用人.toLowerCase().includes(searchUser);
    const matchCar = !searchCar || r.車號.toLowerCase().includes(searchCar);

    if (showOnlyAbnormal) {
      const now = new Date();
      const borrowTime = new Date(r.借用時間);
      const inspectionTime = r.巡檢結束時間 ? new Date(r.巡檢結束時間) : null;
      const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
      const noInspection = !inspectionTime;
      const noAction = !r.異常處置對策;
      return matchUser && matchCar && timeout && noInspection && noAction;
    }

    return matchUser && matchCar;
  });

  filtered.forEach(record => {
    const tr = document.createElement("tr");

    const now = new Date();
    const borrowTime = new Date(record.借用時間);
    const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
    const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
    const noInspection = !inspectionTime;
    const hasAction = !!record.異常處置對策;

    // 背景顏色判斷
    if (noInspection && timeout && !hasAction) {
      tr.style.backgroundColor = "#ffdddd";
    } else if (noInspection && timeout && hasAction) {
      tr.style.backgroundColor = "#eeeeee";
    }

    const cols = [
      record.借用人,
      record.車號,
      formatDate(record.借用時間),
      formatDate(record.歸還時間),
      record.車頭 || "-",
      record.尾車 || "-",
      record.完成率 || "-",
      formatDate(record.巡檢結束時間),
      record.異常處置對策 || "-"
    ];

    cols.forEach(val => {
      const td = document.createElement("td");
      td.innerText = val;
      tr.appendChild(td);
    });

    // 操作欄
    const actionTd = document.createElement("td");
    actionTd.style.whiteSpace = "nowrap";

    if ((currentRole === 'admin' || currentRole === 'manager')) {
      if (!record.歸還時間) {
        actionTd.appendChild(createButton("🔁 歸還", () => handleReturn(record), "#2c7a7b"));
      }

      if (!record.巡檢結束時間 && record.歸還時間 && timeout && !hasAction) {
        actionTd.appendChild(createButton("📝 編輯", () => handleEditAbnormal(record), "#6b46c1"));
      }
    }

    if (currentRole === "admin") {
      actionTd.appendChild(createButton("⛔ 刪除", () => handleDelete(record), "#e53e3e"));
    }

    tr.appendChild(actionTd);
    tableBody.appendChild(tr);
  });
}

// function createButton(label, onClick, bgColor = "#4a5568") {
//   const btn = document.createElement("button");
//   btn.innerText = label;
//   btn.style.margin = "2px";
//   btn.style.padding = "6px 10px";
//   btn.style.fontSize = "0.95rem";
//   btn.style.border = "none";
//   btn.style.borderRadius = "6px";
//   btn.style.cursor = "pointer";
//   btn.style.backgroundColor = bgColor;
//   btn.style.color = "white";
//   btn.style.transition = "background 0.2s ease";
//   btn.onmouseover = () => (btn.style.opacity = "0.85");
//   btn.onmouseout = () => (btn.style.opacity = "1");
//   btn.onclick = onClick;
//   return btn;
// }

async function handleReturn(record) {
  if (!confirm("確定要標記為歸還嗎？")) return;

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/return", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        借用人: record.借用人,
        車號: record.車號,
        借用時間: record.借用時間
      })
    });

    const result = await res.json();
    if (result.success) {
      const updatedURL = `https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection?updatedAfter=${record.借用時間}`;
      const res2 = await fetch(updatedURL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res2.json();

      if (data.success && Array.isArray(data.records)) {
        const updatedRecord = data.records.find(r =>
          r.借用人 === record.借用人 &&
          r.車號 === record.車號 &&
          r.借用時間 === record.借用時間
        );

        if (updatedRecord) {
          const idx = allRecords.findIndex(r =>
            r.借用人 === updatedRecord.借用人 &&
            r.車號 === updatedRecord.車號 &&
            r.借用時間 === updatedRecord.借用時間
          );
          if (idx !== -1) allRecords[idx] = updatedRecord;

          updateTableRow(updatedRecord);
        }
      }

      alert("✅ 已成功標記歸還（已更新該筆資料）");
    } else {
      alert("❌ 歸還失敗");
    }
  } catch (err) {
    alert("⚠️ 伺服器錯誤");
    console.error(err);
  }
}

async function handleEditAbnormal(record) {
  const input = prompt("請輸入異常處置對策：", "");
  if (!input) return;

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/updateAction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        借用人: record.借用人,
        車號: record.車號,
        借用時間: record.借用時間,
        異常處置對策: input
      })
    });

    const result = await res.json();
    if (result.success) {
      alert("✅ 已成功更新異常處置對策");

      const updatedURL = `https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection?updatedAfter=${record.借用時間}`;
      const res2 = await fetch(updatedURL, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res2.json();

      if (data.success && Array.isArray(data.records)) {
        const updatedRecord = data.records.find(r =>
          r.借用人 === record.借用人 &&
          r.車號 === record.車號 &&
          r.借用時間 === record.借用時間
        );

        if (updatedRecord) {
          const idx = allRecords.findIndex(r =>
            r.借用人 === updatedRecord.借用人 &&
            r.車號 === updatedRecord.車號 &&
            r.借用時間 === updatedRecord.借用時間
          );
          if (idx !== -1) allRecords[idx] = updatedRecord;
          updateTableRow(updatedRecord);
        }
      }
    } else {
      alert("❌ 更新失敗：" + (result.message || ""));
    }
  } catch (err) {
    console.error("伺服器錯誤", err);
    alert("⚠️ 伺服器錯誤，請稍後再試");
  }
}

async function handleDelete(record) {
  if (!confirm("確定要刪除此紀錄嗎？此操作不可復原")) return;

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        借用人: record.借用人,
        車號: record.車號,
        借用時間: record.借用時間
      })
    });

    const result = await res.json();
    if (result.success) {
      alert("✅ 已成功刪除");
      loadRecords();
    } else {
      alert("❌ 刪除失敗：" + (result.message || ""));
    }
  } catch (err) {
    alert("⚠️ 伺服器錯誤");
    console.error(err);
  }
}

function updateTableRow(record) {
  const tableBody = document.querySelector("#recordTable tbody");
  const rows = tableBody.querySelectorAll("tr");

  for (let tr of rows) {
    if (
      tr.children[0].innerText === record.借用人 &&
      tr.children[1].innerText === record.車號 &&
      tr.children[2].innerText === formatDate(record.借用時間)
    ) {
      const now = new Date();
      const borrowTime = new Date(record.借用時間);
      const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
      const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
      const noInspection = !inspectionTime;
      const hasAction = !!record.異常處置對策;

      if (noInspection && timeout && !hasAction) {
        tr.style.backgroundColor = "#ffdddd";
      } else if (noInspection && timeout && hasAction) {
        tr.style.backgroundColor = "#eeeeee";
      } else {
        tr.style.backgroundColor = "";
      }

      const cols = [
        record.借用人,
        record.車號,
        formatDate(record.借用時間),
        formatDate(record.歸還時間),
        record.車頭 || "-",
        record.尾車 || "-",
        record.完成率 || "-",
        formatDate(record.巡檢結束時間),
        record.異常處置對策 || "-"
      ];
      cols.forEach((val, i) => {
        tr.children[i].innerText = val || "";
      });

      const actionTd = tr.children[9];
      actionTd.innerHTML = "";

      if ((currentRole === 'admin' || currentRole === 'manager') && !record.歸還時間) {
        const returnBtn = createButton("🔁 歸還", () => handleReturn(record), "#38a169");
        actionTd.appendChild(returnBtn);
      }

      if (currentRole === "admin") {
        const deleteBtn = createButton("⛔ 刪除", () => handleDelete(record), "#e53e3e");
        actionTd.appendChild(deleteBtn);
      }

      if (
        (currentRole === 'admin' || currentRole === 'manager') &&
        !record.巡檢結束時間 &&
        record.歸還時間 &&
        timeout &&
        !hasAction
      ) {
        const editBtn = createButton("📝 編輯", () => handleEditAbnormal(record), "#3182ce");
        actionTd.appendChild(editBtn);
      }

      return;
    }
  }
}

function appendTableRow(record) {
  const tableBody = document.querySelector("#recordTable tbody");
  const tr = document.createElement("tr");

  const now = new Date();
  const borrowTime = new Date(record.借用時間);
  const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
  const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
  const noInspection = !inspectionTime;
  const hasAction = !!record.異常處置對策;

  if (noInspection && timeout && !hasAction) {
    tr.style.backgroundColor = "#ffdddd";
  } else if (noInspection && timeout && hasAction) {
    tr.style.backgroundColor = "#eeeeee";
  }

  const cols = [
    record.借用人,
    record.車號,
    formatDate(record.借用時間),
    formatDate(record.歸還時間),
    record.車頭 || "-",
    record.尾車 || "-",
    record.完成率 || "-",
    formatDate(record.巡檢結束時間),
    record.異常處置對策 || "-"
  ];
  cols.forEach(val => {
    const td = document.createElement("td");
    td.innerText = val;
    tr.appendChild(td);
  });

  const actionTd = document.createElement("td");

  if ((currentRole === 'admin' || currentRole === 'manager') && !record.歸還時間) {
    const returnBtn = createButton("🔁 歸還", () => handleReturn(record), "#38a169");
    actionTd.appendChild(returnBtn);
  }

  if (currentRole === "admin") {
    const deleteBtn = createButton("⛔ 刪除", () => handleDelete(record), "#e53e3e");
    actionTd.appendChild(deleteBtn);
  }

  if (
    (currentRole === 'admin' || currentRole === 'manager') &&
    !record.巡檢結束時間 &&
    record.歸還時間 &&
    timeout &&
    !hasAction
  ) {
    const editBtn = createButton("📝 編輯", () => handleEditAbnormal(record), "#3182ce");
    actionTd.appendChild(editBtn);
  }

  tr.appendChild(actionTd);
  tableBody.appendChild(tr);
}

// 時間排序按鈕
let sortAsc = true;
document.getElementById("sortTimeBtn").onclick = () => {
  allRecords.sort((a, b) => {
    const t1 = new Date(a.借用時間);
    const t2 = new Date(b.借用時間);
    return sortAsc ? t1 - t2 : t2 - t1;
  });
  sortAsc = !sortAsc;
  filterAndRender();
};

let sortInspectionAsc = true;
document.getElementById("sortInspectionBtn").onclick = () => {
  allRecords.sort((a, b) => {
    const t1 = new Date(a.巡檢結束時間);
    const t2 = new Date(b.巡檢結束時間);
    return sortInspectionAsc ? t1 - t2 : t2 - t1;
  });
  sortInspectionAsc = !sortInspectionAsc;
  filterAndRender();
};

// 自動更新提示
let lastCheckTime = new Date().toISOString();
const shownKeys = new Set();

async function checkLatestChanges() {
  try {
    const res = await fetch(`https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection?updatedAfter=${lastCheckTime}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.records)) return;

    const ul = document.getElementById("changesList");
    const container = document.getElementById("latestChanges");
    container.style.display = "block";

    data.records.forEach(newRec => {
      const key = `${newRec.借用人}-${newRec.車號}-${newRec.借用時間}`;
      const idx = allRecords.findIndex(r =>
        r.借用人 === newRec.借用人 &&
        r.車號 === newRec.車號 &&
        r.借用時間 === newRec.借用時間
      );
      if (idx !== -1) {
        allRecords[idx] = newRec;
        updateTableRow(newRec);
      } else {
        allRecords.push(newRec);
        appendTableRow(newRec);
      }

      if (!shownKeys.has(key)) {
        shownKeys.add(key);
        const li = document.createElement("li");
        li.innerText = `📌 ${newRec.借用人} 、 ${newRec.車號}（${formatDate(newRec.借用時間)}）\n🕓 更新於 ${formatDate(newRec.最後更新時間)}`;
        li.style.padding = "4px 0";
        ul.prepend(li);
      }
    });

    while (ul.children.length > 10) {
      ul.removeChild(ul.lastChild);
    }

    const latestUpdate = data.records.map(r => r.最後更新時間).filter(Boolean).sort().pop();
    if (latestUpdate) lastCheckTime = latestUpdate;

  } catch (err) {
    console.error("checkLatestChanges 錯誤：", err);
  }
}

setInterval(checkLatestChanges, 10000); // 每 10 秒更新

// 顯示最後更新時間
function updateLastUpdateTime() {
  const now = new Date().toLocaleString("zh-TW");
  document.getElementById("lastUpdateTime").innerText = now;
}

// 手動刷新按鈕
document.getElementById("refreshBtn").addEventListener("click", async () => {
  await loadRecords();
  updateLastUpdateTime();
});

// 每 30 分鐘自動刷新資料
setInterval(async () => {
  await loadRecords();
  updateLastUpdateTime();
}, 1800 * 1000);

// 初次載入
reloadWithTimestamp();
async function reloadWithTimestamp() {
  await loadRecords();
  updateLastUpdateTime();
}

// 清空「最新異動提示」
document.getElementById("clearChangesBtn").addEventListener("click", () => {
  document.getElementById("changesList").innerHTML = "";
  document.getElementById("latestChanges").style.display = "none";
});

// ✅ 全域按鈕樣式統一化函式
function createButton(label, onClick, bgColor = "#4a5568") {
  const btn = document.createElement("button");
  btn.innerText = label;
  btn.onclick = onClick;
  btn.style.margin = "2px";
  btn.style.padding = "4px 8px";
  btn.style.border = "none";
  btn.style.borderRadius = "4px";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
  btn.style.backgroundColor = bgColor;
  btn.style.fontSize = "0.9em";
  return btn;
}


