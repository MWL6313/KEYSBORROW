// dashboard.js

let currentUser = null;
const token = localStorage.getItem("authToken");

// 驗證 Token
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
        document.getElementById("welcome").innerText = `Hi, ${data.user.name}`;
        document.getElementById("borrower").value = data.user.name;

        // 顯示目前時間（畫面用途）
        document.getElementById("borrowTimeDisplay").value = new Date().toLocaleString();

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

// 登出按鈕
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  location.href = "index.html";
});

// === 工具：取得當下時間（送給後端）
function getCurrentDatetimeLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

// === 載入車號選單，排除已借用中的車號
async function loadCarNumbers(defaultCar) {
  try {
    const [carRes, unreturnedRes] = await Promise.all([
      fetch("https://key-loan-api-978908472762.asia-east1.run.app/carno"),
      fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/unreturned")
    ]);

    const carData = await carRes.json();
    const unreturnedData = await unreturnedRes.json();

    if (carData.success && unreturnedData.success) {
      const select = document.getElementById("carNumber");
      select.innerHTML = "";

      const allCars = new Set(carData.data);
      const borrowedCars = new Set(unreturnedData.data);

      const availableCars = [...allCars].filter(car => !borrowedCars.has(car));

      // ✅ 若有 defaultCar（登入者常用），優先放最前
      if (defaultCar && allCars.has(defaultCar)) {
        availableCars.unshift(defaultCar);
      }

      availableCars.forEach(car => {
        const opt = document.createElement("option");
        opt.value = car;
        opt.textContent = car;
        select.appendChild(opt);
      });

      // ✅ 初始化 Tom Select
      if (select.tomselect) select.tomselect.destroy();
      new TomSelect("#carNumber", {
        create: false,
        sortField: { field: "text", direction: "asc" },
        placeholder: "請輸入或選擇車號",
      });

      if (defaultCar) {
        select.tomselect.setValue(defaultCar);
      }
    }

  } catch (err) {
    console.error("🚨 載入車號清單失敗：", err);
  }
}


// === 借用申請送出邏輯（含防止已借用車號）
document.getElementById("submitBorrow").addEventListener("click", async () => {
  const borrower = document.getElementById("borrower").value.trim();
  const carNumber = document.getElementById("carNumber").value;
  const borrowMsg = document.getElementById("borrowMsg");
  const submitBtn = document.getElementById("submitBorrow");

  if (!borrower || !carNumber) {
    borrowMsg.innerText = "請完整填寫必填欄位";
    borrowMsg.style.color = "red";
    return;
  }

  // 🔍 檢查是否已借用該車
  try {
    const resCheck = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/withInspection");
    const checkData = await resCheck.json();
    const borrowedList = checkData.records || [];

    const alreadyBorrowed = borrowedList.some(r => r.車號 === carNumber && !r.歸還時間);

    if (alreadyBorrowed) {
      await Swal.fire({
        icon: "warning",
        title: "🚫 車輛仍在借用中",
        text: `【${carNumber}】尚未歸還，請選擇其他車輛。`,
        confirmButtonText: "我知道了"
      });

      const carSelect = document.querySelector("#carNumber");
      if (carSelect.tomselect) {
        carSelect.tomselect.clear();  // 清空選擇
        carSelect.tomselect.focus();  // 聚焦回選單
      } else {
        carSelect.value = "";
        carSelect.focus();
      }
      return;
    }
  } catch (err) {
    console.error("檢查已借用車輛錯誤", err);
    return Swal.fire("錯誤", "查詢目前借用狀況失敗，請稍後再試", "error");
  }

  // 🚀 繼續送出借用申請
  const borrowData = { borrower, carNumber };

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(borrowData)
    });

    const data = await res.json();
    if (data.success) {
      await Swal.fire({
        icon: "success",
        title: "✅ 借用申請成功！",
        text: `【${carNumber}】借用成功，請盡速完成巡檢`,
        timer: 3000,
        showConfirmButton: false
      });

      // 🚫 鎖定按鈕與倒數提示
      submitBtn.disabled = true;
      let countdown = 20;
      const originalText = submitBtn.innerText;
      submitBtn.innerText = `請稍候 ${countdown} 秒...`;
      submitBtn.classList.add("success-pulse");

      const timer = setInterval(() => {
        countdown--;
        submitBtn.innerText = `請稍候 ${countdown} 秒...`;
        if (countdown <= 0) {
          clearInterval(timer);
          submitBtn.disabled = false;
          submitBtn.innerText = originalText;
          submitBtn.classList.remove("success-pulse");
        }
      }, 1000);

      // ✅ 自動重新載入車號（剔除剛借走的車）
      loadCarNumbers();
    } else {
      throw new Error(data.message || "未知錯誤");
    }

  } catch (error) {
    console.error("借用失敗", error);
    Swal.fire("錯誤", "借用申請送出失敗，請稍後再試", "error");
  }
});
