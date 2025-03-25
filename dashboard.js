// dashboard.js

// 驗證 token 並取得使用者資料
let currentUser = null; // 全域存取使用者資料
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
        currentUser = data.user;
        // 顯示歡迎訊息與自動填入借用人欄位
        document.getElementById("welcome").innerText = `Hi, ${data.user.name}`;
        document.getElementById("borrower").value = data.user.name;
        // 載入車號下拉選單
        loadCarNumbers(data.user.carNo);
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

// 取得 CARNO 工作表的車號，並填入下拉選單
function loadCarNumbers(defaultCar) {
  fetch("https://key-loan-api-978908472762.asia-east1.run.app/carno")
    .then(res => res.json())
    .then(carData => {
      if (carData.success) {
        const select = document.getElementById("carNumber");
        select.innerHTML = ""; // 清空原有選項
        // 若使用者預設的車號存在，先加入該選項並預設選取
        if (defaultCar) {
          const opt = document.createElement("option");
          opt.value = defaultCar;
          opt.text = defaultCar;
          select.appendChild(opt);
          select.value = defaultCar;
        }
        // 將其他車號加入，避免重覆
        carData.data.forEach(car => {
          if (car !== defaultCar) {
            const opt = document.createElement("option");
            opt.value = car;
            opt.text = car;
            select.appendChild(opt);
          }
        });
      } else {
        console.error("Failed to load car numbers");
      }
    })
    .catch(err => console.error("Error fetching car numbers:", err));
}

// 借用申請功能
document.getElementById("submitBorrow").addEventListener("click", async () => {
  const borrower = document.getElementById("borrower").value.trim();
  const carNumber = document.getElementById("carNumber").value;
  // 系統自動取得當下時間，不接受使用者修改
  const borrowTime = getCurrentDatetimeLocal();
  const borrowMsg = document.getElementById("borrowMsg");

  if (!borrower || !carNumber || !borrowTime) {
    borrowMsg.innerText = "請完整填寫必填欄位";
    return;
  }

  // 只傳送需要的欄位
  const borrowData = {
    borrower,
    carNumber,
    borrowTime
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

