const loginBtn = document.getElementById("loginBtn");
const msg = document.getElementById("msg");
const loading = document.getElementById("loading");

// ✅ 前端帳號密碼白名單（不具 admin 或 manager 權限）
const localAccounts = {
  "王小明": "1234",
  "張大偉": "abcd",
  "陳玉芬": "5678"
};

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
    // ✅ 若帳號在白名單中，就直接登入（不呼叫後端）
    if (localAccounts[account] && localAccounts[account] === password) {
      localStorage.setItem("authToken", `local-${account}`);
      document.body.classList.add("fade-out");
      setTimeout(() => {
        location.href = "dashboard.html";
      }, 500);
      return;
    }

    // 否則呼叫後端 API 驗證（admin / manager 走這邊）
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

