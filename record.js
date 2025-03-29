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
document.getElementById("typeFilter").addEventListener("change", filterAndRender);


// 取得資料
async function loadRecords() {
  const statusMsg = document.getElementById("statusMsg");
  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/all", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!Array.isArray(data)) {
      statusMsg.innerText = "資料載入失敗，請稍後再試。";
      return;
    }

    allRecords = data;
    currentRole = "admin"; // 或從登入資訊取回
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

  const tableBody = document.querySelector("#recordTable tbody");
  tableBody.innerHTML = "";

  const filtered = allRecords.filter(r => {
    const matchUser = !searchUser || r.借用人.toLowerCase().includes(searchUser);
    const carOrItem = r.車號 || r.物品 || "";
    const matchCar = !searchCar || carOrItem.toLowerCase().includes(searchCar);
    const matchType = typeFilter === "all" || r.type === typeFilter;

    if (showOnlyAbnormal && r.type !== '手機') {
      const now = new Date();
      const borrowTime = new Date(r.借用時間);
      const inspectionTime = r.巡檢結束時間 ? new Date(r.巡檢結束時間) : null;
      const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
      const noInspection = !inspectionTime;
      const noAction = !r.異常處置對策;
      return matchUser && matchCar && matchType && timeout && noInspection && noAction;
    }

    return matchUser && matchCar && matchType;
  });

  filtered.forEach(record => {
    const tr = document.createElement("tr");

    const now = new Date();
    const borrowTime = new Date(record.借用時間);
    const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
    const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
    const noInspection = !inspectionTime;
    const hasAction = !!record.異常處置對策;

    if (record.type !== '手機') {
      if (noInspection && timeout && !hasAction) {
        tr.style.backgroundColor = "#ffdddd";
      } else if (noInspection && timeout && hasAction) {
        tr.style.backgroundColor = "#eeeeee";
      }
    }

    const isPhone = record.type === '手機';

    const cols = isPhone
      ? [
          record.借用人,
          record.物品 || "-",
          formatDate(record.借用時間),
          formatDate(record.歸還時間),
          "-", "-", "-", "-", "-"
        ]
      : [
          record.借用人,
          record.車號 || "-",
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
      td.innerText = val || "";
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");

    // 歸還按鈕
    if ((currentRole === 'admin' || currentRole === 'manager') && !record.歸還時間) {
      const returnBtn = document.createElement("button");
      returnBtn.innerText = "🔁 歸還";
      returnBtn.onclick = () => handleReturn(record);
      actionTd.appendChild(returnBtn);
    }

    // 刪除按鈕
    if (currentRole === "admin") {
      const deleteBtn = document.createElement("button");
      deleteBtn.innerText = "⛔ 刪除";
      deleteBtn.onclick = () => handleDelete(record);
      actionTd.appendChild(deleteBtn);
    }

    // 編輯異常（鑰匙資料限定）
    if (
      record.type !== '手機' &&
      (currentRole === 'admin' || currentRole === 'manager') &&
      !record.巡檢結束時間 &&
      timeout &&
      !hasAction
    ) {
      const editBtn = document.createElement("button");
      editBtn.innerText = "📝 編輯";
      editBtn.onclick = () => handleEditAbnormal(record);
      actionTd.appendChild(editBtn);
    }

    tr.appendChild(actionTd);
    tableBody.appendChild(tr);
  });
}

// 初始化
loadRecords();




async function handleReturn(record) {
  if (!confirm("確定要標記為歸還嗎？")) return;

  const tableBody = document.querySelector("#recordTable tbody");
  const rows = tableBody.querySelectorAll("tr");

  let targetRow = null;
  let returnBtn = null;
  for (let tr of rows) {
    const rUser = tr.children[0].innerText;
    const rItem = tr.children[1].innerText;
    const rTime = tr.children[2].innerText;
    if (rUser === record.借用人 && rItem === (record.車號 || record.物品 || "-") && rTime === formatDate(record.借用時間)) {
      targetRow = tr;
      returnBtn = Array.from(tr.querySelectorAll("button")).find(btn => btn.innerText.includes("🔁"));
      break;
    }
  }

  if (returnBtn) {
    returnBtn.disabled = true;
    returnBtn.innerText = "⏳ 處理中...";
  }
  if (targetRow) {
    targetRow.style.backgroundColor = "#d0f0ff";
  }

  try {
    const endpoint = record.type === '手機'
      ? "https://key-loan-api-978908472762.asia-east1.run.app/phone/return"
      : "https://key-loan-api-978908472762.asia-east1.run.app/borrow/return";

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
      alert("✅ 已成功標記為歸還！");
      // 手動更新畫面
      record.歸還時間 = new Date().toISOString();
      updateTableRow(record);
    } else {
      alert("❌ 歸還失敗");
      if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
    }
  } catch (err) {
    alert("⚠️ 無法連線伺服器");
    console.error(err);
    if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
  } finally {
    if (returnBtn) {
      returnBtn.disabled = false;
      returnBtn.innerText = "🔁 歸還";
    }
  }
}


async function handleEditAbnormal(record) {
  const input = prompt("請輸入異常處置對策：", "");
  if (!input) return;

  // 找到對應行與按鈕
  const tableBody = document.querySelector("#recordTable tbody");
  const rows = tableBody.querySelectorAll("tr");

  let targetRow = null;
  let editBtn = null;

  for (let tr of rows) {
    if (
      tr.children[0].innerText === record.借用人 &&
      tr.children[1].innerText === record.車號 &&
      tr.children[2].innerText === formatDate(record.借用時間)
    ) {
      targetRow = tr;
      const actionTd = tr.children[9]; // 第 10 欄為按鈕欄
      editBtn = Array.from(actionTd.querySelectorAll("button"))
        .find(btn => btn.innerText.includes("📝"));
      break;
    }
  }

  if (editBtn) {
    editBtn.disabled = true;
    editBtn.innerText = "⏳ 更新中...";
  }

  if (targetRow) {
    targetRow.style.transition = "background-color 0.3s ease";
    targetRow.style.backgroundColor = "#fff3cd"; // 黃色提示
  }

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

      // 抓更新後資料
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

          // ✅ 成功動畫
          if (targetRow) {
            targetRow.style.backgroundColor = "#d4edda"; // 綠色背景
            setTimeout(() => {
              targetRow.style.backgroundColor = "";
            }, 1000);
          }
        }
      }
    } else {
      alert("❌ 更新失敗：" + (result.message || ""));
      if (targetRow) targetRow.style.backgroundColor = "#f8d7da"; // 紅色錯誤提示
    }
  } catch (err) {
    console.error("伺服器錯誤", err);
    alert("⚠️ 伺服器錯誤，請稍後再試");
    if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
  } finally {
    if (editBtn) {
      editBtn.disabled = false;
      editBtn.innerText = "📝 編輯";
    }
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
      alert("已成功刪除");
      loadRecords();
    } else {
      alert("刪除失敗：" + (result.message || ""));
    }
  } catch (err) {
    alert("伺服器錯誤");
    console.error(err);
  }
}

let sortAsc = true;  // 初始排序方向

// 排序借用時間
document.getElementById("sortTimeBtn").onclick = () => {
  allRecords.sort((a, b) => {
    const t1 = new Date(a.借用時間);
    const t2 = new Date(b.借用時間);
    return sortAsc ? t1 - t2 : t2 - t1;
  });
  sortAsc = !sortAsc;
  filterAndRender(); // ⬅ 這裡改掉
};


let sortInspectionAsc = true; // 初始排序方向

document.getElementById("sortInspectionBtn").onclick = () => {
  allRecords.sort((a, b) => {
    const t1 = a.巡檢結束時間 ? new Date(a.巡檢結束時間) : null;
    const t2 = b.巡檢結束時間 ? new Date(b.巡檢結束時間) : null;

    if (!t1 && !t2) return 0;         // 都沒有時間 → 不變
    if (!t1) return sortInspectionAsc ? 1 : -1;  // a 沒時間 → 排後或前
    if (!t2) return sortInspectionAsc ? -1 : 1;  // b 沒時間 → 排後或前

    return sortInspectionAsc ? t1 - t2 : t2 - t1;
  });

  sortInspectionAsc = !sortInspectionAsc;
  filterAndRender();
};



// 顯示最後更新時間
function updateLastUpdateTime() {
  const now = new Date().toLocaleString("zh-TW");
  document.getElementById("lastUpdateTime").innerText = now;
}

// 每次載入完成都更新時間
async function reloadWithTimestamp() {
  await loadRecords();
  updateLastUpdateTime();
}

// 手動刷新按鈕
document.getElementById("refreshBtn").addEventListener("click", reloadWithTimestamp);

// 自動每 1800 秒更新
setInterval(reloadWithTimestamp, 1800 * 1000);


// 初次載入
reloadWithTimestamp();

let lastCheckTime = new Date().toISOString();
const shownKeys = new Set();  // 防止重複顯示

async function checkLatestChanges() {
  try {
    const res = await fetch(`https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection?updatedAfter=${lastCheckTime}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.records)) return;
    if (data.records.length === 0) return;

    const ul = document.getElementById("changesList");
    const container = document.getElementById("latestChanges");
    container.style.display = "block";

    // 更新 allRecords 中的異動資料
    data.records.forEach(newRec => {
      const key = `${newRec.借用人}-${newRec.車號}-${newRec.借用時間}`;

      // ✅ 更新 allRecords 中對應那筆
      const index = allRecords.findIndex(r =>
        r.借用人 === newRec.借用人 &&
        r.車號 === newRec.車號 &&
        r.借用時間 === newRec.借用時間
      );

      if (index !== -1) {
        allRecords[index] = newRec;
        // ✅ 只更新這一列畫面
        updateTableRow(newRec);
      } else {
        // 若是新資料，加入 allRecords 並新增列
        allRecords.push(newRec);
        appendTableRow(newRec);
      }

      // 顯示異動提示
      if (!shownKeys.has(key)) {
        shownKeys.add(key);
        const li = document.createElement("li");
        li.innerText = `📌 ${newRec.借用人}  ${newRec.車號}🕓 ${formatDate(newRec.最後更新時間)}`;
        li.style.padding = "4px 0";
        ul.prepend(li);
      }
    });

    // 限制 10 筆
    while (ul.children.length > 10) {
      const last = ul.lastChild;
      ul.removeChild(last);
    }

    const latestUpdate = data.records.map(r => r.最後更新時間).filter(Boolean).sort().pop();
    if (latestUpdate) lastCheckTime = latestUpdate;

  } catch (err) {
    console.error("checkLatestChanges 錯誤：", err);
  }
}



setInterval(checkLatestChanges, 10 * 1000); // 每 10 秒檢查一次


function showChange(message) {
  const latestChanges = document.getElementById("latestChanges");
  const changesList = document.getElementById("changesList");

  const li = document.createElement("li");
  li.textContent = message;
  li.style.padding = "5px 0";
  changesList.appendChild(li);

  // 顯示懸浮窗
  latestChanges.style.display = "block";
}

// 清空按鈕
document.getElementById("clearChangesBtn").addEventListener("click", () => {
  document.getElementById("changesList").innerHTML = "";
  document.getElementById("latestChanges").style.display = "none";
});



document.getElementById("clearChangesBtn").addEventListener("click", () => {
  document.getElementById("changesList").innerHTML = "";
  document.getElementById("latestChanges").style.display = "none";
});

//🔧 更新單一列（by 資料）
function updateTableRow(record) {
  const tableBody = document.querySelector("#recordTable tbody");
  const rows = tableBody.querySelectorAll("tr");

  for (let tr of rows) {
    if (
      tr.children[0].innerText === record.借用人 &&
      tr.children[1].innerText === record.車號 &&
      tr.children[2].innerText === formatDate(record.借用時間)
    ) {
      // ✅ 更新背景色判斷邏輯
      const now = new Date();
      const borrowTime = new Date(record.借用時間);
      const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
      const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
      const noInspection = !inspectionTime;
      const hasAction = !!record.異常處置對策;

      if (noInspection && timeout && !hasAction) {
        tr.style.backgroundColor = "#ffdddd"; // 淺紅背景
      } else if (noInspection && timeout && hasAction) {
        tr.style.backgroundColor = "#eeeeee"; // 灰色背景
      } else {
        tr.style.backgroundColor = ""; // 清除背景（若無條件）
      }

      // ✅ 更新資料欄位
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

      // ✅ 更新操作按鈕欄位
      const actionTd = tr.children[9];
      actionTd.innerHTML = "";

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
        (currentRole === 'admin' || currentRole === 'manager') &&
        !record.巡檢結束時間 &&
        // record.歸還時間 &&
        timeout &&
        !hasAction
      ) {
        const editBtn = document.createElement("button");
        editBtn.innerText = "📝 編輯";
        editBtn.onclick = () => handleEditAbnormal(record);
        actionTd.appendChild(editBtn);
      }

      return;
    }
  }
}



function appendTableRow(record) {
  const tableBody = document.querySelector("#recordTable tbody");
  const tr = document.createElement("tr");

  
  // ✅ 背景色條件判斷
  const now = new Date();
  const borrowTime = new Date(record.借用時間);
  const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
  const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
  const noInspection = !inspectionTime;
  const hasAction = !!record.異常處置對策;

  if (noInspection && timeout && !hasAction) {
    tr.style.backgroundColor = "#ffdddd"; // 🔴 淺紅背景
  } else if (noInspection && timeout && hasAction) {
    tr.style.backgroundColor = "#eeeeee"; // ⚫ 灰色背景
  }

  // ✅ 建立資料欄位
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

  // ✅ 操作欄位
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
    (currentRole === 'admin' || currentRole === 'manager') &&
    !record.巡檢結束時間 &&
    // record.歸還時間 &&
    timeout &&
    !hasAction
  ) {
    const editBtn = document.createElement("button");
    editBtn.innerText = "📝 編輯";
    editBtn.onclick = () => handleEditAbnormal(record);
    actionTd.appendChild(editBtn);
  }

  tr.appendChild(actionTd);
  tableBody.appendChild(tr);
}


