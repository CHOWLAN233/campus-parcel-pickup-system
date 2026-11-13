/* 仅供 file: 本地预览的内存数据。各页独立，离开/刷新即重置。
 * HTTP 环境绝不选用此适配器；所有生成的码都只是示例，不是真实授权。
 */
window.ExpressBookDemo = {
  create(page) {
    const day = (offset = 0) => {
      const value = new Date(Date.now() + offset * 86400000 + 8 * 3600000);
      return value.toISOString().slice(0, 10);
    };
    const active = { id: 5001, studentId: "STU0001", startAt: `${day(1)}T10:00:00+08:00`, endAt: `${day(1)}T11:00:00+08:00`, status: "BOOKED", proxyCount: 1, occupiedCapacity: 2, canCancel: true, helperStudentId: "STU0002", authorizationStatus: "RESERVED" };
    let appointments = page === "booking" ? [] : [{ ...active }];
    appointments.push({ ...active, id: 4982, startAt: `${day(-1)}T09:00:00+08:00`, endAt: `${day(-1)}T10:00:00+08:00`, status: "COMPLETED", proxyCount: 0, occupiedCapacity: 1 }, { ...active, id: 4900, startAt: `${day(-3)}T11:00:00+08:00`, endAt: `${day(-3)}T12:00:00+08:00`, status: "NO_SHOW", proxyCount: 0, occupiedCapacity: 1 });
    const slotsByDate = new Map();
    let authorizations = [];
    let nextId = 6000;
    const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
    const issuedCodes = new Set();
    // 32 个易区分字符，排除 0/O 和 1/I；256 能被 32 整除，取模不会偏向某些字符。
    const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    function randomInvitationCode() {
      if (!window.crypto?.getRandomValues) fail("SERVICE_UNAVAILABLE");
      // 用浏览器安全随机源生成八位码，撤销过的码也不在当前页重复使用。
      for (let attempt = 0; attempt < 32; attempt++) {
        const bytes = window.crypto.getRandomValues(new Uint8Array(8));
        const code = Array.from(bytes, (value) => codeAlphabet[value % codeAlphabet.length]).join("");
        if (!issuedCodes.has(code)) { issuedCodes.add(code); return code; }
      }
      fail("SERVICE_UNAVAILABLE");
    }
    const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    // 稍作延迟，让预览也能观察按钮加载状态；不进行任何网络访问。
    const call = (work) => async (...args) => { await new Promise((resolve) => setTimeout(resolve, 80)); return clone(work(...args)); };
    function slots(date) {
      if (!slotsByDate.has(date)) slotsByDate.set(date, [9, 10, 11, 14].map((hour, index) => ({ id: `${date}-${hour}`, startAt: `${date}T${String(hour).padStart(2, "0")}:00:00+08:00`, endAt: `${date}T${String(hour + 1).padStart(2, "0")}:00:00+08:00`, capacity: 60, occupied: [42, 59, 60, 0][index], remaining: [18, 1, 0, 60][index], status: ["AVAILABLE", "AVAILABLE", "FULL", "CLOSED"][index] })));
      return slotsByDate.get(date);
    }
    return {
      getCurrentUser: call(() => ({ id: 1, studentId: page === "staff" ? "STAFF001" : page === "admin" ? "ADMIN001" : "STU0001", role: page === "staff" ? "STAFF" : page === "admin" ? "ADMIN" : "STUDENT" })),
      logout: call(() => undefined),
      getAppointments: call(() => appointments),
      getSlots: call(slots),
      createAppointment: call((slotId, invitationCode) => {
        if (appointments.some((item) => item.status === "BOOKED")) fail("BOOKING_EXISTS");
        if (invitationCode === "EXPIRED") fail("INVITATION_EXPIRED");
        if (invitationCode === "USED") fail("INVITATION_USED");
        if (authorizations.some((item) => item.invitationCode === invitationCode)) fail("INVALID_INVITATION");
        const slot = [...slotsByDate.values()].flat().find((item) => item.id === slotId);
        const units = invitationCode ? 2 : 1;
        if (!slot || slot.status !== "AVAILABLE" || slot.remaining < units) fail("SLOT_FULL");
        const item = { id: nextId++, slotId, startAt: slot.startAt, endAt: slot.endAt, status: "BOOKED", proxyCount: invitationCode ? 1 : 0, occupiedCapacity: units, canCancel: true };
        appointments.unshift(item); slot.occupied += units; slot.remaining -= units;
        return item;
      }),
      cancelAppointment: call((id) => {
        const item = appointments.find((item) => String(item.id) === String(id));
        if (!item || item.status !== "BOOKED") fail("CANCEL_NOT_ALLOWED");
        const slot = [...slotsByDate.values()].flat().find((slot) => slot.id === item.slotId);
        if (slot) { slot.occupied -= item.occupiedCapacity; slot.remaining += item.occupiedCapacity; if (slot.status === "FULL") slot.status = "AVAILABLE"; }
        item.status = "CANCELLED"; item.canCancel = false;
        return item;
      }),
      getAuthorizations: call(() => authorizations),
      createAuthorization: call(() => {
        if (authorizations.some((item) => item.status === "ACTIVE" && Date.parse(item.expiresAt) > Date.now())) fail("INVITATION_EXISTS");
        const item = { id: nextId++, invitationCode: randomInvitationCode(), expiresAt: new Date(Date.now() + 3600000).toISOString(), status: "ACTIVE" };
        authorizations.unshift(item); return item;
      }),
      revokeAuthorization: call((id) => {
        const item = authorizations.find((item) => String(item.id) === String(id));
        if (!item || item.status !== "ACTIVE") fail("INVALID_STATUS");
        item.status = "REVOKED"; return item;
      }),
      getNoShows: call(() => appointments.filter((item) => item.status === "NO_SHOW").map((item) => ({ id: item.id, appointmentId: item.id, startAt: item.startAt, endAt: item.endAt, recordedAt: item.endAt, status: "NO_SHOW" }))),
      findStaffAppointment: call((reference) => {
        const item = appointments.find((item) => String(item.id) === reference.replace(/^#/, ""));
        if (!item) fail("NOT_FOUND");
        return item;
      }),
      completeAppointment: call((id) => {
        const item = appointments.find((item) => String(item.id) === String(id));
        if (!item || item.status !== "BOOKED") fail("INVALID_STATUS");
        item.status = "COMPLETED"; item.authorizationStatus = "USED"; item.canCancel = false;
        return item;
      }),
      updateSlot: call((id, values) => {
        const item = [...slotsByDate.values()].flat().find((item) => item.id === id);
        if (!item) fail("NOT_FOUND");
        if (values.capacity < item.occupied) fail("CAPACITY_TOO_LOW");
        Object.assign(item, values); item.remaining = item.capacity - item.occupied;
        if (item.status !== "CLOSED") item.status = item.remaining ? "AVAILABLE" : "FULL";
        return item;
      }),
      createSlot: call((values) => {
        const list = slots(values.startAt.slice(0, 10));
        if (list.some((item) => Date.parse(values.startAt) < Date.parse(item.endAt) && Date.parse(values.endAt) > Date.parse(item.startAt))) fail("SLOT_EXISTS");
        const item = { id: nextId++, ...values, occupied: 0, remaining: values.capacity }; list.push(item); return item;
      }),
    };
  },
};
