const token = localStorage.getItem("authToken");
if (!token) location.href = "index.html";

// Flask API base URL
const API_BASE = "/api";

let allRecords = [];
let currentRole = "";

document.getElementById("searchUser").addEventListener("input", filterAndRender);
document.getElementById("searchCar").addEventListener("input", filterAndRender);
document.getElementById("typeFilter").addEventListener("change", filterAndRender);

async function loadRecords() {
  const statusMsg = document.getElementById("statusMsg");

  try {
    const res = await fetch(`${API_BASE}/borrow/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!Array.isArray(data)) return statusMsg.innerText = "資料載入失敗，請稍後再試。";

    allRecords = data;
    allRecords.forEach(rec => {
      if (!rec.type) rec.type = rec.物品 ? '手機' : '鑰匙';
    });

    const res2 = await fetch(`${API_BASE}/borrow/withInspection`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data2 = await res2.json();
    if (!data2.success) return statusMsg.innerText = "無法取得使用者資訊。";

    currentRole = data2.role || "";
    document.getElementById("currentUserName").innerText = `${data2.user?.name || data2.user?.id || "(未知)"}`;

    if (Array.isArray(data2.records)) {
      data2.records.forEach(updated => {
        const index = allRecords.findIndex(r =>
          r.借用人 === updated.借用人 &&
          r.車號 === updated.車號 &&
          r.借用時間 === updated.借用時間
        );
        if (index !== -1) {
          allRecords[index] = { ...allRecords[index], ...updated };
        }
      });
    }

    filterAndRender();
  } catch (err) {
    console.error("載入失敗", err);
    statusMsg.innerText = "無法連線伺服器。";
  }
}

function formatDate(str) {
  if (!str) return "";
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleString("zh-TW");
}

function filterAndRender() {
  const searchUser = document.getElementById("searchUser").value.toLowerCase();
  const searchCar = document.getElementById("searchCar").value.toLowerCase();
  const typeFilter = document.getElementById("typeFilter").value;

  const recordBody = document.querySelector("#recordTable tbody");
  const historyBody = document.querySelector("#historyTable tbody");
  recordBody.innerHTML = "";
  historyBody.innerHTML = "";

  allRecords.forEach(record => {
    const matchUser = !searchUser || record.借用人.toLowerCase().includes(searchUser);
    const itemName = record.車號 || record.物品 || "";
    const matchCar = !searchCar || itemName.toLowerCase().includes(searchCar);
    const matchType = typeFilter === "all" || record.type === typeFilter;

    if (!matchUser || !matchCar || !matchType) return;

    const isPhone = record.type === '手機';
    const hasReturned = !!record.歸還時間;
    const hasInspection = !!record.巡檢結束時間;
    const noRear = !record.尾車;
    const incomplete = record.完成率 !== "100%" && record.完成率 !== "100%、100%";

    const isDone = (isPhone && hasReturned) || (!isPhone && hasReturned && hasInspection && !noRear && !incomplete);
    const targetBody = isDone ? historyBody : recordBody;

    renderRow(record, targetBody);
  });
}

function renderRow(record, tbody) {
  const tr = document.createElement("tr");
  tr.dataset.borrowTime = record.借用時間;
  tr.classList.add("fade-in");

  const now = new Date();
  const borrowTime = new Date(record.借用時間);
  const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
  const noRear = !record.尾車;
  const incomplete = record.完成率 !== "100%" && record.完成率 !== "100%、100%";
  const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
  const noInspection = !inspectionTime;
  const hasAction = !!record.異常處置對策;

  if (record.type !== '手機') {
    if (
      (noInspection && timeout && !hasAction) ||
      (incomplete && timeout && !hasAction) ||
      (noRear && timeout && !hasAction)
    ) {
      tr.style.backgroundColor = "#ffdddd";
    } else if (
      (noInspection && timeout && hasAction) ||
      (incomplete && timeout && hasAction) ||
      (noRear && timeout && hasAction)
    ) {
      tr.style.backgroundColor = "#eeeeee";
    }
  }

  const typeIcon = record.type === '手機' ? "📱" : "🚗";
  const cols = record.type === '手機'
    ? [
        record.借用人,
        `${typeIcon} ${record.物品 || "-"}`,
        formatDate(record.借用時間),
        formatDate(record.歸還時間),
        "-", "-", "-", "-", "-", "-"
      ]
    : [
        record.借用人,
        `${typeIcon} ${record.車號 || "-"}`,
        formatDate(record.借用時間),
        formatDate(record.歸還時間),
        record.車頭 || "-",
        record.尾車 || "-",
        record.完成率 || "-",
        formatDate(record.巡檢結束時間),
        record.查核是否正常 || "-",     
        record.異常處置對策 || "-"
      ];

  cols.forEach(val => {
    const td = document.createElement("td");
    td.innerText = val;
    tr.appendChild(td);
  });

  const actionTd = document.createElement("td");

  if ((currentRole === 'admin' || currentRole === 'manager') && !record.歸還時間) {
    const returnBtn = document.createElement("button");
    returnBtn.innerText = "🔁 歸還";
    returnBtn.onclick = () => handleReturn(record);
    actionTd.appendChild(returnBtn);
  }

  if (currentRole === "admin") {
    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "⛔ 刪除";
    deleteBtn.onclick = () => handleDelete(record);
    actionTd.appendChild(deleteBtn);
  }

  if (
    record.type !== '手機' &&
    (currentRole === 'admin' || currentRole === 'manager') &&
    ((noInspection && timeout && !hasAction) ||
     (incomplete && timeout && !hasAction) ||
     (noRear && timeout && !hasAction))
  ) {
    const editBtn = document.createElement("button");
    editBtn.innerText = "📝 編輯";
    editBtn.onclick = () => handleEditAbnormal(record);
    actionTd.appendChild(editBtn);
  }

  tr.appendChild(actionTd);
  tbody.appendChild(tr);

  return tr;
}

async function handleReturn(record) {
  if (!confirm("確定要標記為歸還嗎？")) return;

  const endpoint = record.type === '手機'
    ? `${API_BASE}/phone/return`
    : `${API_BASE}/borrow/return`;

  const payload = record.type === '手機'
    ? {
        借用人: record.借用人,
        物品: record.物品,
        借用時間: record.借用時間
      }
    : {
        借用人: record.借用人,
        車號: record.車號,
        借用時間: record.借用時間
      };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      showToast("✅ 已標記為歸還", "success");
      reloadWithTimestamp();
    } else {
      alert("❌ 歸還失敗：" + (result.message || ""));
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ 歸還時發生錯誤");
  }
}

async function handleEditAbnormal(record) {
  const input = prompt("請輸入異常處置對策：");
  if (!input) return;

  try {
    const res = await fetch(`${API_BASE}/borrow/updateAction`, {
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
      showToast("✅ 已更新異常處置對策", "success");
      reloadWithTimestamp();
    } else {
      alert("❌ 更新失敗：" + (result.message || ""));
    }
  } catch (err) {
    console.error(err);
    alert("⚠️ 發生錯誤");
  }
}

async function handleDelete(record) {
  if (!confirm("確定要刪除此紀錄嗎？此操作不可復原")) return;

  try {
    const res = await fetch(`${API_BASE}/borrow/delete`, {
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
      showToast("✅ 已刪除紀錄", "success");
      reloadWithTimestamp();
    } else {
      alert("❌ 刪除失敗：" + (result.message || ""));
    }
  } catch (err) {
    alert("⚠️ 發生錯誤");
    console.error(err);
  }
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.innerText = message;

  const colors = {
    success: "#4caf50",
    error: "#f44336",
    info: "#2196f3",
    warning: "#ff9800"
  };
  toast.style.borderLeftColor = colors[type] || "#333";
  toast.style.display = "block";

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, -50%) scale(1)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, -50%) scale(0.9)";
    setTimeout(() => {
      toast.style.display = "none";
    }, 400);
  }, 4000);
}

function updateLastUpdateTime() {
  const now = new Date().toLocaleString("zh-TW");
  document.getElementById("lastUpdateTime").innerText = now;
}

async function reloadWithTimestamp() {
  await loadRecords();
  updateLastUpdateTime();
}

document.getElementById("refreshBtn").addEventListener("click", reloadWithTimestamp);
setInterval(reloadWithTimestamp, 30 * 60 * 1000);  // 每 30 分鐘
reloadWithTimestamp();

