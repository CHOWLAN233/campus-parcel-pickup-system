/*
 * 登录与注册页面交互层：读取输入 → 校验 → 调用接口 → 显示结果。
 * 不把密码、用户或登录状态写进 localStorage/sessionStorage。
 */
(() => {
  // 1. 找到 HTML 里带对应 id 的元素。
  // 注册页通过 data-mode 区分；两页共用字段 id，避免复制交互逻辑。
  const form = document.querySelector("#login-form, #register-form");
  const isRegister = form.dataset.mode === "register";
  const studentIdInput = document.querySelector("#student-id");
  const passwordInput = document.querySelector("#password");
  const confirmPasswordInput = document.querySelector("#confirm-password");
  const toggleButton = document.querySelector("#toggle-password");
  const submitButton = document.querySelector("#login-button");
  const buttonLabel = document.querySelector("#login-button-label");
  const message = document.querySelector("#form-message");
  const successLink = document.querySelector("#registration-success-link");
  const fields = [studentIdInput, passwordInput, confirmPasswordInput].filter(Boolean);
  let isSubmitting = false;

  // 将接口错误码映射为英文提示，避免直接展示后端内部错误。
  const errorMessages = {
    INVALID_CREDENTIALS: "Incorrect student ID or password. Please try again.",
    INVALID_INPUT: "Check your student ID and password and try again.",
    NETWORK_ERROR: "Cannot connect to the sign-in service. Check your connection or try again later.",
    REQUEST_TIMEOUT: "Sign-in request timed out. Please try again later.",
    SERVICE_UNAVAILABLE: "The sign-in service is temporarily unavailable. Please try again later.",
    INVALID_RESPONSE: "Unexpected response from the sign-in service. Please try again later.",
    TOO_MANY_REQUESTS: "Too many requests. Please try again later.",
  };
  // 注册提示单独定义，页面保持英文；后端负责确认学号是否在白名单内。
  if (isRegister) {
    Object.assign(errorMessages, {
      ALREADY_REGISTERED: "This student ID is already registered. Sign in to your account.",
      INVALID_INPUT: "Registration was rejected. Check that you are using a test student ID assigned by your team.",
      NETWORK_ERROR: "Cannot connect to the registration service. Check your connection or try again later.",
      REQUEST_TIMEOUT: "Registration request timed out. Please try again later.",
      SERVICE_UNAVAILABLE: "The registration service is temporarily unavailable. Please try again later.",
      INVALID_RESPONSE: "Unexpected response from the registration service. Please try again later.",
    });
  }

  // 输入框与提示元素通过“输入框 id + -error”关联；空文字表示清除错误。
  function setFieldError(input, text) {
    const errorElement = document.querySelector(`#${input.id}-error`);
    errorElement.textContent = text;
    errorElement.hidden = !text;
    input.setAttribute("aria-invalid", String(Boolean(text)));
  }

  // data-type 决定提示配色；主动聚焦让键盘用户也能及时读到结果。
  function showMessage(text, type = "info") {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
    message.focus();
  }

  // 仅识别固定原因，不直接显示 URL 中的文字，也不接受任意跳转地址。
  if (!isRegister) {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "session-expired") showMessage("Your session has expired. Please sign in again.");
    if (reason === "signed-out") showMessage("You have been signed out successfully.");
  }

  // 请求期间禁用输入和按钮，配合 isSubmitting 防止重复提交。
  function setLoading(loading) {
    isSubmitting = loading;
    submitButton.disabled = loading;
    fields.forEach((input) => { input.disabled = loading; });
    toggleButton.disabled = loading;
    form.setAttribute("aria-busy", String(loading));
    buttonLabel.textContent = isRegister
      ? (loading ? "Creating account..." : "Create account")
      : (loading ? "Signing in..." : "Sign in");
  }

  // 2. 监听“显示密码”按钮。type="button" 保证它不会提交表单。
  toggleButton.addEventListener("click", () => {
    const willShow = passwordInput.type === "password";
    passwordInput.type = willShow ? "text" : "password";
    if (confirmPasswordInput) confirmPasswordInput.type = passwordInput.type;
    toggleButton.textContent = willShow ? "Hide" : "Show";
    toggleButton.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
    toggleButton.setAttribute("aria-pressed", String(willShow));
  });

  // 用户重新输入时清除旧提示，下一次提交再检查最新内容。
  fields.forEach((input) => {
    input.addEventListener("input", () => {
      setFieldError(input, "");
      // 修改原密码后，旧的“不一致”提示也需要清除，提交时重新判断。
      if (input === passwordInput && confirmPasswordInput) setFieldError(confirmPasswordInput, "");
      message.hidden = true;
      if (successLink) successLink.hidden = true;
    });
  });

  // 3. 监听提交事件。按 Enter 和点击“登录”会走同一套逻辑。
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // 防止浏览器默认提交让页面刷新。
    if (isSubmitting) return;
    message.hidden = true;
    if (successLink) successLink.hidden = true;

    const studentId = studentIdInput.value.trim();
    // 密码按原样发送，注册页按当前后端规则校验格式。
    const password = passwordInput.value;
    let studentIdError = studentId ? "" : "Enter your test student ID.";
    let passwordError = password ? "" : "Enter your password.";
    if (isRegister) {
      if (studentId && !/^STU\d{4}$/.test(studentId)) {
        studentIdError = "Enter uppercase STU followed by four digits, such as STU0001.";
      }
      if (password) {
        if (password.length < 8 || password.length > 128) {
          passwordError = "Use 8–128 characters.";
        } else if (!/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
          passwordError = "Include at least one digit and one symbol, such as !.";
        }
      }
    }
    setFieldError(studentIdInput, studentIdError);
    setFieldError(passwordInput, passwordError);
    let confirmError = "";
    if (isRegister) {
      confirmError = !confirmPasswordInput.value
        ? "Confirm your password."
        : (password !== confirmPasswordInput.value ? "Passwords do not match." : "");
      setFieldError(confirmPasswordInput, confirmError);
    }

    if (studentIdError || passwordError || confirmError) {
      // 优先把焦点移到第一个有错误的字段。
      (studentIdError ? studentIdInput : passwordError ? passwordInput : confirmPasswordInput).focus();
      return;
    }

    // 双击 HTML 能学习界面和交互；真实 Cookie 登录需要 HTTP 服务。
    if (window.location.protocol === "file:") {
      showMessage(isRegister
        ? "Form validation passed. This is a local file preview; connect the registration service to create an account."
        : "Form validation passed. This is a local file preview; connect the sign-in service to sign in.");
      return;
    }

    setLoading(true);
    try {
      const user = isRegister
        ? await window.ParcelApi.register(studentId, password)
        : await window.ParcelApi.login(studentId, password);
      form.reset();
      passwordInput.type = "password";
      if (confirmPasswordInput) confirmPasswordInput.type = "password";
      toggleButton.textContent = "Show";
      toggleButton.setAttribute("aria-label", "Show password");
      toggleButton.setAttribute("aria-pressed", "false");
      // 注册成功不等于已登录；只在服务端确认创建后展示登录入口。
      if (isRegister) {
        showMessage("Account created successfully. Sign in to continue.", "success");
        successLink.hidden = false;
      } else {
        // 后端确认登录成功后才进入首页，由首页再次检查 Session Cookie。
        showMessage(`Signed in successfully. Welcome, ${user.studentId}.`, "success");
        window.location.assign("dashboard.html");
      }
    } catch (error) {
      showMessage(errorMessages[error.code] || (isRegister
        ? "Unable to create an account right now. Please try again later."
        : "Unable to sign in right now. Please try again later."), "error");
    } finally {
      // 无论登录成功还是请求失败，都恢复表单的可操作状态。
      setLoading(false);
    }
  });
})();
