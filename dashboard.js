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

// === 載入車號選單（排除已借用）===
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

      let availableCars = [...allCars].filter(car => !borrowedCars.has(car));

      // ✅ 若 defaultCar 未被借出，優先放第一筆
      if (defaultCar && allCars.has(defaultCar) && !borrowedCars.has(defaultCar)) {
        availableCars = availableCars.filter(c => c !== defaultCar);
        availableCars.unshift(defaultCar);
      }

      availableCars.forEach(car => {
        const opt = document.createElement("option");
        opt.value = car;
        opt.textContent = car;
        select.appendChild(opt);
      });

      new TomSelect("#carNumber", {
        create: false,
        sortField: {
          field: "text",
          direction: "asc"
        },
        placeholder: "請輸入或選擇車號",
      });

      if (defaultCar && !borrowedCars.has(defaultCar)) {
        select.value = defaultCar;
      }
    }
  } catch (err) {
    console.error("🚨 載入車號錯誤", err);
  }
}



// === 送出借用申請（防重複）===
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

  // 再次確認是否已借用
  try {
    const resCheck = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/unreturned");
    const checkData = await resCheck.json();
    const borrowedCars = new Set(checkData.data);

    if (borrowedCars.has(carNumber)) {
      Swal.fire({
        icon: "warning",
        title: "🚫 車輛仍在借用中",
        text: `【${carNumber}】尚未歸還，請選擇其他車輛。`,
        confirmButtonText: "我知道了"
      }).then(() => {
        const carSelect = document.querySelector("#carNumber");
        if (carSelect.tomselect) {
          carSelect.tomselect.clear();
          carSelect.tomselect.focus();
        } else {
          carSelect.value = "";
          carSelect.focus();
        }
      });
      return;
    }
  } catch (err) {
    console.error("檢查借用錯誤：", err);
    borrowMsg.innerText = "⚠️ 系統錯誤，請稍後再試。";
    borrowMsg.style.color = "red";
    return;
  }

  // 🚀 繼續送出申請
  const borrowData = { borrower, carNumber };

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(borrowData)
    });

    const data = await res.json();
    if (data.success) {
      borrowMsg.style.color = "green";
      borrowMsg.innerText = "✅ 借用申請送出成功！";

      submitBtn.disabled = true;
      submitBtn.classList.add("success-pulse");
      let countdown = 20;
      const originalText = submitBtn.innerText;
      submitBtn.innerText = `請稍候 ${countdown} 秒`;

      const timer = setInterval(() => {
        countdown--;
        submitBtn.innerText = `請稍候 ${countdown} 秒`;
        if (countdown <= 0) {
          clearInterval(timer);
          submitBtn.disabled = false;
          submitBtn.innerText = originalText;
          submitBtn.classList.remove("success-pulse");
          borrowMsg.innerText = "";
        }
      }, 1000);
    } else {
      borrowMsg.innerText = "❌ 申請送出失敗，請再試一次。";
      borrowMsg.style.color = "red";
    }
  } catch (err) {
    console.error("送出失敗", err);
    borrowMsg.innerText = "⚠️ 系統錯誤，請稍後再試。";
    borrowMsg.style.color = "red";
  }
});
