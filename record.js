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

    // ✅ 補上 type 欄位（手機/鑰匙）
    allRecords.forEach(rec => {
      if (!rec.type) rec.type = rec.物品 ? '手機' : '鑰匙';
    });
    
    // 🔐 再取得目前登入者的角色和完整巡檢資訊
    const res2 = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
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

    // 分流邏輯：
    const isDone = (isPhone && hasReturned) || (!isPhone && hasReturned && hasInspection);
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

  const incomplete = record.完成率 !== "100%" && record.完成率 !== "100%、100%";
  
  const timeout = !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
  const noInspection = !inspectionTime;
  const hasAction = !!record.異常處置對策;

  // if (record.type !== '手機') {
  //   if (noInspection && timeout && !hasAction) {
  //     tr.style.backgroundColor = "#ffdddd";
  //   } else if (noInspection && timeout && hasAction) {
  //     tr.style.backgroundColor = "#eeeeee";
  //   }
  // }

    // ✅ 異常標示（非手機且完成率異常）
  if (record.type !== '手機') {
    if ((noInspection && timeout && !hasAction) || (incomplete && timeout && !hasAction)) {
      tr.style.backgroundColor = "#ffdddd"; // 紅色表示異常未處理
    } else if ((noInspection && timeout && hasAction) || (incomplete && timeout && hasAction)) {
      tr.style.backgroundColor = "#eeeeee"; // 灰色表示異常已處理
    }
  }
  
  const typeIcon = record.type === '手機' ? "📱" : "🚗";
  const cols = record.type === '手機'
    ? [
        record.借用人,
        `${typeIcon} ${record.物品 || "-"}`,
        formatDate(record.借用時間),
        formatDate(record.歸還時間),
        "-", "-", "-", "-", "-"
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

  // 操作按鈕
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
    // !record.巡檢結束時間 &&
    // timeout &&
    // !hasAction
    ((noInspection && timeout && !hasAction) || (incomplete && timeout && !hasAction))
    ) {
    const editBtn = document.createElement("button");
    editBtn.innerText = "📝 編輯";
    editBtn.onclick = () => handleEditAbnormal(record);
    actionTd.appendChild(editBtn);
  }

  tr.appendChild(actionTd);
  tbody.appendChild(tr);

  return tr; // ✅ 回傳 <tr> 供 update/append 使用
}


// // 初始化
// loadRecords();


async function handleReturn(record) {
  if (!confirm("確定要標記為歸還嗎？")) return;

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
      // alert("✅ 已成功標記為歸還");
      // showSingleChange("✅ 已成功標記為歸還");
      showToast("✅ 已成功標記為歸還", "success");

      // 📌 分流處理
      let updatedRecord = null;

      if (record.type === '手機') {
        // ✅ 手機改用 /borrow/all
        const resAll = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/all", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataAll = await resAll.json();

        updatedRecord = dataAll.find(r =>
          r.借用人 === record.借用人 &&
          r.借用時間 === record.借用時間 &&
          r.物品 === record.物品
        );

      } else {
        // ✅ 鑰匙使用 withInspection
        const resInspect = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
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
      alert("❌ 歸還失敗：" + (result.message || ""));
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



// async function handleReturn(record) {
//   if (!confirm("確定要標記為歸還嗎？")) return;

//   const tableBody = document.querySelector("#recordTable tbody");
//   const rows = tableBody.querySelectorAll("tr");

//   let targetRow = null;
//   let returnBtn = null;
//   for (let tr of rows) {
//     const rUser = tr.children[0].innerText;
//     const rItem = tr.children[1].innerText.replace(/^📱|🚗/, "").trim(); // 清除 icon
//     const rTime = tr.children[2].innerText;

//     if (rUser === record.借用人 && rItem === (record.車號 || record.物品 || "-") && rTime === formatDate(record.借用時間)) {
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
//           借用時間: record.借用時間
//         }
//       : {
//           借用人: record.借用人,
//           車號: record.車號,
//           借用時間: record.借用時間
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
//       alert("✅ 已成功標記為歸還");

//       // ⏬ 重新抓最新資料（單筆）
//       const updatedRes = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/all", {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const updatedData = await updatedRes.json();

//       const updatedRecord = updatedData.find(r =>
//         r.借用人 === record.借用人 &&
//         r.借用時間 === record.借用時間 &&
//         ((record.type === '手機' && r.物品 === record.物品) ||
//          (record.type !== '手機' && r.車號 === record.車號))
//       );

//       if (updatedRecord) {
//         if (!updatedRecord.type) updatedRecord.type = updatedRecord.物品 ? '手機' : '鑰匙';

//         const idx = allRecords.findIndex(r =>
//           r.借用人 === updatedRecord.借用人 &&
//           r.借用時間 === updatedRecord.借用時間 &&
//           ((record.type === '手機' && r.物品 === updatedRecord.物品) ||
//            (record.type !== '手機' && r.車號 === updatedRecord.車號))
//         );

//         if (idx !== -1) allRecords[idx] = updatedRecord;
//         else allRecords.push(updatedRecord);

//         updateTableRow(updatedRecord);
//       }
//     } else {
//       alert("❌ 歸還失敗：" + (result.message || ""));
//       if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
//     }
//   } catch (err) {
//     alert("⚠️ 無法連線伺服器");
//     console.error(err);
//     if (targetRow) targetRow.style.backgroundColor = "#f8d7da";
//   } finally {
//     if (returnBtn) {
//       returnBtn.disabled = false;
//       returnBtn.innerText = "🔁 歸還";
//     }
//   }
// }




async function handleEditAbnormal(record) {
  const input = prompt("請輸入異常處置對策：", "");
  if (!input) return;

  // 找到對應行與按鈕
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
      // alert("✅ 已成功更新異常處置對策");
      showToast("✅ 已成功更新異常處置對策", "success");

      // 成功後重新抓 /borrow/withInspection，確保資料包含巡檢欄位
    const updatedRes = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await updatedRes.json();
    
    if (data.success && Array.isArray(data.records)) {
      const updatedRecord = data.records.find(r =>
        r.借用人 === record.借用人 &&
        r.借用時間 === record.借用時間 &&
        (
          (record.type === '手機' && r.物品 === record.物品) ||
          (record.type !== '手機' && r.車號 === record.車號)
        )
      );
    
      if (updatedRecord) {
        // 保底補 type 欄位
        if (!updatedRecord.type) updatedRecord.type = updatedRecord.物品 ? '手機' : '鑰匙';
    
        const idx = allRecords.findIndex(r =>
          r.借用人 === updatedRecord.借用人 &&
          r.借用時間 === updatedRecord.借用時間 &&
          (
            (record.type === '手機' && r.物品 === updatedRecord.物品) ||
            (record.type !== '手機' && r.車號 === updatedRecord.車號)
          )
        );
    
        if (idx !== -1) allRecords[idx] = updatedRecord;
        else allRecords.push(updatedRecord);
    
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
    const [resPhone, resKey] = await Promise.all([
      fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/all", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection", {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const phoneData = await resPhone.json();
    const keyData = await resKey.json();

    const combinedRecords = [];

    // 📱 手機資料處理
    if (Array.isArray(phoneData)) {
      phoneData.forEach(r => {
        if (!r.type) r.type = r.物品 ? '手機' : '鑰匙';
        if (r.type === '手機') combinedRecords.push(r);
      });
    }

    // 🚗 鑰匙資料處理
    if (keyData.success && Array.isArray(keyData.records)) {
      keyData.records.forEach(r => {
        if (!r.type) r.type = r.物品 ? '手機' : '鑰匙';
        if (r.type !== '手機') combinedRecords.push(r);
      });
    }

    // 篩選新資料
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

      // 比對並更新 allRecords
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

    // 限制提示數量上限
    while (ul.children.length > 10) {
      ul.removeChild(ul.lastChild);
    }

    // 更新時間
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


setInterval(checkLatestChanges, 30 * 1000); // 每 30 秒檢查一次


export function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.innerText = message;

  // 設定邊框顏色（根據提示類型）
  const colors = {
    success: "#4caf50",
    error: "#f44336",
    info: "#2196f3",
    warning: "#ff9800"
  };
  toast.style.borderLeftColor = colors[type] || "#333";

  // 顯示動畫
  toast.style.display = "block";
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, -50%) scale(1)";
  });

  // 自動淡出
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, -50%) scale(0.9)";
    setTimeout(() => {
      toast.style.display = "none";
    }, 400);
  }, 5000);
}



// function showSingleChange(message) {
//   const container = document.getElementById("latestChanges");
//   const changesList = document.getElementById("changesList");

//   // 清空所有舊訊息
//   changesList.innerHTML = "";

//   const li = document.createElement("li");
//   li.textContent = message;
//   li.style.padding = "5px 0";
//   li.style.opacity = "1";
//   li.style.transition = "opacity 0.5s ease";

//   changesList.appendChild(li);
//   container.style.display = "block";

//   // 自動淡出
//   setTimeout(() => {
//     li.style.opacity = "0";
//     setTimeout(() => {
//       changesList.innerHTML = "";
//       container.style.display = "none";
//     }, 500); // 動畫完成後移除
//   }, 3000); // 3秒後開始淡出
// }


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
      const parent = tr.parentElement;
      parent.removeChild(tr);

      const isPhone = record.type === '手機';
      const isDone = (isPhone && record.歸還時間) || (!isPhone && record.歸還時間 && record.巡檢結束時間);
      const targetBody = isDone
        ? document.querySelector("#historyTable tbody")
        : document.querySelector("#recordTable tbody");

      renderRow(record, targetBody);
      return;
    }
  }
}

function appendTableRow(record) {
  const isPhone = record.type === '手機';
  const isDone = (isPhone && record.歸還時間) || (!isPhone && record.歸還時間 && record.巡檢結束時間);
  const targetBody = isDone
    ? document.querySelector("#historyTable tbody")
    : document.querySelector("#recordTable tbody");

  renderRow(record, targetBody);
}

