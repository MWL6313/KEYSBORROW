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

    if (!record.歸還時間) {
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

loadRecords();

