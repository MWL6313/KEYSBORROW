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

  loginBtn.disabled = true;
  loading.style.display = "block";

  try {
    if (frontendUsers[account]) {
      if (frontendUsers[account] === password) {
        // 前端驗證成功
        localStorage.setItem("authToken", "frontend");  // 或其他識別用字串
        localStorage.setItem("account", account);

        document.body.classList.add("fade-out");
        setTimeout(() => {
          location.href = "dashboard.html";
        }, 500);
      } else {
        msg.innerText = "密碼錯誤";
        msg.classList.add("shake");
      }
    } else {
      // 非白名單帳號 → 呼叫後端驗證
      const res = await fetch("https://key-loan-api-978908472762.asia-east1.run.app/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("account", account);

        document.body.classList.add("fade-out");
        setTimeout(() => {
          location.href = "dashboard.html";
        }, 500);
      } else {
        msg.innerText = "登入失敗，請檢查帳密";
        msg.classList.add("shake");
      }
    }
  } catch (err) {
    console.error(err);
    msg.innerText = "發生錯誤，請稍後再試。";
    msg.classList.add("shake");
  } finally {
    loading.style.display = "none";
    loginBtn.disabled = false;
  }
});
