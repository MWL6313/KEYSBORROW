function renderTable(records) {
  const list = document.getElementById("recordList");
  list.innerHTML = "";

  records.forEach(r => {
    const row = document.createElement("div");
    row.className = "record-row";

    row.innerHTML = `
      <div><strong>${r.借用人}</strong></div>
      <div>車號：${r.車號}</div>
      <div>時間：${r.借用時間}</div>
      <div>巡檢：${r.異常 || "未完成"}</div>
      ${currentUser?.role === "admin" ? `<button class="deleteBtn">🗑️ 刪除</button>` : ""}
    `;

    if (currentUser?.role === "admin") {
      row.querySelector(".deleteBtn").addEventListener("click", () => {
        if (confirm(`確定要刪除這筆紀錄？\n借用人：${r.借用人}\n車號：${r.車號}`)) {
          deleteRecord(r);
        }
      });
    }

    list.appendChild(row);
  });
}


async function deleteRecord(record) {
  const token = localStorage.getItem("authToken");
  const res = await fetch("https://key-loan-api-xxx.a.run.app/borrow/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(record),
  });

  const data = await res.json();
  if (data.success) {
    alert("刪除成功！");
    loadRecords();
  } else {
    alert("刪除失敗：" + data.message);
  }
}
