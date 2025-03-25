const submitBtn = document.getElementById("submitBorrow");
const borrowMsg = document.getElementById("borrowMsg");

submitBtn.addEventListener("click", async () => {
  // 取得表單欄位資料
  const borrower = document.getElementById("borrower").value.trim();
  const carNumber = document.getElementById("carNumber").value;
  const borrowTime = document.getElementById("borrowTime").value; // ISO 格式
  const detail = document.getElementById("detail").value.trim();

  if (!borrower || !carNumber || !borrowTime) {
    borrowMsg.innerText = "請完整填寫必填欄位";
    return;
  }

  // 準備借用資料，預設審核狀態與巡檢狀態皆為初始狀態
  const borrowData = {
    borrower,
    carNumber,
    borrowTime,
    detail,
    approvalStatus: "待審核",  // 後台管理員更新後改成「可取鑰匙」等狀態
    inspectionStatus: "未檢查"
  };

  // 呼叫後端 API
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
