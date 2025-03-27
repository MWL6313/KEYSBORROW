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

    // ✅ 顯示登入帳號
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
  
    // ✅ 若啟用只顯示異常
    if (showOnlyAbnormal) {
      const now = new Date();
      const borrowTime = new Date(r.借用時間);
      const inspectionTime = r.巡檢結束時間 ? new Date(r.巡檢結束時間) : null;
      const isTimeout = !inspectionTime && !isNaN(borrowTime) && (now - borrowTime) > 1.5 * 60 * 60 * 1000;
      return matchUser && matchCar && isTimeout;
    }
  
    return matchUser && matchCar;
  });


  // filtered.forEach(record => {
  //   const tr = document.createElement("tr");
  //   const cols = [
  //     record.借用人,
  //     record.車號,
  //     formatDate(record.借用時間),
  //     formatDate(record.歸還時間),
  //     record.車頭 || "-",
  //     record.尾車 || "-",
  //     record.完成率 || "-",
  //     formatDate(record.巡檢結束時間)
  //   ];
  filtered.forEach(record => {
    const tr = document.createElement("tr");
  
    // ✅ 判斷：若巡檢結束時間為空，且借用時間已超過 1.5 小時
    const now = new Date();
    const borrowTime = new Date(record.借用時間);
    const inspectionTime = record.巡檢結束時間 ? new Date(record.巡檢結束時間) : null;
  
    const isTimeoutWithoutInspection =
      !inspectionTime &&
      !isNaN(borrowTime) &&
      (now - borrowTime) > 1.5 * 60 * 60 * 1000; // 1.5 小時
  
    if (isTimeoutWithoutInspection) {
      tr.style.backgroundColor = "#ffdddd"; // 淺紅背景
    }
  
    const cols = [
      record.借用人,
      record.車號,
      formatDate(record.借用時間),
      formatDate(record.歸還時間),
      record.車頭 || "-",
      record.尾車 || "-",
      record.完成率 || "-",
      formatDate(record.巡檢結束時間)
    ];

    cols.forEach(val => {
      const td = document.createElement("td");
      td.innerText = val || "";
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

    tr.appendChild(actionTd);
    tableBody.appendChild(tr);
  });
}

function formatDate(str) {
  if (!str) return "";
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleString("zh-TW");
}

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
      // ✅ 從 API 重新抓該筆資料（使用 updatedAfter 查詢）
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
          // ✅ 更新 allRecords 裡的那筆
          const idx = allRecords.findIndex(r =>
            r.借用人 === updatedRecord.借用人 &&
            r.車號 === updatedRecord.車號 &&
            r.借用時間 === updatedRecord.借用時間
          );
          if (idx !== -1) allRecords[idx] = updatedRecord;

          // ✅ 更新畫面上的那一列
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
    const t1 = new Date(a.巡檢結束時間);
    const t2 = new Date(b.巡檢結束時間);
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
        li.innerText = `📌 ${newRec.借用人} 、 ${newRec.車號}（${formatDate(newRec.借用時間)}）\n🕓 更新於 ${formatDate(newRec.最後更新時間)}`;
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
      // ✅ 更新文字欄位
      const cols = [
        record.借用人,
        record.車號,
        formatDate(record.借用時間),
        formatDate(record.歸還時間),
        record.車頭 || "-",
        record.尾車 || "-",
        record.完成率 || "-",
        formatDate(record.巡檢結束時間)
      ];
      cols.forEach((val, i) => {
        tr.children[i].innerText = val || "";
      });

      // ✅ 重新建構操作欄（最後一欄）
      const actionTd = tr.children[8];
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

      return;
    }
  }
}


//🔧 新增一列（如果是新資料）
function appendTableRow(record) {
  const tableBody = document.querySelector("#recordTable tbody");
  const tr = document.createElement("tr");
  const cols = [
    record.借用人,
    record.車號,
    formatDate(record.借用時間),
    formatDate(record.歸還時間),
    record.車頭 || "-",
    record.尾車 || "-",
    record.完成率 || "-",
    formatDate(record.巡檢結束時間)
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

  tr.appendChild(actionTd);
  tableBody.appendChild(tr);
}

