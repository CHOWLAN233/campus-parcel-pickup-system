/*
 * 请求层：所有后端地址集中放在这里，页面代码不重复拼接地址。
 * 本阶段没有附带后端；这里预留 SRS 的真实接口，不模拟任何业务成功。
 * 使用普通脚本而非 ES Modules，方便初学者直接双击 HTML 查看页面。
 */
window.ParcelApi = (() => {
  const API_BASE = "/api";
  // 超过 12 秒主动取消请求，避免界面一直停留在提交中。
  const TIMEOUT_MS = 12000;

  // 统一错误结构，交由各页面根据 code 选择对应的提示文字。
  function apiError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  // 所有页面共用超时、Cookie 和错误处理；请求路径只由下方固定方法生成。
  async function request(path, { method = "GET", body, expectedStatus = 200 } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        // 同源请求带上 Cookie。Session Cookie 由后端设置，前端无需读取。
        credentials: "same-origin",
        body: body ? JSON.stringify(body) : undefined,
        // 避免刷新首页时读取过时的会话或预约缓存。
        cache: "no-store",
        signal: controller.signal,
      });

      // 错误状态先于 JSON 解析处理：会话过期响应即使没有 JSON，也能跳回登录页。
      if (response.status === 401) throw apiError(path === "/auth/login" ? "INVALID_CREDENTIALS" : "UNAUTHORIZED");
      if (response.status === 403) throw apiError("FORBIDDEN");
      if (response.status === 429) throw apiError("TOO_MANY_REQUESTS");
      if (response.status >= 500) throw apiError("SERVICE_UNAVAILABLE");
      if ([405, 501].includes(response.status)) {
        throw apiError("SERVICE_UNAVAILABLE");
      }
      if (path === "/auth/register" && response.status === 409) throw apiError("ALREADY_REGISTERED");

      // 退出接口按合同返回 204，无响应体，不能调用 response.json()。
      if (response.status === 204 && expectedStatus === 204) return;

      let data;
      try {
        data = await response.json();
      } catch (error) {
        if (error.name === "AbortError") throw error;
        throw apiError(response.status === 404 ? "SERVICE_UNAVAILABLE" : "INVALID_RESPONSE");
      }

      if (!response.ok) {
        throw apiError(data?.code || (response.status === 400 ? "INVALID_INPUT" : response.status === 404 ? "SERVICE_UNAVAILABLE" : "REQUEST_FAILED"));
      }

      if (response.status !== expectedStatus) throw apiError("INVALID_RESPONSE");
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw apiError("REQUEST_TIMEOUT");
      if (error instanceof TypeError) throw apiError("NETWORK_ERROR");
      throw error;
    } finally {
      // 请求结束后清除计时器，避免已完成的请求再次触发取消操作。
      clearTimeout(timeoutId);
    }
  }

  // 登录、注册和会话查询都使用相同的 user 数据结构。
  function readUser(data) {
    if (!data?.user || typeof data.user.studentId !== "string" || !data.user.studentId.trim()) {
      throw apiError("INVALID_RESPONSE");
    }
    return data.user;
  }

  async function submitCredentials(operation, studentId, password) {
    return readUser(await request(`/auth/${operation}`, {
      method: "POST", body: { studentId, password }, expectedStatus: operation === "register" ? 201 : 200,
    }));
  }

  async function getAppointments() {
    const data = await request("/appointments/me");
    const statuses = ["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"];
    if (!Array.isArray(data?.appointments) || !data.appointments.every((item) =>
      item && ["string", "number"].includes(typeof item.id) && statuses.includes(item.status))) {
      throw apiError("INVALID_RESPONSE");
    }
    return data.appointments;
  }

  async function getSlots(date) {
    const data = await request(`/slots?date=${encodeURIComponent(date)}`);
    // 名额以服务端返回值为准，不能将无效值默认为零并误报“已满”。
    if (!Array.isArray(data?.slots) || !data.slots.every((slot) =>
      slot && ["string", "number"].includes(typeof slot.id) && ["AVAILABLE", "FULL", "CLOSED"].includes(slot.status) &&
      [slot.capacity, slot.occupied, slot.remaining].every((value) => Number.isInteger(value) && value >= 0) &&
      slot.remaining <= slot.capacity && slot.occupied <= slot.capacity &&
      Number.isFinite(Date.parse(slot.startAt)) && Number.isFinite(Date.parse(slot.endAt)) &&
      Date.parse(slot.endAt) > Date.parse(slot.startAt))) {
      throw apiError("INVALID_RESPONSE");
    }
    return data.slots;
  }

  // 写操作同样验证返回结构，只有后端确认的结果才能更新页面状态。
  function readAppointment(data) {
    const item = data?.appointment;
    if (!item || !["string", "number"].includes(typeof item.id) || !["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"].includes(item.status)) throw apiError("INVALID_RESPONSE");
    return item;
  }

  function readAuthorization(item) {
    if (!item || !["ACTIVE", "RESERVED", "USED", "EXPIRED", "REVOKED"].includes(item.status) || !Number.isFinite(Date.parse(item.expiresAt))) throw apiError("INVALID_RESPONSE");
    return { ...item, invitationCode: item.invitationCode ?? item.code };
  }

  function readSlot(data) {
    const item = data?.slot;
    if (!item || !["string", "number"].includes(typeof item.id) || !["AVAILABLE", "FULL", "CLOSED"].includes(item.status) || !Number.isInteger(item.capacity) || item.capacity < 1 || !Number.isInteger(item.occupied) || item.occupied < 0 || item.occupied > item.capacity) throw apiError("INVALID_RESPONSE");
    return item;
  }

  const idPath = (id) => encodeURIComponent(String(id));

  // 确认密码只在页面校验，不发送给后端；不允许客户端指定账号角色。
  return {
    login: (studentId, password) => submitCredentials("login", studentId, password),
    register: (studentId, password) => submitCredentials("register", studentId, password),
    getCurrentUser: async () => readUser(await request("/auth/me")),
    getAppointments,
    getSlots,
    logout: () => request("/auth/logout", { method: "POST", expectedStatus: 204 }),
    createAppointment: async (slotId, invitationCode) => readAppointment(await request("/appointments", {
      method: "POST", expectedStatus: 201, body: { slotId, ...(invitationCode ? { invitationCode } : {}) },
    })),
    cancelAppointment: async (id) => readAppointment(await request(`/appointments/${idPath(id)}/cancel`, { method: "POST" })),
    getAuthorizations: async () => {
      const data = await request("/authorizations/me");
      if (!Array.isArray(data?.authorizations)) throw apiError("INVALID_RESPONSE");
      return data.authorizations.map(readAuthorization);
    },
    createAuthorization: async () => {
      const data = await request("/authorizations", { method: "POST", expectedStatus: 201 });
      const item = readAuthorization(data?.authorization ?? data);
      if (typeof item.invitationCode !== "string" || !item.invitationCode.trim()) throw apiError("INVALID_RESPONSE");
      return item;
    },
    // 以下撤销、工作人员查询和管理员创建路径是前端建议扩展，见接口文档。
    revokeAuthorization: async (id) => {
      const data = await request(`/authorizations/${idPath(id)}/revoke`, { method: "POST" });
      return readAuthorization(data?.authorization ?? data);
    },
    getNoShows: async () => {
      const data = await request("/no-shows/me");
      if (!Array.isArray(data?.records) || !data.records.every((item) => item && ["string", "number"].includes(typeof item.id))) throw apiError("INVALID_RESPONSE");
      return data.records;
    },
    findStaffAppointment: async (reference) => readAppointment(await request(`/staff/appointments?reference=${encodeURIComponent(reference)}`)),
    completeAppointment: async (id) => readAppointment(await request(`/staff/appointments/${idPath(id)}/complete`, { method: "POST" })),
    updateSlot: async (id, values) => readSlot(await request(`/admin/slots/${idPath(id)}`, { method: "PATCH", body: values })),
    createSlot: async (values) => readSlot(await request("/admin/slots", { method: "POST", expectedStatus: 201, body: values })),
  };
})();
