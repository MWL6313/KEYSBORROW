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
