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
    .then(async data => {
      if (data.success) {
        currentUser = data.user;
        document.getElementById("welcome").innerText = `Hi, ${data.user.name}`;
        document.getElementById("borrower").value = data.user.name;
    
        // 顯示目前時間
        document.getElementById("borrowTimeDisplay").value = new Date().toLocaleString();
    
        await loadCarNumbers(data.user.carNo);
        await loadPhoneItems();
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
    if (select.tomselect) {
      select.tomselect.destroy();
    }
            
    select.innerHTML = "";
    
    // ➕ 插入「不借用」選項
    const noneOption = document.createElement("option");
    noneOption.value = "none";
    noneOption.textContent = "🚫 不借用車輛";
    select.appendChild(noneOption);



      const allCars = new Set(carData.data);
      const borrowedCars = new Set(unreturnedData.data);

      let availableCars = [...allCars].filter(car =>
        !borrowedCars.has(car) && car !== defaultCar
      );

      // 預設車號優先放前面（即使已借出）
      if (defaultCar && allCars.has(defaultCar)) {
        availableCars.unshift(defaultCar);
      }

      availableCars.forEach(car => {
        const opt = document.createElement("option");
        opt.value = car;

        const isBorrowed = borrowedCars.has(car);
        const isDefault = car === defaultCar;

        // ✅ 顯示借出標示、並 disabled（除非是 defaultCar）
        if (isBorrowed) {
          opt.textContent = `${car} ⚠ 已借出`;
          if (!isDefault) opt.disabled = true;
        } else {
          opt.textContent = car;
        }

        select.appendChild(opt);
      });

      // ✅ 初始化 Tom Select（如已存在先 destroy 再初始化）
      if (select.tomselect) {
        select.tomselect.destroy();
      }

      new TomSelect("#carNumber", {
        create: false,
        sortField: {
          field: "text",
          direction: "asc"
        },
        placeholder: "請輸入或選擇車號",
      });

      if (defaultCar) {
        select.tomselect.setValue(defaultCar);
      }
    }
  } catch (err) {
    console.error("🚨 載入車號錯誤", err);
  }
}

async function loadPhoneItems() {
  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/phone/items");
    const data = await res.json();

    if (data.success && Array.isArray(data.items)) {
      const select = document.getElementById("phoneItem");

      select.innerHTML = "";
      
      // ➕ 插入「不借用」選項
      const noneOption = document.createElement("option");
      noneOption.value = "none";
      noneOption.textContent = "📵 不借用手機";
      select.appendChild(noneOption);


      // 塞入新選項
      data.items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item;
        opt.textContent = item;
        select.appendChild(opt);
      });

      // 如果已有 tomselect 實例，先銷毀
      if (select.tomselect) {
        select.tomselect.destroy();
      }

      // 初始化 Tom Select（等資料都塞完再做！）
      new TomSelect("#phoneItem", {
        create: false,
        sortField: {
          field: "text",
          direction: "asc"
        },
        placeholder: "請選擇手機"
      });
    } else {
      console.warn("📭 無手機資料", data);
    }
  } catch (err) {
    console.error("載入手機項目錯誤", err);
  }
}










// === 送出借用申請（防重複）===
document.getElementById("submitBorrow").addEventListener("click", async () => {
  const borrower = document.getElementById("borrower").value.trim();
  const carNumber = document.getElementById("carNumber").value.trim();
  const phoneItem = document.getElementById("phoneItem").value.trim();

  const isCarBorrowed = carNumber && carNumber !== "none";
  const isPhoneBorrowed = phoneItem && phoneItem !== "none";

  if (!borrower || (!isCarBorrowed && !isPhoneBorrowed)) {
    Swal.fire({
      icon: "warning",
      title: "請選擇至少一個借用項目",
      text: "車號與手機至少選擇一項",
    });
    return;
  }

  const borrowMsg = document.getElementById("borrowMsg");
  const submitBtn = document.getElementById("submitBorrow");
  borrowMsg.innerText = "";

  submitBtn.disabled = true;
  submitBtn.innerText = "處理中...";

  try {
    const promises = [];

    // ✅ 先檢查車是否被借出
    if (isCarBorrowed) {
      const resCheck = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow/unreturned");
      const checkData = await resCheck.json();
      const borrowedCars = new Set(checkData.data);

      if (borrowedCars.has(carNumber)) {
        Swal.fire({
          icon: "warning",
          title: "🚗 車輛仍在借用中",
          text: `【${carNumber}】尚未歸還，請選擇其他車輛。`,
        });
        submitBtn.disabled = false;
        submitBtn.innerText = "送出申請";
        return;
      }

      promises.push(
        fetch("https://key-loan-api-978908472762.asia-east1.run.app/borrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ borrower, carNumber })
        })
      );
    }

    // ✅ 檢查手機是否已借出
    if (isPhoneBorrowed) {
      const resCheckPhone = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/phone/unreturned");
      const checkDataPhone = await resCheckPhone.json();
      const borrowedPhones = new Set(checkDataPhone.data);

      if (borrowedPhones.has(phoneItem)) {
        Swal.fire({
          icon: "warning",
          title: "📱 手機仍在借用中",
          text: `【${phoneItem}】尚未歸還，請選擇其他手機。`,
        });
        submitBtn.disabled = false;
        submitBtn.innerText = "送出申請";
        return;
      }

      promises.push(
        fetch("https://key-loan-api-978908472762.asia-east1.run.app/phone/borrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 借出者: borrower, 物品: phoneItem })
        })
      );
    }

    // 發送申請
    const results = await Promise.all(promises);
    const success = results.every(res => res.ok);

    if (success) {
      const successList = [
        `🚗 車號：${isCarBorrowed ? carNumber : "未借用"}`,
        `📱 手機：${isPhoneBorrowed ? phoneItem : "未借用"}`
      // ];

      // borrowMsg.style.color = "green";
      // borrowMsg.innerHTML = `
      //   ✅ 借用申請成功！<br>
      //   <b>${successList.join("<br>")}</b>
      // `;

      ].filter(Boolean).join("、");
    
      showToast(`借用成功：${successList}`);
        
      document.getElementById("carNumber").tomselect?.clear();
      document.getElementById("phoneItem").tomselect?.clear();

      await loadCarNumbers(currentUser?.carNo || "");
      await loadPhoneItems();

      let countdown = 20;
      submitBtn.innerText = `請稍候 ${countdown} 秒`;
      const timer = setInterval(() => {
        countdown--;
        submitBtn.innerText = `請稍候 ${countdown} 秒`;
        if (countdown <= 0) {
          clearInterval(timer);
          submitBtn.disabled = false;
          submitBtn.innerText = "送出申請";
          borrowMsg.innerText = "";
        }
      }, 1000);
    } else {
      borrowMsg.innerText = "❌ 借用失敗，請稍後再試。";
      borrowMsg.style.color = "red";
      submitBtn.disabled = false;
      submitBtn.innerText = "送出申請";
    }
  } catch (err) {
    console.error("送出失敗", err);
    borrowMsg.innerText = "⚠️ 系統錯誤，請稍後再試。";
    borrowMsg.style.color = "red";
    submitBtn.disabled = false;
    submitBtn.innerText = "送出申請";
  }
});

function showToast(message, icon = "✅") {
  const toast = document.createElement("div");
  toast.className = "custom-toast";
  toast.innerHTML = `<span style="font-size:1.2rem">${icon}</span> ${message}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => toast.remove(), 800);
  }, 2500);
}

