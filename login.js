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

  // ✅ 檢查是否為白名單帳號（local 端 dic 中）
  if (dic[account]) {
    const expectedPassword = dic[account][0];
    if (password === expectedPassword) {
      const localToken = `local-${account}`;
      localStorage.setItem("authToken", localToken);
      document.body.classList.add("fade-out");
      setTimeout(() => {
        location.href = "dashboard.html";
      }, 500);
      return; // ✅ 白名單帳號登入完成，不執行後續
    } else {
      msg.innerText = "密碼錯誤";
      msg.classList.add("shake");
      return;
    }
  }

  // ✅ 非白名單帳號 → 呼叫後端驗證
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
