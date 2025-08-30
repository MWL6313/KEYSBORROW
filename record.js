// --------------------------- 設定與初始化 ---------------------------
const token = localStorage.getItem("authToken");
if (!token) {
  location.href = "managertest.html"; // 沒 token，回登入頁
}

fetch("https://key-loan-api-299116105630.asia-east1.run.app/validateToken", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token }),
})
  .then(res => res.json())
  .then(async data => {
    if (data.success) {
      currentUser = data.user;
      currentRole = data.role;
      document.getElementById("currentUserName").innerText = currentUser.name || currentUser.id;
      // 初次載入前先設定 inspectionFilter 預設值
      document.getElementById("inspectionFilter").value = "incomplete";
      await reloadWithTimestamp();  // 開始載入資料
    } else {
      localStorage.removeItem("authToken");
      location.href = "managertest.html";
    }
  })
  .catch(err => {
    console.error("Token validation error:", err);
    localStorage.removeItem("authToken");
    location.href = "managertest.html";
  });

let currentUser = null;
let allRecords = [];
let currentRole = "";
let showOnlyAbnormal = false;

// ===== Timeout thresholds (統一門檻) =====
const TIMEOUT_MS  = 60 * 60 * 1000;   // > 1 小時
const TIMEOUT0_MS = 30 * 60 * 1000;   // > 0.5 小時 且 ≤ 1 小時
function getTimeoutFlags(borrowTimeStr) {
  const t = new Date(borrowTimeStr);
  if (isNaN(t)) return { timeout: false, timeout0: false, elapsedMs: 0 };
  const elapsed = Date.now() - t.getTime();
  const timeout  = elapsed > TIMEOUT_MS;
  const timeout0 = elapsed > TIMEOUT0_MS && elapsed <= TIMEOUT_MS;
  return { timeout, timeout0, elapsedMs: elapsed };
}

// 🔍 巡檢完成狀態篩選器
document.getElementById("inspectionFilter").addEventListener("change", filterAndRender);
document.getElementById("searchUser").addEventListener("input", filterAndRender);
document.getElementById("searchCar").addEventListener("input", filterAndRender);
document.getElementById("typeFilter").addEventListener("change", filterAndRender);

// --------------------------- 取資料 ---------------------------
async function loadRecords() {
  const statusMsg = document.getElementById("statusMsg");

  try {
    const res = await fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/all", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (!Array.isArray(data)) {
      statusMsg.innerText = "資料載入失敗，請稍後再試。";
      return;
    }

    allRecords = data;

    // ✅ 補上 type 欄位（手機/鑰匙）
    allRecords.forEach(rec => {
      if (!rec.type) rec.type = rec.物品 ? '手機' : '鑰匙';
    });

    // 🆕 預設依借用時間排序（新到舊）
    allRecords.sort((a, b) => new Date(b.借用時間) - new Date(a.借用時間));
    sortAsc = false; // 預設方向為反向排序
    
    // 🔐 再取得目前登入者的角色和完整巡檢資訊
    const res2 = await fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/withInspection", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data2 = await res2.json();
    if (!data2.success) {
      statusMsg.innerText = "無法取得使用者資訊。";
      return;
    }

    currentRole = data2.role || "";
    document.getElementById("currentUserName").innerText = `${data2.user?.name || data2.user?.id || "(未知)"}`;

    // ✅ 將巡檢資料合併進 allRecords
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

// --------------------------- 篩選 + 繪製 ---------------------------
function filterAndRender() {
  const searchUser = document.getElementById("searchUser").value.toLowerCase();
  const searchCar = document.getElementById("searchCar").value.toLowerCase();
  const typeFilter = document.getElementById("typeFilter").value;
  const inspectionFilter = document.getElementById("inspectionFilter").value;

  const recordBody = document.querySelector("#recordTable tbody");
  const historyBody = document.querySelector("#historyTable tbody");
  recordBody.innerHTML = "";
  historyBody.innerHTML = "";

  // 將所有條件整合過濾，包含巡檢狀態
  const filteredRecords = allRecords.filter(record => {
    const matchUser = !searchUser || record.借用人.toLowerCase().includes(searchUser);
    const itemName = record.車號 || record.物品 || "";
    const matchCar = !searchCar || itemName.toLowerCase().includes(searchCar);
    const matchType = typeFilter === "all" || record.type === typeFilter;

    let matchInspection = true;
    if (inspectionFilter === "incomplete") {
      // 僅保留鑰匙資料且查核狀態不是「巡檢正常」
      matchInspection = record.type === "鑰匙" && record.查核是否正常 !== "巡檢正常";
    }

    return matchUser && matchCar && matchType && matchInspection;
  });

  // 將篩選後的資料渲染到適當的表格中
  filteredRecords.forEach(record => {
    const isPhone = record.type === '手機';
    const hasReturned = !!record.歸還時間;
    const hasInspection = !!record.巡檢結束時間;
    const noRear = !record.尾車;
    const incomplete = record.完成率 !== "100%" && record.完成率 !== "100%、100%";

    // 判斷是否完成（依照你的邏輯）
    const isVerified = record.查核是否正常 === "巡檢正常";
    const isDone = (
      (isPhone && hasReturned) ||
      (!isPhone && hasReturned && hasInspection && !noRear && !incomplete && isVerified)
    );

    const targetBody = isDone ? document.querySelector("#historyTable tbody")
                              : document.querySelector("#recordTable tbody");

    renderRow(record, targetBody);
  });
}

function renderRow(record, tbody) {
  const tr = document.createElement("tr");
  tr.dataset.borrowTime = record.借用時間;
  tr.classList.add("fade-in");

  const isVerified = record.查核是否正常 === "巡檢正常";
  const hasAction = !!record.異常處置對策;
  const { timeout, timeout0 } = getTimeoutFlags(record.借用時間);

  if (record.type !== '手機') {
    // 顏色優先序：已處置→綠；>1hr 未處置→紅；0.5~1hr 未處置→黃（綠色也僅在 hasAction=false 不顯示，已在條件判斷確保）
    if (!isVerified && hasAction) {
      tr.style.backgroundColor = "#d4edda";  // 綠：已處置
    } else if (!isVerified && timeout && !hasAction) {
      tr.style.backgroundColor = "#ffdddd";  // 紅：>1hr 未處置
    } else if (!isVerified && timeout0 && !hasAction) {
      tr.style.backgroundColor = "#fef9dc";  // 黃：0.5~1hr 未處置
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

  // 🔁 歸還：未歸還即可
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
  
  // 📝 編輯：未巡檢正常 + 未處置 + (timeout || timeout0)
  if (
    record.type !== '手機' &&
    (currentRole === 'admin' || currentRole === 'manager') &&
    !isVerified && !hasAction && (timeout || timeout0)
  ) {
    const editBtn = document.createElement("button");
    editBtn.innerText = "📝 編輯";
    editBtn.onclick = () => handleEditAbnormal(record);
    actionTd.appendChild(editBtn);
  }

  // 🍺 酒測
  if (
    record.type === '鑰匙' &&
    (currentRole === 'admin' || currentRole === 'manager')
  ) {
    const alcoholBtn = document.createElement("button");
    alcoholBtn.innerText = "🍺 酒測";
    alcoholBtn.onclick = () => handleAlcoholEdit(record);
    actionTd.appendChild(alcoholBtn);
  }

  tr.appendChild(actionTd);
  tbody.appendChild(tr);

  return tr; // ✅ 回傳 <tr> 供 update/append 使用
}

// --------------------------- 動作：歸還 ---------------------------
async function handleReturn(record) {
  const { value: reason } = await Swal.fire({
    title: "請輸入管理人員代為歸還原因",
    input: "text",
    inputPlaceholder: "例如：維修中無法感應",
    showCancelButton: true,
    confirmButtonText: "確定",
    cancelButtonText: "取消"
  });

  if (!reason || reason.trim() === "") {
    Swal.fire("已取消", "請填寫歸還原因", "info");
    return;
  }

  const tableBody = document.querySelector("#recordTable tbody");
  const rows = tableBody.querySelectorAll("tr");

  let targetRow = null;
  let returnBtn = null;
  for (let tr of rows) {
    const rUser = tr.children[0].innerText;
    const rItem = tr.children[1].innerText.replace(/^📱|🚗/, "").trim();
    const rTime = tr.dataset.borrowTime;

    if (
      rUser === record.借用人 &&
      rItem === (record.車號 || record.物品 || "-") &&
      rTime === record.借用時間
    ) {
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
      ? "https://key-loan-api-299116105630.asia-east1.run.app/phone/return"
      : "https://key-loan-api-299116105630.asia-east1.run.app/borrow/return";

    const payload = record.type === '手機'
      ? {
          借用人: record.借用人,
          物品: record.物品,
          借用時間: record.借用時間,
          歸還原因: reason.trim()
        }
      : {
          借用人: record.借用人,
          車號: record.車號,
          借用時間: record.借用時間,
          歸還原因: reason.trim()
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
      showToast("✅ 已成功標記為歸還", "success");

      let updatedRecord = null;

      if (record.type === '手機') {
        const resAll = await fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/all", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataAll = await resAll.json();

        updatedRecord = dataAll.find(r =>
          r.借用人 === record.借用人 &&
          r.借用時間 === record.借用時間 &&
          r.物品 === record.物品
        );
      } else {
        const resInspect = await fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/withInspection", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataInspect = await resInspect.json();

        if (dataInspect.success && Array.isArray(dataInspect.records)) {
          updatedRecord = dataInspect.records.find(r =>
            r.借用人 === record.借用人 &&
            r.借用時間 === record.借用時間 &&
            r.車號 === record.車號
          );
        }
      }

      if (updatedRecord) {
        if (!updatedRecord.type) updatedRecord.type = updatedRecord.物品 ? '手機' : '鑰匙';

        const idx = allRecords.findIndex(r =>
          r.借用人 === updatedRecord.借用人 &&
          r.借用時間 === updatedRecord.借用時間 &&
          (
            (updatedRecord.type === '手機' && r.物品 === updatedRecord.物品) ||
            (updatedRecord.type !== '手機' && r.車號 === updatedRecord.車號)
          )
        );

        if (idx !== -1) allRecords[idx] = updatedRecord;
        else allRecords.push(updatedRecord);

        updateTableRow(updatedRecord);
      }

    } else {
      Swal.fire("❌ 歸還失敗", result.message || "未知錯誤", "error");
      if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
    }

  } catch (err) {
    console.error("⚠️ 錯誤", err);
    Swal.fire("⚠️ 無法連線伺服器", "", "error");
    if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
  } finally {
    if (returnBtn) {
      returnBtn.disabled = false;
      returnBtn.innerText = "🔁 歸還";
    }
  }
}

// --------------------------- 動作：編輯異常處置 ---------------------------
async function handleEditAbnormal(record) {
  const { value: input } = await Swal.fire({
    title: "請輸入異常處置對策",
    input: "text",
    inputPlaceholder: "請說明處置方式或補救措施",
    showCancelButton: true,
    confirmButtonText: "確定",
    cancelButtonText: "取消"
  });

  if (!input || input.trim() === "") {
    Swal.fire("未填寫", "已取消更新", "info");
    return;
  }

  const tableBody = document.querySelector("#recordTable tbody");
  const rows = tableBody.querySelectorAll("tr");

  let targetRow = null;
  let editBtn = null;

  for (let tr of rows) {
    const tdUser = tr.children[0].innerText.trim();
    const tdItem = tr.children[1].innerText.replace(/^📱|🚗/, "").trim();
    const tdTime = tr.children[2].innerText.trim();

    if (
      tdUser === record.借用人 &&
      tdItem === (record.車號 || record.物品 || "-") &&
      tdTime === formatDate(record.借用時間)
    ) {
      targetRow = tr;
      const actionTd = tr.children[9];
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
    targetRow.style.backgroundColor = "#fff3cd"; // 編輯時暫時黃色
  }

  try {
    const res = await fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/updateAction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        借用人: record.借用人,
        車號: record.車號,
        借用時間: record.借用時間,
        異常處置對策: input.trim()
      })
    });

    const result = await res.json();

    if (result.success) {
      showToast("✅ 已成功更新異常處置對策", "success");
      // 重新抓資料，讓前端顯示到後端合成好的「編號 + 內容(時間)」
      await reloadWithTimestamp();

      // 視覺提示：保留黃色一小段時間，不移除編輯鈕
      if (targetRow) {
        targetRow.style.backgroundColor = "#fff3cd";
        setTimeout(() => {
          targetRow.style.backgroundColor = "";
        }, 800);
      }
    } else {
      Swal.fire("❌ 更新失敗", result.message || "", "error");
      if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
    }
  } catch (err) {
    console.error("伺服器錯誤", err);
    Swal.fire("⚠️ 伺服器錯誤", "請稍後再試", "error");
    if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
  } finally {
    if (editBtn) {
      editBtn.disabled = false;
      editBtn.innerText = "📝 編輯";
    }
  }
}

// --------------------------- 動作：酒測欄位 ---------------------------
async function handleAlcoholEdit(record) {
  try {
    const target = allRecords.find(r =>
      r.借用人 === record.借用人 &&
      r.借用時間 === record.借用時間 &&
      r.車號 === record.車號
    );

    if (!target) {
      Swal.fire("❌ 找不到資料", "請重新整理頁面", "error");
      return;
    }

    const { 回場酒測, 酒測追查註記, 酒測3to15, 酒測3小時內 } = target;

    const { value: formValues } = await Swal.fire({
      title: "🍺 編輯酒測資料",
      html: `
        <input id="field1" class="swal2-input" placeholder="回場酒測" value="${回場酒測 || ""}">
        <input id="field2" class="swal2-input" placeholder="酒測追查註記" value="${酒測追查註記 || ""}">
        <input id="field3" class="swal2-input" placeholder="借用後3~15小時紀錄" value="${酒測3to15 || ""}">
        <input id="field4" class="swal2-input" placeholder="借用後3小時內紀錄" value="${酒測3小時內 || ""}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "儲存",
      cancelButtonText: "取消",
      preConfirm: () => {
        return {
          回場酒測: document.getElementById("field1").value.trim(),
          酒測追查註記: document.getElementById("field2").value.trim(),
          酒測3to15: document.getElementById("field3").value.trim(),
          酒測3小時內: document.getElementById("field4").value.trim()
        };
      }
    });

    if (!formValues) return;

    const updateRes = await fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/updateAlcoholFields", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        借用人: record.借用人,
        車號: record.車號,
        借用時間: record.借用時間,
        ...formValues
      })
    });

    const updateData = await updateRes.json();
    if (updateData.success) {
      Swal.fire("✅ 更新成功", "酒測資料已儲存", "success");
      reloadWithTimestamp();
    } else {
      Swal.fire("❌ 更新失敗", updateData.message || "", "error");
    }

  } catch (err) {
    console.error("handleAlcoholEdit 錯誤", err);
    Swal.fire("❌ 錯誤", "無法連線伺服器", "error");
  }
}

// --------------------------- 動作：刪除 ---------------------------
async function handleDelete(record) {
  if (!confirm("確定要刪除此紀錄嗎？此操作不可復原")) return;

  try {
    const res = await fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/delete", {
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

// --------------------------- 排序 ---------------------------
let sortAsc = false;  // 初始排序方向

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
    const t1 = a.巡檢結束時間 ? new Date(a.巡檢結束時間) : null;
    const t2 = b.巡檢結束時間 ? new Date(b.巡檢結束時間) : null;

    if (!t1 && !t2) return 0;
    if (!t1) return sortInspectionAsc ? 1 : -1;
    if (!t2) return sortInspectionAsc ? -1 : 1;

    return sortInspectionAsc ? t1 - t2 : t2 - t1;
  });

  sortInspectionAsc = !sortInspectionAsc;
  filterAndRender();
};

// --------------------------- 更新時間 / 自動刷新 ---------------------------
function updateLastUpdateTime() {
  const now = new Date().toLocaleString("zh-TW");
  document.getElementById("lastUpdateTime").innerText = now;
}

async function reloadWithTimestamp() {
  await loadRecords();
  updateLastUpdateTime();
}

document.getElementById("refreshBtn").addEventListener("click", reloadWithTimestamp);
setInterval(reloadWithTimestamp, 60 * 1000);

// 初次載入前先設定 inspectionFilter 預設值 + 初次載入
document.getElementById("inspectionFilter").value = "incomplete";
reloadWithTimestamp();

// --------------------------- 即時異動提示 ---------------------------
let lastCheckTime = new Date().toISOString();
const shownKeys = new Set();  // 防止重複顯示

async function checkLatestChanges() {
  try {
    const [resPhone, resKey] = await Promise.all([
      fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/all", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch("https://key-loan-api-299116105630.asia-east1.run.app/borrow/withInspection", {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const phoneData = await resPhone.json();
    const keyData = await resKey.json();

    const combinedRecords = [];

    if (Array.isArray(phoneData)) {
      phoneData.forEach(r => {
        if (!r.type) r.type = r.物品 ? '手機' : '鑰匙';
        if (r.type === '手機') combinedRecords.push(r);
      });
    }

    if (keyData.success && Array.isArray(keyData.records)) {
      keyData.records.forEach(r => {
        if (!r.type) r.type = r.物品 ? '手機' : '鑰匙';
        if (r.type !== '手機') combinedRecords.push(r);
      });
    }

    const newRecords = combinedRecords.filter(r => {
      const updatedTime = new Date(r.最後更新時間 || r.歸還時間 || r.借用時間);
      return updatedTime > new Date(lastCheckTime);
    });

    if (newRecords.length === 0) return;

    const ul = document.getElementById("changesList");
    const container = document.getElementById("latestChanges");
    container.style.display = "block";

    newRecords.forEach(rec => {
      const key = `${rec.借用人}-${rec.車號 || rec.物品}-${rec.借用時間}`;
      if (!shownKeys.has(key)) {
        shownKeys.add(key);

        const li = document.createElement("li");
        const typeIcon = rec.type === "手機" ? "📱" : "🚗";
        li.innerText = `${typeIcon} ${rec.借用人} - ${rec.車號 || rec.物品} 已有更新`;
        li.style.padding = "4px 0";
        ul.prepend(li);
      }

      const idx = allRecords.findIndex(r =>
        r.借用人 === rec.借用人 &&
        r.借用時間 === rec.借用時間 &&
        (
          (rec.type === '手機' && r.物品 === rec.物品) ||
          (rec.type !== '手機' && r.車號 === rec.車號)
        )
      );

      if (idx !== -1) {
        allRecords[idx] = rec;
        updateTableRow(rec);
      } else {
        allRecords.push(rec);
        appendTableRow(rec);
      }
    });

    while (ul.children.length > 10) {
      ul.removeChild(ul.lastChild);
    }

    const allTimes = newRecords.map(r =>
      new Date(r.最後更新時間 || r.歸還時間 || r.借用時間).getTime()
    );
    if (allTimes.length > 0) {
      lastCheckTime = new Date(Math.max(...allTimes)).toISOString();
    }

  } catch (err) {
    console.error("❌ checkLatestChanges 錯誤：", err);
  }
}

setInterval(checkLatestChanges, 90 * 1000);

// --------------------------- Toast / 通知 ---------------------------
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
  }, 5000);
}
window.showToast = showToast; // ✅ 讓其它檔案也能呼叫，且不使用 export

if (Notification.permission !== "granted") {
  Notification.requestPermission();
}

function speakText(message) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "zh-TW";
    speechSynthesis.speak(utterance);
  }
}

function showChange(message) {
  const latestChanges = document.getElementById("latestChanges");
  const changesList = document.getElementById("changesList");

  const li = document.createElement("li");
  li.textContent = message;
  li.style.padding = "5px 0";
  changesList.appendChild(li);

  latestChanges.style.display = "block";

  if (Notification.permission === "granted") {
    new Notification("🔔 異動通知", {
      body: message,
      icon: "https://github.githubassets.com/favicons/favicon.png"
    });
  }

  speakText(message);
}

// 清空按鈕（保留一次綁定即可）
document.getElementById("clearChangesBtn").addEventListener("click", () => {
  document.getElementById("changesList").innerHTML = "";
  document.getElementById("latestChanges").style.display = "none";
});

// --------------------------- 單列更新 ---------------------------
function updateTableRow(record) {
  const allRows = document.querySelectorAll("#recordTable tbody tr, #historyTable tbody tr");

  for (const tr of allRows) {
    const rUser = tr.children[0].innerText;
    const rItem = tr.children[1].innerText.replace(/^📱|🚗/, "").trim();
    const rTime = tr.dataset.borrowTime;

    if (
      rUser === record.借用人 &&
      rItem === (record.車號 || record.物品 || "-") &&
      rTime === record.借用時間
    ) {
      const isPhone = record.type === '手機';

      const newCols = isPhone
        ? [
            record.借用人,
            `📱 ${record.物品 || "-"}`,
            formatDate(record.借用時間),
            formatDate(record.歸還時間),
            "-", "-", "-", "-", "-", "-"
          ]
        : [
            record.借用人,
            `🚗 ${record.車號 || "-"}`,
            formatDate(record.借用時間),
            formatDate(record.歸還時間),
            record.車頭 || "-",
            record.尾車 || "-",
            record.完成率 || "-",
            formatDate(record.巡檢結束時間),
            record.查核是否正常 || "-",
            record.異常處置對策 || "-"
          ];

      newCols.forEach((val, idx) => {
        if (tr.children[idx]) tr.children[idx].innerText = val;
      });

      // ✅ 更新背景顏色（統一新門檻）
      const isVerified = record.查核是否正常 === "巡檢正常";
      const hasAction = !!record.異常處置對策;
      const { timeout, timeout0 } = getTimeoutFlags(record.借用時間);
      
      tr.style.backgroundColor = "";

      if (!isPhone) {
        if (!isVerified && hasAction) {
          tr.style.backgroundColor = "#d4edda";  // 綠：已處置
        } else if (!isVerified && timeout && !hasAction) {
          tr.style.backgroundColor = "#ffdddd";  // 紅：>1hr 未處置
        } else if (!isVerified && timeout0 && !hasAction) {
          tr.style.backgroundColor = "#fef9dc";  // 黃：0.5~1 小時 未處置
        }
      }

      // ✅ 操作按鈕重新建立
      const actionTd = tr.children[tr.children.length - 1];
      actionTd.innerHTML = "";

      // 🍺 酒測
      if (
        record.type === '鑰匙' &&
        (currentRole === 'admin' || currentRole === 'manager')
      ) {
        const alcoholBtn = document.createElement("button");
        alcoholBtn.innerText = "🍺 酒測";
        alcoholBtn.onclick = () => handleAlcoholEdit(record);
        actionTd.appendChild(alcoholBtn);
      }

      // 🔁 歸還
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

      // 📝 編輯：擴充至包含 0.5~1 小時（且未處置）
      if (
        record.type !== '手機' &&
        (currentRole === 'admin' || currentRole === 'manager') &&
        !isVerified && !hasAction && (timeout || timeout0)
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
  const isPhone = record.type === '手機';
  const hasReturned = !!record.歸還時間;
  const hasInspection = !!record.巡檢結束時間;
  const noRear = !record.尾車;
  const incomplete = record.完成率 !== "100%" && record.完成率 !== "100%、100%";

  const isVerified = record.查核是否正常 === "巡檢正常";
  const isDone = (
    (isPhone && hasReturned) ||
    (!isPhone && hasReturned && hasInspection && !noRear && !incomplete && isVerified)
  );
  const targetBody = isDone
    ? document.querySelector("#historyTable tbody")
    : document.querySelector("#recordTable tbody");

  renderRow(record, targetBody);
}

// --------------------------- 閒置重新整理 ---------------------------
let lastAction = Date.now();
document.addEventListener('mousemove', () => lastAction = Date.now());
document.addEventListener('keydown', () => lastAction = Date.now());

setInterval(() => {
  const now = Date.now();
  const idleTime = now - lastAction;

  if (idleTime > 60 * 60 * 1000) {  // 60 分鐘
    location.reload();
    alert("閒置太久，請重新登入");
  } 
}, 300000); // 每 300 秒執行一次


// const token = localStorage.getItem("authToken");

// if (!token) {
//   location.href = "managertest.html"; // 沒 token，回登入頁
// }

// fetch("https://key-loan-api-299116105630.asia-east1.run.app/validateToken", {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({ token }),
// })
//   .then(res => res.json())
//   .then(async data => {
//     if (data.success) {
//       // 成功後儲存登入者資訊，繼續載入資料
//       currentUser = data.user;
//       currentRole = data.role;
//       document.getElementById("currentUserName").innerText = currentUser.name || currentUser.id;
//       // 初次載入前先設定 inspectionFilter 預設值
//       document.getElementById("inspectionFilter").value = "incomplete";
//       await reloadWithTimestamp();  // 開始載入資料
//     } else {
//       localStorage.removeItem("authToken");
//       location.href = "managertest.html";
//     }
//   })
//   .catch(err => {
//     console.error("Token validation error:", err);
//     localStorage.removeItem("authToken");
//     location.href = "managertest.html";
//   });

// let currentUser = null;
// let allRecords = [];
// let currentRole = "";
// let showOnlyAbnormal = false;

// // ===== Timeout thresholds (統一門檻) =====
// const TIMEOUT_MS  = 60 * 60 * 1000;   // > 1 小時
// const TIMEOUT0_MS = 30 * 60 * 1000;   // > 0.5 小時 且 ≤ 1 小時
// function getTimeoutFlags(borrowTimeStr) {
//   const t = new Date(borrowTimeStr);
//   if (isNaN(t)) return { timeout: false, timeout0: false, elapsedMs: 0 };
//   const elapsed = Date.now() - t.getTime();
//   const timeout  = elapsed > TIMEOUT_MS;
//   const timeout0 = elapsed > TIMEOUT0_MS && elapsed <= TIMEOUT_MS;
//   return { timeout, timeout0, elapsedMs: elapsed };
// }

// // 🔍 巡檢完成狀態篩選器
// document.getElementById("inspectionFilter").addEventListener("change", () => {
//   filterAndRender(); // 觸發重繪
// });

// // document.getElementById("filterAbnormalBtn").addEventListener("click", () => {
// //   showOnlyAbnormal = !showOnlyAbnormal;
// //   document.getElementById("filterAbnormalBtn").innerText = showOnlyAbnormal
// //     ? "✅ 顯示全部"
// //     : "🚨 僅顯示異常（逾時未巡檢）";
// //   filterAndRender();
// // });

// document.getElementById("searchUser").addEventListener("input", filterAndRender);
// document.getElementById("searchCar").addEventListener("input", filterAndRender);
// document.getElementById("typeFilter").addEventListener("change", filterAndRender);

// // 取得資料
// async function loadRecords() {
//   const statusMsg = document.getElementById("statusMsg");

//   try {
//     const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/all", {
//       headers: { Authorization: `Bearer ${token}` }
//     });
//     const data = await res.json();
    
//     if (!Array.isArray(data)) {
//       statusMsg.innerText = "資料載入失敗，請稍後再試。";
//       return;
//     }

//     allRecords = data;

//     // ✅ 補上 type 欄位（手機/鑰匙）
//     allRecords.forEach(rec => {
//       if (!rec.type) rec.type = rec.物品 ? '手機' : '鑰匙';
//     });

//     // 🆕 預設依借用時間排序（新到舊）
//     allRecords.sort((a, b) => new Date(b.借用時間) - new Date(a.借用時間));
//     sortAsc = false; // 預設方向為反向排序
    
//     // 🔐 再取得目前登入者的角色和完整巡檢資訊
//     const res2 = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
//       headers: { Authorization: `Bearer ${token}` }
//     });
//     const data2 = await res2.json();
//     if (!data2.success) {
//       statusMsg.innerText = "無法取得使用者資訊。";
//       return;
//     }

//     currentRole = data2.role || "";
//     document.getElementById("currentUserName").innerText = `${data2.user?.name || data2.user?.id || "(未知)"}`;

//     // ✅ 將巡檢資料合併進 allRecords
//     if (Array.isArray(data2.records)) {
//       data2.records.forEach(updated => {
//         const index = allRecords.findIndex(r =>
//           r.借用人 === updated.借用人 &&
//           r.車號 === updated.車號 &&
//           r.借用時間 === updated.借用時間
//         );
//         if (index !== -1) {
//           allRecords[index] = { ...allRecords[index], ...updated };
//         }
//       });
//     }

//     filterAndRender();
//   } catch (err) {
//     console.error("載入失敗", err);
//     statusMsg.innerText = "無法連線伺服器。";
//   }
// }

// function formatDate(str) {
//   if (!str) return "";
//   const d = new Date(str);
//   return isNaN(d) ? str : d.toLocaleString("zh-TW");
// }

// function filterAndRender() {
//   const searchUser = document.getElementById("searchUser").value.toLowerCase();
//   const searchCar = document.getElementById("searchCar").value.toLowerCase();
//   const typeFilter = document.getElementById("typeFilter").value;
//   const inspectionFilter = document.getElementById("inspectionFilter").value;

//   const recordBody = document.querySelector("#recordTable tbody");
//   const historyBody = document.querySelector("#historyTable tbody");
//   recordBody.innerHTML = "";
//   historyBody.innerHTML = "";

//   // 將所有條件整合過濾，包含巡檢狀態
//   const filteredRecords = allRecords.filter(record => {
//     const matchUser = !searchUser || record.借用人.toLowerCase().includes(searchUser);
//     const itemName = record.車號 || record.物品 || "";
//     const matchCar = !searchCar || itemName.toLowerCase().includes(searchCar);
//     const matchType = typeFilter === "all" || record.type === typeFilter;

//     let matchInspection = true;
//     if (inspectionFilter === "incomplete") {
//       // 當選取「僅顯示尚未巡檢完成」時，僅保留鑰匙資料且查核狀態不是「巡檢正常」
//       matchInspection = record.type === "鑰匙" && record.查核是否正常 !== "巡檢正常";
//     }

//     return matchUser && matchCar && matchType && matchInspection;
//   });

//   // 將篩選後的資料渲染到適當的表格中
//   filteredRecords.forEach(record => {
//     const isPhone = record.type === '手機';
//     const hasReturned = !!record.歸還時間;
//     const hasInspection = !!record.巡檢結束時間;
//     const noRear = !record.尾車;
//     const incomplete = record.完成率 !== "100%" && record.完成率 !== "100%、100%";

//     // 判斷是否完成（依照你的邏輯）
//     const isVerified = record.查核是否正常 === "巡檢正常";
//     const isDone = (
//       (isPhone && hasReturned) ||
//       (!isPhone && hasReturned && hasInspection && !noRear && !incomplete && isVerified)
//     );

//     const targetBody = isDone ? document.querySelector("#historyTable tbody")
//                               : document.querySelector("#recordTable tbody");

//     renderRow(record, targetBody);
//   });
// }

// function renderRow(record, tbody) {
//   const tr = document.createElement("tr");
//   tr.dataset.borrowTime = record.借用時間;
//   tr.classList.add("fade-in");

//   const isVerified = record.查核是否正常 === "巡檢正常";
//   const hasAction = !!record.異常處置對策;
//   const { timeout, timeout0 } = getTimeoutFlags(record.借用時間);

//   if (record.type !== '手機') {
//     // // 顏色優先序：有處置→黃；>1hr 未處置→紅；0.5~1hr 未處置→綠
//     // if (!isVerified && hasAction) {
//     //   tr.style.backgroundColor = "#fef9dc";  // 黃：已處置（無論時間帶）
//     // } else if (!isVerified && timeout && !hasAction) {
//     //   tr.style.backgroundColor = "#ffdddd";  // 紅：>1hr 未處置
//     // } else if (!isVerified && timeout0 && !hasAction) {
//     //   tr.style.backgroundColor = "#d4edda";  // 綠：0.5~1 小時 未處置
//     // }

//     // 顏色優先序：有處置→綠；>1hr 未處置→紅；0.5~1hr 未處置→黃
//     if (!isVerified && hasAction) {
//       tr.style.backgroundColor = "#d4edda";  // 綠：已處置（無論時間帶）
//     } else if (!isVerified && timeout && !hasAction) {
//       tr.style.backgroundColor = "#ffdddd";  // 紅：>1hr 未處置
//     } else if (!isVerified && timeout0 && !hasAction) {
//       tr.style.backgroundColor = "#fef9dc";  // 黃：0.5~1 小時 未處置
//     }
//   }
  
//   const typeIcon = record.type === '手機' ? "📱" : "🚗";
//   const cols = record.type === '手機'
//     ? [
//         record.借用人,
//         `${typeIcon} ${record.物品 || "-"}`,
//         formatDate(record.借用時間),
//         formatDate(record.歸還時間),
//         "-", "-", "-", "-", "-", "-"
//       ]
//     : [
//         record.借用人,
//         `${typeIcon} ${record.車號 || "-"}`,
//         formatDate(record.借用時間),
//         formatDate(record.歸還時間),
//         record.車頭 || "-",
//         record.尾車 || "-",
//         record.完成率 || "-",
//         formatDate(record.巡檢結束時間),
//         record.查核是否正常 || "-",     
//         record.異常處置對策 || "-"
//       ];

//   cols.forEach(val => {
//     const td = document.createElement("td");
//     td.innerText = val;
//     tr.appendChild(td);
//   });

//   const actionTd = document.createElement("td");

//   // 🔁 歸還：維持「未歸還即可」的原設計
//   if ((currentRole === 'admin' || currentRole === 'manager') && !record.歸還時間) {
//     const returnBtn = document.createElement("button");
//     returnBtn.innerText = "🔁 歸還";
//     returnBtn.onclick = () => handleReturn(record);
//     actionTd.appendChild(returnBtn);
//   }

//   if (currentRole === "admin") {
//     const deleteBtn = document.createElement("button");
//     deleteBtn.innerText = "⛔ 刪除";
//     deleteBtn.onclick = () => handleDelete(record);
//     actionTd.appendChild(deleteBtn);
//   }
  
//   // 📝 編輯：只在 未巡檢正常 + 未處置 + (timeout || timeout0) 時顯示
//   if (
//     record.type !== '手機' &&
//     (currentRole === 'admin' || currentRole === 'manager') &&
//     !isVerified && !hasAction && (timeout || timeout0)
//   ) {
//     const editBtn = document.createElement("button");
//     editBtn.innerText = "📝 編輯";
//     editBtn.onclick = () => handleEditAbnormal(record);
//     actionTd.appendChild(editBtn);
//   }

//   // 🍺 酒測
//   if (
//     record.type === '鑰匙' &&
//     (currentRole === 'admin' || currentRole === 'manager')
//   ) {
//     const alcoholBtn = document.createElement("button");
//     alcoholBtn.innerText = "🍺 酒測";
//     alcoholBtn.onclick = () => handleAlcoholEdit(record);
//     actionTd.appendChild(alcoholBtn);
//   }

//   tr.appendChild(actionTd);
//   tbody.appendChild(tr);

//   return tr; // ✅ 回傳 <tr> 供 update/append 使用
// }

// // // 初始化
// // loadRecords();

// async function handleReturn(record) {
//   const { value: reason } = await Swal.fire({
//     title: "請輸入管理人員代為歸還原因",
//     input: "text",
//     inputPlaceholder: "例如：維修中無法感應",
//     showCancelButton: true,
//     confirmButtonText: "確定",
//     cancelButtonText: "取消"
//   });

//   if (!reason || reason.trim() === "") {
//     Swal.fire("已取消", "請填寫歸還原因", "info");
//     return;
//   }

//   const tableBody = document.querySelector("#recordTable tbody");
//   const rows = tableBody.querySelectorAll("tr");

//   let targetRow = null;
//   let returnBtn = null;
//   for (let tr of rows) {
//     const rUser = tr.children[0].innerText;
//     const rItem = tr.children[1].innerText.replace(/^📱|🚗/, "").trim();
//     const rTime = tr.dataset.borrowTime;

//     if (
//       rUser === record.借用人 &&
//       rItem === (record.車號 || record.物品 || "-") &&
//       rTime === record.借用時間
//     ) {
//       targetRow = tr;
//       returnBtn = Array.from(tr.querySelectorAll("button")).find(btn => btn.innerText.includes("🔁"));
//       break;
//     }
//   }

//   if (returnBtn) {
//     returnBtn.disabled = true;
//     returnBtn.innerText = "⏳ 處理中...";
//   }
//   if (targetRow) {
//     targetRow.style.backgroundColor = "#d0f0ff";
//   }

//   try {
//     const endpoint = record.type === '手機'
//       ? "https://key-loan-api-978908472762.asia-east1.run.app/phone/return"
//       : "https://key-loan-api-978908472762.asia-east1.run.app/borrow/return";

//     const payload = record.type === '手機'
//       ? {
//           借用人: record.借用人,
//           物品: record.物品,
//           借用時間: record.借用時間,
//           歸還原因: reason.trim()
//         }
//       : {
//           借用人: record.借用人,
//           車號: record.車號,
//           借用時間: record.借用時間,
//           歸還原因: reason.trim()
//         };

//     const res = await fetch(endpoint, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`
//       },
//       body: JSON.stringify(payload)
//     });

//     const result = await res.json();

//     if (result.success) {
//       showToast("✅ 已成功標記為歸還", "success");

//       let updatedRecord = null;

//       if (record.type === '手機') {
//         const resAll = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/all", {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         const dataAll = await resAll.json();

//         updatedRecord = dataAll.find(r =>
//           r.借用人 === record.借用人 &&
//           r.借用時間 === record.借用時間 &&
//           r.物品 === record.物品
//         );
//       } else {
//         const resInspect = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         const dataInspect = await resInspect.json();

//         if (dataInspect.success && Array.isArray(dataInspect.records)) {
//           updatedRecord = dataInspect.records.find(r =>
//             r.借用人 === record.借用人 &&
//             r.借用時間 === record.借用時間 &&
//             r.車號 === record.車號
//           );
//         }
//       }

//       if (updatedRecord) {
//         if (!updatedRecord.type) updatedRecord.type = updatedRecord.物品 ? '手機' : '鑰匙';

//         const idx = allRecords.findIndex(r =>
//           r.借用人 === updatedRecord.借用人 &&
//           r.借用時間 === updatedRecord.借用時間 &&
//           (
//             (updatedRecord.type === '手機' && r.物品 === updatedRecord.物品) ||
//             (updatedRecord.type !== '手機' && r.車號 === updatedRecord.車號)
//           )
//         );

//         if (idx !== -1) allRecords[idx] = updatedRecord;
//         else allRecords.push(updatedRecord);

//         updateTableRow(updatedRecord);
//       }

//     } else {
//       Swal.fire("❌ 歸還失敗", result.message || "未知錯誤", "error");
//       if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
//     }

//   } catch (err) {
//     console.error("⚠️ 錯誤", err);
//     Swal.fire("⚠️ 無法連線伺服器", "", "error");
//     if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
//   } finally {
//     if (returnBtn) {
//       returnBtn.disabled = false;
//       returnBtn.innerText = "🔁 歸還";
//     }
//   }
// }

// async function handleEditAbnormal(record) {
//   const { value: input } = await Swal.fire({
//     title: "請輸入異常處置對策",
//     input: "text",
//     inputPlaceholder: "請說明處置方式或補救措施",
//     showCancelButton: true,
//     confirmButtonText: "確定",
//     cancelButtonText: "取消"
//   });

//   if (!input || input.trim() === "") {
//     Swal.fire("未填寫", "已取消更新", "info");
//     return;
//   }

//   const tableBody = document.querySelector("#recordTable tbody");
//   const rows = tableBody.querySelectorAll("tr");

//   let targetRow = null;
//   let editBtn = null;

//   for (let tr of rows) {
//     const tdUser = tr.children[0].innerText.trim();
//     const tdItem = tr.children[1].innerText.replace(/^📱|🚗/, "").trim();
//     const tdTime = tr.children[2].innerText.trim();

//     if (
//       tdUser === record.借用人 &&
//       tdItem === (record.車號 || record.物品 || "-") &&
//       tdTime === formatDate(record.借用時間)
//     ) {
//       targetRow = tr;
//       const actionTd = tr.children[9];
//       editBtn = Array.from(actionTd.querySelectorAll("button"))
//         .find(btn => btn.innerText.includes("📝"));
//       break;
//     }
//   }

//   if (editBtn) {
//     editBtn.disabled = true;
//     editBtn.innerText = "⏳ 更新中...";
//   }

//   if (targetRow) {
//     targetRow.style.transition = "background-color 0.3s ease";
//     targetRow.style.backgroundColor = "#fff3cd"; // 編輯時暫時黃色
//   }

//   try {
//     const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/updateAction", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`
//       },
//       body: JSON.stringify({
//         借用人: record.借用人,
//         車號: record.車號,
//         借用時間: record.借用時間,
//         異常處置對策: input.trim()
//       })
//     });

//     const result = await res.json();
//     // if (result.success) {
//     //   showToast("✅ 已成功更新異常處置對策", "success");

//     //   // 🔄 更新本地資料
//     //   const idx = allRecords.findIndex(r =>
//     //     r.借用人 === record.借用人 &&
//     //     r.借用時間 === record.借用時間 &&
//     //     r.車號 === record.車號
//     //   );
//     //   if (idx !== -1) {
//     //     allRecords[idx].異常處置對策 = input.trim();
//     //   }

//     //   // 📌 一律改成黃色，並移除編輯按鈕
//     //   if (targetRow) {
//     //     targetRow.style.backgroundColor = "#d4edda"; //"#fef9dc";  ⚠️ 黃色：已處置（統一規則）
//     //     const actionTd = targetRow.children[targetRow.children.length - 1];
//     //     const editBtn2 = Array.from(actionTd.querySelectorAll("button"))
//     //       .find(btn => btn.innerText.includes("📝"));
//     //     if (editBtn2) editBtn2.remove();
//     //   }

//     // } else {
//     //   Swal.fire("❌ 更新失敗", result.message || "", "error");
//     //   if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
//     // }
// //      } catch (err) {
// //     console.error("伺服器錯誤", err);
// //     Swal.fire("⚠️ 伺服器錯誤", "請稍後再試", "error");
// //     if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
// //   } finally {
// //     if (editBtn) {
// //       editBtn.disabled = false;
// //       editBtn.innerText = "📝 編輯";
// //     }
// //   }
// // }

    
//     // 成功後
//   if (result.success) {
//     showToast("✅ 已成功更新異常處置對策", "success");
  
//     // 直接重抓，讓前端顯示到完整的「編號 + 內容(時間)」合併結果
//     await reloadWithTimestamp();
  
//     // 視覺提示：維持暫黃就好；不要移除「📝 編輯」按鈕
//     if (targetRow) {
//       targetRow.style.backgroundColor = "#fff3cd"; // 暫黃提示
//       setTimeout(() => {
//         // 由 updateTableRow / render 決定真正底色
//         targetRow.style.backgroundColor = "";
//       }, 800);
//     }
//   } else {
//     Swal.fire("❌ 更新失敗", result.message || "", "error");
//     if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
//   }

 

// // async function handleEditAbnormal(record) {
// //   ...（舊版，已移除，保留註解略）
// // }

// async function handleAlcoholEdit(record) {
//   try {
//     // 🔁 直接從 allRecords 找出這筆紀錄
//     const target = allRecords.find(r =>
//       r.借用人 === record.借用人 &&
//       r.借用時間 === record.借用時間 &&
//       r.車號 === record.車號
//     );

//     if (!target) {
//       Swal.fire("❌ 找不到資料", "請重新整理頁面", "error");
//       return;
//     }

//     const { 回場酒測, 酒測追查註記, 酒測3to15, 酒測3小時內 } = target;

//     const { value: formValues } = await Swal.fire({
//       title: "🍺 編輯酒測資料",
//       html: `
//         <input id="field1" class="swal2-input" placeholder="回場酒測" value="${回場酒測 || ""}">
//         <input id="field2" class="swal2-input" placeholder="酒測追查註記" value="${酒測追查註記 || ""}">
//         <input id="field3" class="swal2-input" placeholder="借用後3~15小時紀錄" value="${酒測3to15 || ""}">
//         <input id="field4" class="swal2-input" placeholder="借用後3小時內紀錄" value="${酒測3小時內 || ""}">
//       `,
//       focusConfirm: false,
//       showCancelButton: true,
//       confirmButtonText: "儲存",
//       cancelButtonText: "取消",
//       preConfirm: () => {
//         return {
//           回場酒測: document.getElementById("field1").value.trim(),
//           酒測追查註記: document.getElementById("field2").value.trim(),
//           酒測3to15: document.getElementById("field3").value.trim(),
//           酒測3小時內: document.getElementById("field4").value.trim()
//         };
//       }
//     });

//     if (!formValues) return;

//     // ⬇ 送出更新 API
//     const updateRes = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/updateAlcoholFields", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`
//       },
//       body: JSON.stringify({
//         借用人: record.借用人,
//         車號: record.車號,
//         借用時間: record.借用時間,
//         ...formValues
//       })
//     });

//     const updateData = await updateRes.json();
//     if (updateData.success) {
//       Swal.fire("✅ 更新成功", "酒測資料已儲存", "success");
//       reloadWithTimestamp();  // ✅ 更新畫面
//     } else {
//       Swal.fire("❌ 更新失敗", updateData.message || "", "error");
//     }

//   } catch (err) {
//     console.error("handleAlcoholEdit 錯誤", err);
//     Swal.fire("❌ 錯誤", "無法連線伺服器", "error");
//   }
// }

// async function handleDelete(record) {
//   if (!confirm("確定要刪除此紀錄嗎？此操作不可復原")) return;

//   try {
//     const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/delete", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`
//       },
//       body: JSON.stringify({
//         借用人: record.借用人,
//         車號: record.車號,
//         借用時間: record.借用時間
//       })
//     });

//     const result = await res.json();
//     if (result.success) {
//       alert("已成功刪除");
//       loadRecords();
//     } else {
//       alert("刪除失敗：" + (result.message || ""));
//     }
//   } catch (err) {
//     alert("伺服器錯誤");
//     console.error(err);
//   }
// }

// // let sortAsc = true;  // 初始排序方向
// let sortAsc = false;  // 初始排序方向

// // 排序借用時間
// document.getElementById("sortTimeBtn").onclick = () => {
//   allRecords.sort((a, b) => {
//     const t1 = new Date(a.借用時間);
//     const t2 = new Date(b.借用時間);
//     return sortAsc ? t1 - t2 : t2 - t1;
//   });
//   sortAsc = !sortAsc;
//   filterAndRender(); // ⬅ 這裡改掉
// };

// let sortInspectionAsc = true; // 初始排序方向

// document.getElementById("sortInspectionBtn").onclick = () => {
//   allRecords.sort((a, b) => {
//     const t1 = a.巡檢結束時間 ? new Date(a.巡檢結束時間) : null;
//     const t2 = b.巡檢結束時間 ? new Date(b.巡檢結束時間) : null;

//     if (!t1 && !t2) return 0;         // 都沒有時間 → 不變
//     if (!t1) return sortInspectionAsc ? 1 : -1;  // a 沒時間 → 排後或前
//     if (!t2) return sortInspectionAsc ? -1 : 1;  // b 沒時間 → 排後或前

//     return sortInspectionAsc ? t1 - t2 : t2 - t1;
//   });

//   sortInspectionAsc = !sortInspectionAsc;
//   filterAndRender();
// };

// // 顯示最後更新時間
// function updateLastUpdateTime() {
//   const now = new Date().toLocaleString("zh-TW");
//   document.getElementById("lastUpdateTime").innerText = now;
// }

// // 每次載入完成都更新時間
// async function reloadWithTimestamp() {
//   await loadRecords();
//   updateLastUpdateTime();
// }

// // 手動刷新按鈕
// document.getElementById("refreshBtn").addEventListener("click", reloadWithTimestamp);

// // 自動每 60 秒 1分更新
// setInterval(reloadWithTimestamp, 60 * 1000);

// // 初次載入前先設定 inspectionFilter 預設值
// document.getElementById("inspectionFilter").value = "incomplete";

// // 初次載入
// reloadWithTimestamp();

// let lastCheckTime = new Date().toISOString();
// const shownKeys = new Set();  // 防止重複顯示

// async function checkLatestChanges() {
//   try {
//     const [resPhone, resKey] = await Promise.all([
//       fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/all", {
//         headers: { Authorization: `Bearer ${token}` }
//       }),
//       fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
//         headers: { Authorization: `Bearer ${token}` }
//       })
//     ]);

//     const phoneData = await resPhone.json();
//     const keyData = await resKey.json();

//     const combinedRecords = [];

//     // 📱 手機資料處理
//     if (Array.isArray(phoneData)) {
//       phoneData.forEach(r => {
//         if (!r.type) r.type = r.物品 ? '手機' : '鑰匙';
//         if (r.type === '手機') combinedRecords.push(r);
//       });
//     }

//     // 🚗 鑰匙資料處理
//     if (keyData.success && Array.isArray(keyData.records)) {
//       keyData.records.forEach(r => {
//         if (!r.type) r.type = r.物品 ? '手機' : '鑰匙';
//         if (r.type !== '手機') combinedRecords.push(r);
//       });
//     }

//     // 篩選新資料
//     const newRecords = combinedRecords.filter(r => {
//       const updatedTime = new Date(r.最後更新時間 || r.歸還時間 || r.借用時間);
//       return updatedTime > new Date(lastCheckTime);
//     });

//     if (newRecords.length === 0) return;

//     const ul = document.getElementById("changesList");
//     const container = document.getElementById("latestChanges");
//     container.style.display = "block";

//     newRecords.forEach(rec => {
//       const key = `${rec.借用人}-${rec.車號 || rec.物品}-${rec.借用時間}`;
//       if (!shownKeys.has(key)) {
//         shownKeys.add(key);

//         const li = document.createElement("li");
//         const typeIcon = rec.type === "手機" ? "📱" : "🚗";
//         li.innerText = `${typeIcon} ${rec.借用人} - ${rec.車號 || rec.物品} 已有更新`;
//         li.style.padding = "4px 0";
//         ul.prepend(li);
//       }

//       // 比對並更新 allRecords
//       const idx = allRecords.findIndex(r =>
//         r.借用人 === rec.借用人 &&
//         r.借用時間 === rec.借用時間 &&
//         (
//           (rec.type === '手機' && r.物品 === rec.物品) ||
//           (rec.type !== '手機' && r.車號 === rec.車號)
//         )
//       );

//       if (idx !== -1) {
//         allRecords[idx] = rec;
//         updateTableRow(rec);
//       } else {
//         allRecords.push(rec);
//         appendTableRow(rec);
//       }
//     });

//     // 限制提示數量上限
//     while (ul.children.length > 10) {
//       ul.removeChild(ul.lastChild);
//     }

//     // 更新時間
//     const allTimes = newRecords.map(r =>
//       new Date(r.最後更新時間 || r.歸還時間 || r.借用時間).getTime()
//     );
//     if (allTimes.length > 0) {
//       lastCheckTime = new Date(Math.max(...allTimes)).toISOString();
//     }

//   } catch (err) {
//     console.error("❌ checkLatestChanges 錯誤：", err);
//   }
// }

// setInterval(checkLatestChanges, 90 * 1000); // 每 90 秒 1.5分檢查一次

// export function showToast(message, type = "success") {
//   const toast = document.getElementById("toast");
//   toast.innerText = message;

//   // 設定邊框顏色（根據提示類型）
//   const colors = {
//     success: "#4caf50",
//     error: "#f44336",
//     info: "#2196f3",
//     warning: "#ff9800"
//   };
//   toast.style.borderLeftColor = colors[type] || "#333";

//   // 顯示動畫
//   toast.style.display = "block";
//   requestAnimationFrame(() => {
//     toast.style.opacity = "1";
//     toast.style.transform = "translate(-50%, -50%) scale(1)";
//   });

//   // 自動淡出
//   setTimeout(() => {
//     toast.style.opacity = "0";
//     toast.style.transform = "translate(-50%, -50%) scale(0.9)";
//     setTimeout(() => {
//       toast.style.display = "none";
//     }, 400);
//   }, 5000);
// }

// // 啟用桌面通知
// if (Notification.permission !== "granted") {
//   Notification.requestPermission();
// }

// function speakText(message) {
//   if ('speechSynthesis' in window) {
//     const utterance = new SpeechSynthesisUtterance(message);
//     utterance.lang = "zh-TW"; // 使用中文語音
//     speechSynthesis.speak(utterance);
//   }
// }

// function showChange(message) {
//   const latestChanges = document.getElementById("latestChanges");
//   const changesList = document.getElementById("changesList");

//   const li = document.createElement("li");
//   li.textContent = message;
//   li.style.padding = "5px 0";
//   changesList.appendChild(li);

//   // 顯示懸浮窗
//   latestChanges.style.display = "block";

//   // ✅ 額外通知 - 桌面通知
//   if (Notification.permission === "granted") {
//     new Notification("🔔 異動通知", {
//       body: message,
//       icon: "https://github.githubassets.com/favicons/favicon.png"
//     });
//   }

//   // ✅ 額外通知 - 音效播放
//   speakText(message);  // 🗣️ 用語音講出異動內容
// }

// // 清空按鈕
// document.getElementById("clearChangesBtn").addEventListener("click", () => {
//   document.getElementById("changesList").innerHTML = "";
//   document.getElementById("latestChanges").style.display = "none";
// });

// document.getElementById("clearChangesBtn").addEventListener("click", () => {
//   document.getElementById("changesList").innerHTML = "";
//   document.getElementById("latestChanges").style.display = "none";
// });

// //🔧 更新單一列（by 資料）
// function updateTableRow(record) {
//   const allRows = document.querySelectorAll("#recordTable tbody tr, #historyTable tbody tr");

//   for (const tr of allRows) {
//     const rUser = tr.children[0].innerText;
//     const rItem = tr.children[1].innerText.replace(/^📱|🚗/, "").trim();
//     const rTime = tr.dataset.borrowTime;

//     if (
//       rUser === record.借用人 &&
//       rItem === (record.車號 || record.物品 || "-") &&
//       rTime === record.借用時間
//     ) {
//       const isPhone = record.type === '手機';

//       const newCols = isPhone
//         ? [
//             record.借用人,
//             `📱 ${record.物品 || "-"}`,
//             formatDate(record.借用時間),
//             formatDate(record.歸還時間),
//             "-", "-", "-", "-", "-", "-"
//           ]
//         : [
//             record.借用人,
//             `🚗 ${record.車號 || "-"}`,
//             formatDate(record.借用時間),
//             formatDate(record.歸還時間),
//             record.車頭 || "-",
//             record.尾車 || "-",
//             record.完成率 || "-",
//             formatDate(record.巡檢結束時間),
//             record.查核是否正常 || "-",
//             record.異常處置對策 || "-"
//           ];

//       newCols.forEach((val, idx) => {
//         if (tr.children[idx]) tr.children[idx].innerText = val;
//       });

//       // ✅ 更新背景顏色（統一新門檻）
//       const isVerified = record.查核是否正常 === "巡檢正常";
//       const hasAction = !!record.異常處置對策;
//       const { timeout, timeout0 } = getTimeoutFlags(record.借用時間);
      
//       // 強制先清除背景（以防殘留）
//       tr.style.backgroundColor = "";

//       if (!isPhone) {
//         // // 有處置 → 黃；>1hr 未處置 → 紅；0.5~1hr 未處置 → 綠
//         // if (!isVerified && hasAction) {
//         //   tr.style.setProperty("background-color", "#fef9dc", "important"); // 黃（已處置）
//         // } else if (!isVerified && timeout && !hasAction) {
//         //   tr.style.setProperty("background-color", "#ffdddd", "important"); // 紅
//         // } else if (!isVerified && timeout0 && !hasAction) {
//         //   tr.style.setProperty("background-color", "#d4edda", "important"); // 綠（未處置）
//         // }
        
//         // 顏色優先序：有處置→綠；>1hr 未處置→紅；0.5~1hr 未處置→黃
//         if (!isVerified && hasAction) {
//           tr.style.backgroundColor = "#d4edda";  // 綠：已處置（無論時間帶）
//         } else if (!isVerified && timeout && !hasAction) {
//           tr.style.backgroundColor = "#ffdddd";  // 紅：>1hr 未處置
//         } else if (!isVerified && timeout0 && !hasAction) {
//           tr.style.backgroundColor = "#fef9dc";  // 黃：0.5~1 小時 未處置
//         }
//       }

//       // ✅ 操作按鈕重新建立
//       const actionTd = tr.children[tr.children.length - 1];
//       actionTd.innerHTML = "";

//       // 🍺 酒測
//       if (
//         record.type === '鑰匙' &&
//         (currentRole === 'admin' || currentRole === 'manager')
//       ) {
//         const alcoholBtn = document.createElement("button");
//         alcoholBtn.innerText = "🍺 酒測";
//         alcoholBtn.onclick = () => handleAlcoholEdit(record);
//         actionTd.appendChild(alcoholBtn);
//       }

//       // 🔁 歸還（維持原則：未歸還即可）
//       if ((currentRole === 'admin' || currentRole === 'manager') && !record.歸還時間) {
//         const returnBtn = document.createElement("button");
//         returnBtn.innerText = "🔁 歸還";
//         returnBtn.onclick = () => handleReturn(record);
//         actionTd.appendChild(returnBtn);
//       }

//       if (currentRole === "admin") {
//         const deleteBtn = document.createElement("button");
//         deleteBtn.innerText = "⛔ 刪除";
//         deleteBtn.onclick = () => handleDelete(record);
//         actionTd.appendChild(deleteBtn);
//       }

//       // 📝 編輯：擴充至包含 0.5~1 小時綠帶（且未處置）
//       if (
//         record.type !== '手機' &&
//         (currentRole === 'admin' || currentRole === 'manager') &&
//         !isVerified && !hasAction && (timeout || timeout0)
//       ) {
//         const editBtn = document.createElement("button");
//         editBtn.innerText = "📝 編輯";
//         editBtn.onclick = () => handleEditAbnormal(record);
//         actionTd.appendChild(editBtn);
//       }

//       return;
//     }
//   }
// }

// function appendTableRow(record) {
//   const isPhone = record.type === '手機';
//   const hasReturned = !!record.歸還時間;
//   const hasInspection = !!record.巡檢結束時間;
//   const noRear = !record.尾車;
//   const incomplete = record.完成率 !== "100%" && record.完成率 !== "100%、100%";

//   // ✅ 新增條件：查核是否正常 === "巡檢正常"
//   const isVerified = record.查核是否正常 === "巡檢正常";
//   const isDone = (
//     (isPhone && hasReturned) ||
//     (!isPhone && hasReturned && hasInspection && !noRear && !incomplete && isVerified)
//   );
//   const targetBody = isDone
//     ? document.querySelector("#historyTable tbody")
//     : document.querySelector("#recordTable tbody");

//   // 底色與按鈕顯示統一交由 renderRow 處理
//   renderRow(record, targetBody);
// }

// // ✅ 使用者閒置檢查
// let lastAction = Date.now();

// // 滑鼠移動即更新最後操作時間
// document.addEventListener('mousemove', () => lastAction = Date.now());
// document.addEventListener('keydown', () => lastAction = Date.now());

// setInterval(() => {
//   const now = Date.now();
//   const idleTime = now - lastAction;

//   if (idleTime > 60 * 60 * 1000) {  // 60 分鐘
//     location.reload();  // 或 location.href = "index.html"
//     alert("閒置太久，請重新登入");
//   } 
// }, 300000); // 每 300 秒執行一次
