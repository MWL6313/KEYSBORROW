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

// === 載入車號選單
function loadCarNumbers(defaultCar) {
  fetch("https://key-loan-api-978908472762.asia-east1.run.app/carno")
    .then(res => res.json())
    .then(carData => {
      if (carData.success) {
        const input = document.getElementById("carNumber");
        if (defaultCar) {
          input.value = defaultCar;
        }

        new Awesomplete(input, {
          list: carData.data,
          minChars: 0, // ✅ 設定為 0 → 點一下就能顯示
          autoFirst: true
        });

        // ✅ 點一下就展開選單
        input.addEventListener("focus", function () {
          input.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 40 })); // 模擬方向鍵 ↓
        });

      } else {
        console.error("Failed to load car numbers");
      }
    })
    .catch(err => console.error("Error fetching car numbers:", err));
}


// function loadCarNumbers(defaultCar) {
//   fetch("https://key-loan-api-978908472762.asia-east1.run.app/carno")
//     .then(res => res.json())
//     .then(carData => {
//       if (carData.success) {
//         const datalist = document.getElementById("carList");
//         const input = document.getElementById("carNumber");

//         datalist.innerHTML = ""; // 清空舊資料

//         // 先填入 defaultCar 為預設值
//         if (defaultCar) {
//           input.value = defaultCar;
//         }

//         // 將所有車號加入 datalist（避免重複）
//         const uniqueSet = new Set();
//         if (defaultCar) uniqueSet.add(defaultCar);

//         carData.data.forEach(car => {
//           if (!uniqueSet.has(car)) {
//             uniqueSet.add(car);
//             const opt = document.createElement("option");
//             opt.value = car;
//             datalist.appendChild(opt);
//           }
//         });
//       } else {
//         console.error("Failed to load car numbers");
//       }
//     })
//     .catch(err => console.error("Error fetching car numbers:", err));
// }


// === 送出借用申請
// === 送出借用申請
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

  const borrowData = {
    borrower,
    carNumber
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

      // ✅ 禁用按鈕 10 秒 + 顯示倒數
      submitBtn.disabled = true;
      let countdown = 10;
      const originalText = submitBtn.innerText;
      submitBtn.innerText = `借用申請送出成功，請稍候 ${countdown} 秒`;

      const timer = setInterval(() => {
        countdown--;
        submitBtn.innerText = `借用申請送出成功，請稍候 ${countdown} 秒`;
        if (countdown <= 0) {
          clearInterval(timer);
          submitBtn.disabled = false;
          submitBtn.innerText = originalText;
          borrowMsg.innerText = ""; // 清除提示
        }
      }, 1000);

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

