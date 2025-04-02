// dashboard.js（支援雙軌制登入）

let currentUser = null;
const token = localStorage.getItem("authToken");

// ✅ 判斷是否為白名單帳號登入（local- 開頭）
if (token && token.startsWith("local-")) {
  const account = token.replace("local-", "");
  const info = window.dic?.[account];
  if (info && Array.isArray(info)) {
    const [hint, carNo, name] = info;
    currentUser = { name, carNo };
    document.getElementById("welcome").innerText = `Hi, ${name}`;
    document.getElementById("borrower").value = name;
    document.getElementById("borrowTimeDisplay").value = new Date().toLocaleString();
    loadCarNumbers(carNo);
    loadPhoneItems();
  } else {
    Swal.fire("找不到帳號資料，請重新登入");
    localStorage.removeItem("authToken");
    location.href = "index.html";
  }
} else if (token) {
  // ✅ 正常後端驗證流程
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
} else {
  location.href = "index.html";
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

async function loadPhoneItems() {
  try {
    const [resItems, resUnreturned] = await Promise.all([
      fetch("https://key-loan-api-978908472762.asia-east1.run.app/phone/items"),
      fetch("https://key-loan-api-978908472762.asia-east1.run.app/phone/unreturned")
    ]);

    const dataItems = await resItems.json();
    const dataUnreturned = await resUnreturned.json();

    if (!dataItems.success || !Array.isArray(dataItems.items) || !dataUnreturned.success) {
      console.warn("❌ 手機資料取得失敗", dataItems, dataUnreturned);
      return;
    }

    const allItems = dataItems.items;
    const unreturnedSet = new Set(dataUnreturned.data);
    console.log("📱 所有手機：", allItems);
    console.log("📱 已借出手機：", [...unreturnedSet]);

    const select = document.getElementById("phoneItem");
    if (select.tomselect) {
      select.tomselect.destroy();
      delete select.tomselect;
    }

    select.innerHTML = "";

    const noneOption = document.createElement("option");
    noneOption.value = "none";
    noneOption.textContent = "📵 不借用手機";
    select.appendChild(noneOption);

    allItems.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;

      if (unreturnedSet.has(item)) {
        opt.textContent = `${item} ⚠ 已借出`;
        opt.disabled = true;
      } else {
        opt.textContent = item;
      }

      select.appendChild(opt);
    });

    new TomSelect("#phoneItem", {
      create: false,
      sortField: { field: "text", direction: "asc" },
      placeholder: "請選擇手機"
    });

  } catch (err) {
    console.error("🚨 載入手機項目錯誤", err);
  }
}


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
      delete select.tomselect;  // 加這行確保重建

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
        delete select.tomselect;  // 加這行確保重建

      }

      new TomSelect("#carNumber", {
        create: false,
        sortField: {
          field: "text",
          direction: "asc"
        },
        placeholder: "請輸入或選擇車號",
        maxOptions: null // ✅ 顯示所有選項，無上限

      });

      if (defaultCar) {
        select.tomselect.setValue(defaultCar);
      }
    }
  } catch (err) {
    console.error("🚨 載入車號錯誤", err);
  }
}

document.getElementById("refreshItemsBtn").addEventListener("click", async () => {
  showToast("正在更新可借用清單...", "🔄");
  await loadCarNumbers(currentUser?.carNo || "");
  await loadPhoneItems();
  showToast("清單已更新！");
});



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
      ];
    
      const borrowTime = new Date().toLocaleString(); // 取得目前借用時間
    
      borrowMsg.style.color = "green";
      borrowMsg.innerHTML = `
        ✅ 借用申請成功！<br>
        👤 ${borrower}<br>
        ⏰ ${borrowTime}<br>
        <b>${successList.join("<br>")}</b>
      `;
      
      showToast(`借用成功：${successList}`);
      
      document.getElementById("carNumber").tomselect?.clear();
      document.getElementById("phoneItem").tomselect?.clear();
    
      await loadCarNumbers(currentUser?.carNo || "");
      await loadPhoneItems();
    
      let countdown = 60;
      submitBtn.innerText = `請稍候 ${countdown} 秒`;
      const timer = setInterval(() => {
        countdown--;
        submitBtn.innerText = `請稍候 ${countdown} 秒`;
        if (countdown <= 0) {
          clearInterval(timer);
          submitBtn.disabled = false;
          submitBtn.innerText = "送出申請";
          // 保留 borrowMsg 訊息，不清空
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
  }, 5000);
}

// ✅ 閒置登出邏輯（60 分鐘）
let idleTimer;
const idleLimit = 60 * 60 * 1000; // 60 分鐘

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    Swal.fire({
      icon: "info",
      title: "自動登出",
      text: "您已閒置 60 分鐘，系統將自動登出。",
      timer: 60000,
      timerProgressBar: true,
      didClose: () => {
        localStorage.removeItem("authToken");
        location.href = "index.html";
      }
    });
  }, idleLimit);
}

// ✅ 監聽常見操作以重置計時器
["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer);
});

resetIdleTimer(); // 初始啟動


