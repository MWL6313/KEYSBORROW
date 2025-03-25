// dashboard.js

// 驗證 token 並取得使用者資料
const token = localStorage.getItem("authToken");
if (!token) {
  location.href = "index.html";
} else {
  fetch("https://key-loan-api-978908472762.asia-east1.run.app/validateToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // 顯示歡迎訊息與自動填入借用人欄位
        document.getElementById("welcome").innerText = `Hi, ${data.user.name}`;
        document.getElementById("borrower").value = data.user.name;
      } else {
        localStorage.removeItem("authToken");
        location.href = "index.html";
      }
    })
    .catch(err => {
      console.error("Token validation error:", err);
      localStorage.removeItem("authToken");
      location.href = "index.html";
    });
}

// 登出功能
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  location.href = "index.html";
});

// 自動填入當下時間 (格式符合 datetime-local) 並鎖定
function getCurrentDatetimeLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}
document.getElementById("borrowTime").value = getCurrentDatetimeLocal();

// 借用申請功能
document.getElementById("submitBorrow").addEventListener("click", async () => {
  const borrower = document.getElementById("borrower").value.trim();
  const carNumber = document.getElementById("carNumber").value;
  // 由系統自動取得當下時間，不接受使用者輸入修改
  const borrowTime = getCurrentDatetimeLocal();
  const borrowMsg = document.getElementById("borrowMsg");

  if (!borrower || !carNumber || !borrowTime) {
    borrowMsg.innerText = "請完整填寫必填欄位";
    return;
  }

  // 依據 BORROW 工作表欄位順序：
  // 借用人, 車號, 借用時間, 詳細資料, 異常, 車頭, 尾車, 檢查日期, 檢查人員, 完成率, 執行區間, 執行開始時間, 執行結束時間
  // 這裡不需要詳細資料，將該欄填空，其餘欄位也以空字串填入
  const borrowData = {
    borrower,
    carNumber,
    borrowTime,
    // detail 不需要
    approvalStatus: "待審核",    // 初始狀態，待管理員核准
    inspectionStatus: "未檢查"  // 初始巡檢狀態
  };

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(borrowData)
    });
    const data = await res.json();
    if (data.success) {
      borrowMsg.style.color = "green";
      borrowMsg.innerText = "借用申請送出成功！";
    } else {
      borrowMsg.style.color = "red";
      borrowMsg.innerText = "申請送出失敗，請再試一次。";
    }
  } catch (error) {
    console.error(error);
    borrowMsg.style.color = "red";
    borrowMsg.innerText = "發生錯誤，請稍後再試。";
  }
});
