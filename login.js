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
  //   const whitelist = Object.keys(dic); // ✅ 使用 dic 當白名單
  
  //   if (!whitelist.includes(input)) {
  //     Swal.fire({
  //       icon: "warning",
  //       title: "⚠ 非預設帳號",
  //       html: `帳號 <strong>${input}</strong> 不在預設清單中，你可能操作錯誤，應使用已建檔帳號。<br><br>是否仍要新增？`,
  //       showCancelButton: true,
  //       confirmButtonText: "✅ 確定新增",
  //       cancelButtonText: "❌ 取消",
  //       reverseButtons: true,
  //     }).then(result => {
  //       if (result.isConfirmed) {
  //         callback({ value: input, text: input });
  //       } else {
  //         callback(null); // 取消新增
  //       }
  //     });
  //   } else {
  //     callback({ value: input, text: `${input} (新增)` }); // ✅ 預設帳號仍可新增
  //   }
  // },

  
  // persist: false,
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
