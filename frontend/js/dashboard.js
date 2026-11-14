/*
 * 首页交互层：先检查 Session，再并行读取预约与当日时段。
 * 所有业务数据来自 ParcelApi；只有 file: 预览使用明确标注的示例数据。
 */
(() => {
  const find = (id) => document.querySelector(`#${id}`);
  const content = find("dashboard-content");
  const gate = find("dashboard-gate");
  const refreshButton = find("refresh-button");
  const logoutButton = find("logout-button");
  const retryButton = find("retry-button");
  const preview = window.location.protocol === "file:";
  const timeZone = "Asia/Kuala_Lumpur";
  let busy = false;
  let signingOut = false;
  const statusLabels = { BOOKED: "Booked", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "Missed pickup", AVAILABLE: "Available", FULL: "Full", CLOSED: "Closed" };
  const errors = {
    NETWORK_ERROR: "Check your connection and try again.",
    REQUEST_TIMEOUT: "The request timed out. Please try again.",
    SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again later.",
    INVALID_RESPONSE: "We couldn't read the response. Please try again later.",
    TOO_MANY_REQUESTS: "Too many requests. Please wait a moment and try again.",
    FORBIDDEN: "You do not have access to this information.",
  };

  function errorText(error) {
    return errors[error?.code] || "Something went wrong. Please try again.";
  }

  // 统一使用 UTC+08:00 的业务日期，避免操作系统时区导致日期偏移。
  function businessDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function formatDate(value, options = {}) {
    if (!value || !Number.isFinite(Date.parse(value))) return "Time not provided";
    return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", ...options }).format(new Date(value));
  }

  function formatTime(value) {
    return formatDate(value, { day: undefined, month: undefined, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }

  function startAt(appointment) { return appointment.startAt ?? appointment.slot?.startAt; }
  function endAt(appointment) { return appointment.endAt ?? appointment.slot?.endAt; }
  function timestamp(value) { return Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0; }
  function reference(appointment) { return appointment.appointmentNumber || `#${appointment.id}`; }
  function pickupType(appointment) {
    if (appointment.proxyCount === 1) return "You + 1 friend";
    return appointment.proxyCount === 0 ? "Just you" : "Not provided";
  }

  // API 内容始终通过 textContent 写入，不能用 innerHTML 拼接用户或预约数据。
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function badge(status) {
    const node = element("span", "status-badge", statusLabels[status]);
    node.dataset.status = status;
    return node;
  }

  function state(id, text, isError = false) {
    const node = find(id);
    node.textContent = text;
    node.hidden = !text;
    node.dataset.error = String(isError);
  }

  function clearData() {
    ["active-count", "completed-count", "remaining-count"].forEach((id) => { find(id).textContent = "—"; });
    find("pickup-details").hidden = true;
    find("activity-table-wrap").hidden = true;
    find("activity-body").replaceChildren();
    find("slots-list").replaceChildren();
    state("pickup-state", "Loading your appointment…");
    state("activity-state", "Loading recent pickups…");
    state("slots-state", "Loading available slots…");
  }

  function renderAppointments(appointments) {
    // 有效性以服务端状态为准，不因客户端时钟自行把 BOOKED 改为 NO_SHOW。
    const active = appointments.filter((item) => item.status === "BOOKED");
    find("active-count").textContent = String(active.length);
    find("completed-count").textContent = String(appointments.filter((item) => item.status === "COMPLETED").length);
    const next = [...active].sort((a, b) => (timestamp(startAt(a)) || Infinity) - (timestamp(startAt(b)) || Infinity))[0];
    if (next) {
      state("pickup-state", "");
      find("pickup-details").hidden = false;
      find("pickup-reference").textContent = `Booking ${reference(next)}`;
      find("pickup-date").textContent = formatDate(startAt(next), { weekday: "long", year: "numeric" });
      find("pickup-time").textContent = `${formatTime(startAt(next))} – ${formatTime(endAt(next))} · UTC+08:00`;
      find("pickup-type").textContent = pickupType(next);
      find("pickup-capacity").textContent = [1, 2].includes(next.occupiedCapacity) ? String(next.occupiedCapacity) : "Not provided";
    } else {
      state("pickup-state", "No active pickup yet. Your next booking will appear here.");
    }

    // 优先按创建时间排序；未提供创建时间时使用取件时间，最多显示五条。
    const recent = [...appointments].sort((a, b) => timestamp(b.createdAt ?? startAt(b)) - timestamp(a.createdAt ?? startAt(a))).slice(0, 5);
    state("activity-state", recent.length ? "" : "No pickups to show yet.");
    find("activity-table-wrap").hidden = !recent.length;
    for (const appointment of recent) {
      const row = element("tr");
      row.append(element("td", "", reference(appointment)));
      row.append(element("td", "", `${formatDate(startAt(appointment))} · ${formatTime(startAt(appointment))}`));
      row.append(element("td", "", pickupType(appointment)));
      const statusCell = element("td");
      statusCell.append(badge(appointment.status));
      row.append(statusCell);
      find("activity-body").append(row);
    }
  }

  function renderSlots(slots, now = Date.now()) {
    // 已开始的时段不再展示为可选；剩余名额直接使用服务器的 remaining。
    const upcoming = slots.filter((slot) => timestamp(slot.startAt) > now).sort((a, b) => timestamp(a.startAt) - timestamp(b.startAt));
    const remaining = upcoming.filter((slot) => slot.status === "AVAILABLE").reduce((sum, slot) => sum + slot.remaining, 0);
    find("remaining-count").textContent = String(remaining);
    state("slots-state", !upcoming.length ? "No upcoming pickup slots listed for today." : upcoming.length > 3 ? `Showing the next 3 of ${upcoming.length} upcoming slots.` : "");
    for (const slot of upcoming.slice(0, 3)) {
      const item = element("li", "slot-item");
      item.append(element("span", "slot-time", `${formatTime(slot.startAt)} – ${formatTime(slot.endAt)}`));
      item.append(badge(slot.status === "AVAILABLE" && slot.remaining === 0 ? "FULL" : slot.status));
      item.append(element("p", "slot-capacity", `${slot.remaining} / ${slot.capacity} spaces remaining`));
      item.append(element("p", "slot-occupied", `${slot.occupied} occupied`));
      if (slot.status === "AVAILABLE" && slot.remaining > 0) {
        const link = element("a", "card-link", "Choose this slot →");
        link.href = `booking.html?date=${encodeURIComponent(slot.startAt.slice(0, 10))}&slotId=${encodeURIComponent(slot.id)}`;
        item.append(link);
      }
      find("slots-list").append(item);
    }
  }

  function showUser(user) {
    find("user-id").textContent = user.studentId;
    find("welcome-title").textContent = `Welcome back, ${user.studentId}.`;
    find("staff-nav").hidden = !["STAFF", "ADMIN"].includes(user.role);
    find("admin-nav").hidden = user.role !== "ADMIN";
    gate.hidden = true;
    content.hidden = false;
  }

  function showGateError(error) {
    content.hidden = true;
    gate.hidden = false;
    gate.setAttribute("aria-busy", "false");
    find("user-id").textContent = "Not connected";
    find("gate-title").textContent = "We couldn't load your dashboard";
    find("gate-message").textContent = errorText(error);
    retryButton.hidden = false;
    find("gate-signin").hidden = false;
  }

  function goToLogin(reason) {
    // 先移除已展示的数据，再跳转；不允许在失败时继续显示旧的私人信息。
    content.hidden = true;
    clearData();
    find("user-id").textContent = "Signed out";
    window.location.replace(`login.html?reason=${reason}`);
  }

  // 示例数据只服务于本地视觉预览，不写入存储，也不走真实登录或预约流程。
  function showPreview(date) {
    const tomorrow = businessDate(new Date(Date.now() + 86400000));
    showUser({ studentId: "STU0001" });
    find("preview-notice").hidden = false;
    find("preview-signin").hidden = false;
    logoutButton.hidden = true;
    renderAppointments([
      { id: 5001, startAt: `${tomorrow}T10:00:00+08:00`, endAt: `${tomorrow}T11:00:00+08:00`, status: "BOOKED", proxyCount: 1, occupiedCapacity: 2 },
      { id: 4982, startAt: `${date}T09:00:00+08:00`, endAt: `${date}T10:00:00+08:00`, status: "COMPLETED", proxyCount: 0, occupiedCapacity: 1 },
    ]);
    renderSlots([
      { startAt: `${date}T09:00:00+08:00`, endAt: `${date}T10:00:00+08:00`, capacity: 60, occupied: 42, remaining: 18, status: "AVAILABLE" },
      { startAt: `${date}T10:00:00+08:00`, endAt: `${date}T11:00:00+08:00`, capacity: 60, occupied: 58, remaining: 2, status: "AVAILABLE" },
      { startAt: `${date}T11:00:00+08:00`, endAt: `${date}T12:00:00+08:00`, capacity: 60, occupied: 60, remaining: 0, status: "FULL" },
    ], timestamp(`${date}T08:00:00+08:00`));
  }

  async function loadDashboard() {
    if (busy || signingOut) return;
    busy = true;
    refreshButton.disabled = true;
    retryButton.disabled = true;
    logoutButton.disabled = true;
    content.setAttribute("aria-busy", "true");
    find("dashboard-message").hidden = true;
    clearData();
    const date = businessDate();
    find("today-label").textContent = formatDate(`${date}T12:00:00+08:00`, { weekday: "short", year: "numeric" });
    find("today-label").setAttribute("datetime", date);
    let authenticated = false;
    try {
      if (preview) {
        showPreview(date);
        return;
      }
      // 查询会话成功后才请求私人预约；无后端时显示错误，不偷偷使用示例数据。
      const user = await window.ParcelApi.getCurrentUser();
      authenticated = true;
      showUser(user);
      const results = await Promise.allSettled([window.ParcelApi.getAppointments(), window.ParcelApi.getSlots(date)]);
      if (results.some((result) => result.status === "rejected" && result.reason?.code === "UNAUTHORIZED")) {
        authenticated = false;
        goToLogin("session-expired");
        return;
      }
      // 某一个接口失败时保留另一个接口的可用结果，并允许通过 Refresh 重试。
      const [appointments, slots] = results;
      if (appointments.status === "fulfilled") renderAppointments(appointments.value);
      else {
        state("pickup-state", `Couldn't load your pickup. ${errorText(appointments.reason)}`, true);
        state("activity-state", `Couldn't load recent pickups. ${errorText(appointments.reason)}`, true);
      }
      if (slots.status === "fulfilled") renderSlots(slots.value);
      else state("slots-state", `Couldn't load available slots. ${errorText(slots.reason)}`, true);
      if (results.some((result) => result.status === "rejected")) {
        const message = find("dashboard-message");
        message.textContent = "Some information couldn't be loaded. Select Refresh to try again.";
        message.dataset.type = "error";
        message.hidden = false;
      }
    } catch (error) {
      authenticated = false;
      if (error.code === "UNAUTHORIZED") goToLogin("session-expired");
      else showGateError(error);
    } finally {
      busy = false;
      refreshButton.disabled = false;
      retryButton.disabled = false;
      logoutButton.disabled = !authenticated;
      gate.setAttribute("aria-busy", "false");
      content.setAttribute("aria-busy", "false");
    }
  }

  logoutButton.addEventListener("click", async () => {
    if (preview || busy || signingOut) return;
    signingOut = true;
    logoutButton.disabled = true;
    refreshButton.disabled = true;
    logoutButton.textContent = "Signing out…";
    try {
      await window.ParcelApi.logout();
      goToLogin("signed-out");
    } catch (error) {
      if (error.code === "UNAUTHORIZED") goToLogin("session-expired");
      else {
        const message = find("dashboard-message");
        message.textContent = `Couldn't sign out. ${errorText(error)}`;
        message.dataset.type = "error";
        message.hidden = false;
        message.focus();
      }
    } finally {
      signingOut = false;
      logoutButton.disabled = false;
      logoutButton.textContent = "Sign out ↗";
      refreshButton.disabled = false;
    }
  });

  refreshButton.addEventListener("click", loadDashboard);
  retryButton.addEventListener("click", loadDashboard);
  // 从浏览器前进/后退缓存恢复时重新验证会话，避免将缓存画面当作有效登录。
  window.addEventListener("pageshow", (event) => { if (event.persisted) loadDashboard(); });
  loadDashboard();
})();
