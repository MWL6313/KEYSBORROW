const token = localStorage.getItem("authToken");
if (!token) location.href = "index.html";

let allRecords = [];
let currentRole = "";

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

  const filtered = allRecords.filter(r =>
    (!searchUser || r.借用人.toLowerCase().includes(searchUser)) &&
    (!searchCar || r.車號.toLowerCase().includes(searchCar))
  );

  filtered.forEach(record => {
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
      alert("已成功標記歸還");
      loadRecords();
    } else {
      alert("歸還失敗");
    }
  } catch (err) {
    alert("伺服器錯誤");
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

    if (data.records.length > 0) {
      const ul = document.getElementById("changesList");

      data.records.forEach(r => {
        const uniqueKey = `${r.借用人}-${r.車號}-${r.借用時間}`;
        if (shownKeys.has(uniqueKey)) return; // 已顯示過就跳過
        shownKeys.add(uniqueKey);

        const li = document.createElement("li");
        li.innerText = `📌 ${r.借用人} 借用 ${r.車號}（${formatDate(r.借用時間)}）\n🕓 更新於 ${formatDate(r.最後更新時間)}`;
        li.style.padding = "4px 0";
        ul.prepend(li);
      });

      // 最多只保留 10 筆
      while (ul.children.length > 10) {
        const last = ul.lastChild;
        const key = last?.dataset?.key;
        if (key) shownKeys.delete(key);
        ul.removeChild(last);
      }

      // 也更新主表格
      await loadRecords();
    }

    // 更新查詢時間為最新異動時間（避免漏抓）
    const latestUpdate = data.records
      .map(r => r.最後更新時間)
      .filter(Boolean)
      .sort()
      .pop(); // 最新的一筆

    if (latestUpdate) lastCheckTime = latestUpdate;

  } catch (err) {
    console.error("檢查異動錯誤", err);
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
