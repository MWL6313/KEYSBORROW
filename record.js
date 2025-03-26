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

  if (currentRole === 'admin' && !record.歸還時間) {
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

// 篩選日期區間（如果你有日期欄位）
// function filterRecords() {
//   const start = new Date(document.getElementById("startDate").value);
//   const end = new Date(document.getElementById("endDate").value);
//   const filtered = allRecords.filter(r => {
//     const time = new Date(r.借用時間);
//     return (!isNaN(start) ? time >= start : true) &&
//            (!isNaN(end) ? time <= end : true);
//   });
//   // renderTable(filtered);  // ⛔這行應刪除
//   allRecords = filtered;
//   filterAndRender(); // ✅用這行重新渲染
// }


// // 匯出 CSV
// document.getElementById("exportCsvBtn").onclick = () => {
//   const rows = [["借用人","車號","借用時間","歸還時間","車頭","尾車","完成率","巡檢結束時間"]];
//   allRecords.forEach(r => {
//     rows.push([
//       r.借用人, r.車號, r.借用時間, r.歸還時間, r.車頭 || "", r.尾車 || "", r.完成率 || "", r.巡檢結束時間 || ""
//     ]);
//   });
//   const csv = rows.map(r => r.join(",")).join("\n");
//   const blob = new Blob([csv], { type: "text/csv" });
//   const link = document.createElement("a");
//   link.href = URL.createObjectURL(blob);
//   link.download = "借用紀錄.csv";
//   link.click();
// };

// // 匯出 PDF（簡單表格）
// document.getElementById("exportPdfBtn").onclick = () => {
//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   doc.text("鑰匙借用與巡檢總覽", 10, 10);

//   allRecords.forEach((r, i) => {
//     doc.text(`${i + 1}. ${r.借用人} / ${r.車號} / ${formatDate(r.借用時間)}`, 10, 20 + i * 8);
//   });

//   doc.save("borrow_records.pdf");
// };

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

// 自動每 30 秒更新
setInterval(reloadWithTimestamp, 30 * 1000);

// 初次載入
reloadWithTimestamp();



