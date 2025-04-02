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
  text: `${acc} (${dic[acc][0]})`  // 取提示碼 3355
}));

// ✅ 初始化 TomSelect，並保留實例到 window.ts
const ts = new TomSelect("#account", {
  options: accountOptions,
  maxOptions: 300,
  maxItems: 1,
  searchField: ["value", "text"],
  placeholder: "選擇帳號",
  onItemAdd: () => {
    document.getElementById("password").focus(); // 選擇後跳至密碼
  }
});
window.ts = ts;

// ✅ 雙軌制登入流程
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

  // ✅ 若在 dic 白名單中 → 不需 POST，直接比對密碼
  if (dic[account]) {
    const expectedPwd = dic[account][0];
    if (password === expectedPwd) {
      const token = `local-${account}`;
      localStorage.setItem("authToken", token);
      document.body.classList.add("fade-out");
      setTimeout(() => {
        location.href = "dashboard.html";
      }, 500);
      return; // ✅ 結束流程，不再送出後端
    } else {
      msg.innerText = "密碼錯誤";
      msg.classList.add("shake");
      return;
    }
  }

  // ✅ 不在 dic → 呼叫後端登入
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
