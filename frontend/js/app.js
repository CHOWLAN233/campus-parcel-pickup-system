/* 学生与管理功能页共用：会话检查、导航、格式化、请求状态与确认对话框。 */
window.ExpressBook = (() => {
  const find = (id) => document.getElementById(id);
  const page = document.body.dataset.page;
  const preview = window.location.protocol === "file:";
  const config = window.ExpressBookConfig;
  const api = preview ? window.ExpressBookDemo.create(page) : window.ParcelApi;
  const labels = { BOOKED: "Booked", CANCELLED: "Cancelled", COMPLETED: "Completed", NO_SHOW: "Missed pickup", ACTIVE: "Active", RESERVED: "Reserved", USED: "Used", EXPIRED: "Expired", REVOKED: "Revoked", AVAILABLE: "Available", FULL: "Full", CLOSED: "Closed" };
  const messages = {
    NETWORK_ERROR: "Check your connection and try again.", REQUEST_TIMEOUT: "The request timed out. Please check the latest status before retrying.",
    SERVICE_UNAVAILABLE: "This service is currently unavailable. Please try again later.", INVALID_RESPONSE: "We couldn't verify the response. Refresh to check the latest status.",
    INVALID_INPUT: "Check the values you entered and try again.", INVALID_DATE: "This date is not available for booking.", FORBIDDEN: "You do not have permission to perform this action.",
    TOO_MANY_REQUESTS: "Too many requests. Please wait a moment and try again.", SLOT_FULL: "This slot no longer has enough spaces. Choose another slot.",
    BOOKING_EXISTS: "You already have an active booking. Check My pickups.", INVALID_INVITATION: "This invitation is invalid. Check the code with your friend.",
    INVITATION_EXPIRED: "This invitation has expired. Ask your friend for a new code.", INVITATION_USED: "This invitation has already been reserved or used.",
    INVITATION_EXISTS: "You already have an active invitation. Check your invitation activity before generating another.",
    PROXY_LIMIT_EXCEEDED: "You can collect for at most one friend per booking.", PROXY_LIMIT: "You can collect for at most one friend per booking.",
    CANCEL_NOT_ALLOWED: "This booking can no longer be cancelled.", NOT_FOUND: "No matching booking was found.", APPOINTMENT_NOT_FOUND: "No matching booking was found.",
    ALREADY_COMPLETED: "This pickup has already been completed.", INVALID_STATUS: "This action is not available for the current status.",
    CAPACITY_TOO_LOW: "Capacity cannot be lower than the spaces already occupied.", SLOT_EXISTS: "A slot already exists for that time.",
  };
  let user, loader, busy = false, mutating = false, pendingConfirmation;

  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = String(text);
    return result;
  }
  function badge(status) { const result = node("span", "status-badge", labels[status] || "Unknown"); result.dataset.status = status; return result; }
  function date(value, options = {}) {
    if (!value || !Number.isFinite(Date.parse(value))) return "Not provided";
    return new Intl.DateTimeFormat("en-GB", { timeZone: config.timeZone, day: "numeric", month: "short", year: "numeric", ...options }).format(new Date(value));
  }
  function time(value) { return date(value, { day: undefined, month: undefined, year: undefined, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  function isoDay(offset = 0) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: config.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type) => parts.find((item) => item.type === type).value;
    const value = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00+08:00`);
    value.setUTCDate(value.getUTCDate() + offset);
    return new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  }
  const start = (item) => item.startAt ?? item.slot?.startAt;
  const end = (item) => item.endAt ?? item.slot?.endAt;
  const reference = (item) => item.appointmentNumber || `#${item.id}`;
  const type = (item) => item.proxyCount === 1 ? "You + 1 friend" : item.proxyCount === 0 ? "Just you" : "Not provided";
  function notify(text, kind = "info") {
    const message = find("page-message"); message.textContent = text; message.dataset.type = kind; message.hidden = false; message.focus();
  }
  function state(id, text, error = false) { const target = find(id); target.textContent = text; target.hidden = !text; target.dataset.error = String(error); }
  function fieldError(id, text) { const input = find(id); input.setAttribute("aria-invalid", String(Boolean(text))); state(`${id}-error`, text, true); }
  function handleError(error) {
    if (error?.code === "UNAUTHORIZED") {
      find("page-content").hidden = true;
      find("user-id").textContent = "Signed out";
      window.location.replace("login.html?reason=session-expired");
    } else notify(messages[error?.code] || "The action could not be completed. Please try again.", "error");
  }

  // 原生 dialog 提供键盘焦点约束；取消、Esc 和确认都能结束同一次等待。
  function confirm(title, text, action = "Confirm") {
    if (pendingConfirmation) return Promise.resolve(false);
    find("confirm-title").textContent = title; find("confirm-text").textContent = text; find("confirm-action").textContent = action;
    find("confirm-dialog").showModal();
    find("confirm-cancel").focus();
    return new Promise((resolve) => { pendingConfirmation = resolve; });
  }
  find("confirm-dialog").addEventListener("close", () => {
    if (pendingConfirmation) { pendingConfirmation(find("confirm-dialog").returnValue === "confirm"); pendingConfirmation = undefined; }
    find("confirm-dialog").returnValue = "";
  });

  // 全页写操作串行执行，按钮不可双击；网络失败不自动重放创建/取消请求。
  async function mutate(button, task, loading = "Working…") {
    if (mutating || busy) return;
    mutating = true; const original = button.textContent;
    button.disabled = true; button.textContent = loading;
    find("refresh-button").disabled = true; find("logout-button").disabled = true;
    try { await task(); } catch (error) { handleError(error); }
    finally {
      mutating = false; button.disabled = false; button.textContent = original;
      find("refresh-button").disabled = false; find("logout-button").disabled = preview;
    }
  }

  async function refresh() {
    if (busy || mutating || pendingConfirmation) return;
    busy = true;
    user = undefined;
    find("user-id").textContent = "Checking session…";
    find("page-message").hidden = true;
    // 每次刷新先隐藏旧内容并验证会话，防止账号已切换但仍展示旧预约。
    find("page-content").hidden = true; find("page-gate").hidden = false;
    find("gate-title").textContent = "Getting things ready…";
    find("gate-message").textContent = "Checking your session and loading the latest information.";
    find("retry-button").hidden = true; find("gate-signin").hidden = true;
    find("page-gate").setAttribute("aria-busy", "true");
    find("refresh-button").disabled = true; find("logout-button").disabled = true;
    try {
      user = await api.getCurrentUser();
      const roles = document.body.dataset.roles?.split(",");
      if (roles && !roles.includes(user.role)) throw { code: "FORBIDDEN" };
      find("user-id").textContent = user.studentId;
      document.querySelectorAll("[data-role-link]").forEach((link) => { link.hidden = !link.dataset.roleLink.split(",").includes(user.role); });
      await loader();
      find("page-content").hidden = false; find("page-gate").hidden = true;
      if (preview) { find("preview-notice").hidden = false; find("preview-signin").hidden = false; find("logout-button").hidden = true; }
    } catch (error) {
      if (error?.code === "UNAUTHORIZED") handleError(error);
      else {
        find("gate-title").textContent = "We couldn't open this page";
        find("gate-message").textContent = messages[error?.code] || "Please try again later.";
        find("retry-button").hidden = false; find("gate-signin").hidden = false;
      }
    } finally {
      busy = false; find("refresh-button").disabled = false;
      find("logout-button").disabled = preview || !user;
      find("page-gate").setAttribute("aria-busy", "false");
    }
  }
  find("refresh-button").addEventListener("click", refresh);
  find("retry-button").addEventListener("click", refresh);
  find("logout-button").addEventListener("click", () => mutate(find("logout-button"), async () => {
    await api.logout(); find("page-content").hidden = true; window.location.replace("login.html?reason=signed-out");
  }, "Signing out…"));
  window.addEventListener("pageshow", (event) => { if (event.persisted && loader) refresh(); });
  return { find, node, badge, date, time, isoDay, start, end, reference, type, api, preview, config, notify, state, fieldError, handleError, confirm, mutate, refresh, errorText: (error) => messages[error?.code] || "Please try again later.", get user() { return user; }, get locked() { return busy || mutating || Boolean(pendingConfirmation); }, init(load) { loader = load; return refresh(); } };
})();
