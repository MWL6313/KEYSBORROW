const loginBtn = document.getElementById("loginBtn");
const msg = document.getElementById("msg");
const loading = document.getElementById("loading");

// ✅ 頁面載入時清空欄位
window.addEventListener("load", () => {
  document.getElementById("account").value = "";
  document.getElementById("password").value = "";
  if (window.ts) {
    window.ts.clear(); // 若已初始化過 ts
  }
});

// ✅ 建立帳號選單資料：dic 來自 auth.js
const accountOptions = Object.keys(dic).map(acc => ({
  value: acc,
  // text: `${acc} (提示: ${dic[acc]})`
  text: `${acc} (${dic[acc]})`
}));

// ✅ 初始化 TomSelect，並保留實例到 window.ts
const ts = new TomSelect("#account", {
  options: accountOptions,
  maxOptions: 300,
  maxItems: 1,
  searchField: ["value", "text"],
  placeholder: "選擇帳號",
  // create: (input, callback) => {
  //   callback({ value: input, text: input });
  // },
  create: (input, callback) => {
    if (!whitelist.includes(input)) {
      // 顯示確認彈窗（你可換成 SweetAlert）
      if (confirm(`⚠ 帳號 "${input}" 不在預設清單中，是否要新增？`)) {
        callback({ value: input, text: input });
      } else {
        callback(null); // 取消新增
      }
    } else {
      callback({ value: input, text: input });
    }
  },

  
  persist: false,
  onItemAdd: () => {
    document.getElementById("password").focus(); // 選擇後跳至密碼
  }
});
window.ts = ts; // 可供其他地方呼叫 clear()

// ✅ 登入流程
loginBtn.addEventListener("click", async () => {
  const account = document.getElementById("account").value.trim();
  const password = document.getElementById("password").value;

  msg.innerText = "";
  msg.classList.remove("shake");

  if (!account || !password) {
    msg.innerText = "請輸入帳號與密碼";
    msg.classList.add("shake");
    return;
  }

  loading.style.display = "block";
  loginBtn.disabled = true;

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("authToken", data.token);
      document.body.classList.add("fade-out");
      setTimeout(() => {
        location.href = "dashboard.html";
      }, 500);
    } else {
      msg.innerText = "登入失敗，請檢查帳密";
      msg.classList.add("shake");
    }
  } catch (error) {
    console.error(error);
    msg.innerText = "發生錯誤，請稍後再試。";
    msg.classList.add("shake");
  } finally {
    loading.style.display = "none";
    loginBtn.disabled = false;
  }
});


// window.addEventListener("load", () => {
//   document.getElementById("account").value = "";
//   document.getElementById("password").value = "";
// });


// // 若使用 module 載入，否則全域 TomSelect 可直接使用

// const loginBtn = document.getElementById("loginBtn");
// const msg = document.getElementById("msg");
// const loading = document.getElementById("loading");

// loginBtn.addEventListener("click", async () => {
//   const account = document.getElementById("account").value.trim();
//   const password = document.getElementById("password").value;

//   msg.innerText = "";
//   msg.classList.remove("shake");

//   if (!account || !password) {
//     msg.innerText = "請輸入帳號與密碼";
//     msg.classList.add("shake");
//     return;
//   }

//   loading.style.display = "block";         // 顯示載入動畫
//   loginBtn.disabled = true;                // 防止重複點擊

//   try {
//     const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/login", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ account, password }),
//     });
//     const data = await res.json();

//     if (data.success) {
//       localStorage.setItem("authToken", data.token);

//       // 成功動畫後再導向
//       document.body.classList.add("fade-out");
//       setTimeout(() => {
//         location.href = "dashboard.html";
//       }, 500); // 等動畫跑完
//     } else {
//       msg.innerText = "登入失敗，請檢查帳密";
//       msg.classList.add("shake");
//     }
//   } catch (error) {
//     console.error(error);
//     msg.innerText = "發生錯誤，請稍後再試。";
//     msg.classList.add("shake");
//   } finally {
//     loading.style.display = "none";
//     loginBtn.disabled = false;
//   }
// });

// // 準備選項資料：dic 為 auth.js 中定義的全域變數
// // 準備選項資料：dic 為 auth.js 中定義的全域變數
// const accountOptions = Object.keys(dic).map(acc => ({
//   value: acc,
//   text: `${acc} (提示: ${dic[acc]})`
// }));

// // 初始化 Tom Select，讓使用者可關鍵字搜尋並選擇帳號（帳號為 dic 的 key）
// new TomSelect("#account", {
//   options: accountOptions, // 固定清單資料，格式 { value, text }
//   maxOptions: 300,
//   maxItem: 1, //只允許單選
//   searchField: ["value", "text"],
//   placeholder: "請輸入或選擇帳號",
//   create: function(input, callback) {
//     // 當輸入的帳號不在預設選項中時，建立一個新的選項
//     callback({ value: input, text: input });
//   },
//   // 如果不希望新建立的選項被永久存留在清單中，可設定 persist: false
//   persist: false, // 若希望新選項存留，設 true；若希望只用於當次，設 false
//    // 當新增選項時，若已存在超過一個項目，清除前面的只保留最新
//   onItemAdd: function(value, item) {
//     if (this.items.length > 1) {
//       const last = this.items[this.items.length - 1];
//       this.clear(true); // 清除所有已選項目，但保留 options 不變
//       this.addItem(last);
//     }
//   // 當選擇後自動將焦點移到密碼欄
//   document.getElementById("password").focus();
//   }
// });
