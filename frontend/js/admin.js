/* 管理员时段维护：不允许把容量降到已有占用以下；不删除任何预约或审计数据。 */
(() => {
  const A = window.ExpressBook, $ = A.find;
  let slots = [], version = 0, editing = false, loadingSlots = false, uncertainCreate = false;
  function values() {
    const date = $("admin-date").value, time = $("new-slot-time").value;
    const startAt = date && time ? `${date}T${time}:00+08:00` : undefined;
    const start = Date.parse(startAt);
    const endAt = Number.isFinite(start) ? new Date(start + 3600000 + 8 * 3600000).toISOString().slice(0, 19) + "+08:00" : undefined;
    return { startAt, endAt, capacity: Number($("new-capacity").value), status: $("new-slot-status").value };
  }
  function updateEnd() {
    const value = values();
    $("new-slot-end").textContent = value.endAt ? `Ends ${A.date(value.endAt)} · ${A.time(value.endAt)} (UTC+08:00).` : "Choose a start time. Each slot lasts one hour.";
  }
  function render() {
    $("admin-body").replaceChildren(); $("admin-table-wrap").hidden = !slots.length;
    A.state("admin-state", slots.length ? "" : "No slots listed for this date. Create one below.");
    for (const slot of slots) {
      const row = A.node("tr"); row.append(A.node("td", "", `${A.time(slot.startAt)} – ${A.time(slot.endAt)}`), A.node("td", "", slot.occupied));
      const capCell = A.node("td"), capacity = A.node("input"); capacity.type = "number"; capacity.value = String(slot.capacity); capacity.min = String(Math.max(1, slot.occupied)); capacity.max = "60"; capacity.step = "1"; capacity.setAttribute("aria-label", `Capacity for ${A.time(slot.startAt)}`); capCell.append(capacity); row.append(capCell);
      const statusCell = A.node("td"), status = A.node("select"); status.setAttribute("aria-label", `Availability for ${A.time(slot.startAt)}`);
      for (const [value, text] of [["AVAILABLE", "Open"], ["CLOSED", "Closed"]]) { const option = A.node("option", "", text); option.value = value; status.append(option); }
      status.value = slot.status === "CLOSED" ? "CLOSED" : "AVAILABLE"; statusCell.append(status); row.append(statusCell);
      const action = A.node("td"), save = A.node("button", "secondary-button", "Save"); save.type = "button"; save.dataset.slotId = slot.id; action.append(save); row.append(action);
      save.addEventListener("click", async () => {
        if (A.locked || editing) return;
        const next = { capacity: Number(capacity.value), status: status.value };
        if (!Number.isInteger(next.capacity) || next.capacity < Math.max(1, slot.occupied) || next.capacity > 60) {
          capacity.setAttribute("aria-invalid", "true"); capacity.focus(); A.notify(`Capacity must be a whole number between ${Math.max(1, slot.occupied)} and 60.`, "error"); return;
        }
        capacity.setAttribute("aria-invalid", "false");
        if (!await A.confirm("Update this slot?", `${A.date(slot.startAt)} · ${A.time(slot.startAt)}. Capacity: ${next.capacity}. Availability: ${next.status === "CLOSED" ? "closed to new bookings" : "open"}. Existing bookings are kept.`, "Save changes")) return;
        editing = true; $("admin-date").disabled = true;
        await A.mutate(save, async () => {
          const updated = await A.api.updateSlot(slot.id, next);
          slots = slots.map((item) => String(item.id) === String(slot.id) ? { ...item, ...updated } : item); render(); A.notify("Slot updated.", "success");
        }, "Saving…");
        editing = false; $("admin-date").disabled = false;
      });
      $("admin-body").append(row);
    }
  }
  async function loadSlots() {
    const ticket = ++version, date = $("admin-date").value;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { slots = []; $("admin-table-wrap").hidden = true; $("create-slot-button").disabled = true; A.fieldError("admin-date", "Choose a valid date."); return; }
    loadingSlots = true; $("create-slot-button").disabled = true;
    A.fieldError("admin-date", ""); slots = []; $("admin-table-wrap").hidden = true; A.state("admin-state", "Loading slots…");
    try { const result = await A.api.getSlots(date); if (ticket === version) { slots = result.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)); uncertainCreate = false; render(); } }
    catch (error) { if (ticket !== version) return; A.state("admin-state", A.errorText(error), true); throw error; }
    finally { if (ticket === version) { loadingSlots = false; $("create-slot-button").disabled = uncertainCreate; } }
    updateEnd();
  }
  $("admin-date").addEventListener("change", () => { if (!editing) loadSlots().catch(A.handleError); });
  $("new-slot-time").addEventListener("input", updateEnd);
  $("create-slot-form").addEventListener("submit", async (event) => {
    event.preventDefault(); if (A.locked || editing || loadingSlots || uncertainCreate) return;
    const value = values();
    const invalidTime = !value.startAt || !Number.isFinite(Date.parse(value.startAt)) || Date.parse(value.startAt) <= Date.now();
    const invalidCapacity = !Number.isInteger(value.capacity) || value.capacity < 1 || value.capacity > 60;
    A.fieldError("new-slot-time", invalidTime ? "Choose a valid start time in the future." : "");
    A.fieldError("new-capacity", invalidCapacity ? "Enter a whole number from 1 to 60." : "");
    if (invalidTime || invalidCapacity) { $(invalidTime ? "new-slot-time" : "new-capacity").focus(); return; }
    if (slots.some((slot) => Date.parse(value.startAt) < Date.parse(slot.endAt) && Date.parse(value.endAt) > Date.parse(slot.startAt))) { A.notify("This time overlaps an existing slot. Choose a different start time.", "error"); return; }
    if (!await A.confirm("Create this slot?", `${A.date(value.startAt)} · ${A.time(value.startAt)} – ${A.time(value.endAt)}. Capacity: ${value.capacity}.`, "Create slot")) return;
    editing = true; $("admin-date").disabled = true;
    await A.mutate($("create-slot-button"), async () => {
      let created;
      try { created = await A.api.createSlot(value); }
      catch (error) { if (["NETWORK_ERROR", "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(error.code)) uncertainCreate = true; throw error; }
      slots.push(created); slots.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)); render();
      $("new-slot-time").value = ""; updateEnd(); A.notify("Slot created.", "success");
    }, "Creating…");
    editing = false; $("admin-date").disabled = false;
    $("create-slot-button").disabled = uncertainCreate;
    if (uncertainCreate) A.notify("The slot creation result is not confirmed. Refresh to check the slot list before trying again.", "error");
  });
  A.init(async () => { if (!$("admin-date").value) $("admin-date").value = A.isoDay(1); await loadSlots(); });
})();
