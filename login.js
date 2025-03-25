// login.js
const loginBtn = document.getElementById("loginBtn");
const msg = document.getElementById("msg");

loginBtn.addEventListener("click", async () => {
  const account = document.getElementById("account").value.trim();
  const password = document.getElementById("password").value;

  if (!account || !password) {
    msg.innerText = "請輸入帳號與密碼";
    return;
  }

  try {
    const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem("authToken", data.token);
      // 登入成功後導向 dashboard 頁面
      location.href = "dashboard.html";
    } else {
      msg.innerText = "登入失敗，請檢查帳密";
    }
  } catch (error) {
    console.error(error);
    msg.innerText = "發生錯誤，請稍後再試。";
  }
});

