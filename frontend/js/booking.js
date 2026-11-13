/* 预约页面：日期/时段选择、本人或代取一人的容量校验、一次性提交。 */
(() => {
  const A = window.ExpressBook, $ = A.find;
  let slots = [], selected, activeBooking, loadingSlots = false, submitting = false, uncertain = false, version = 0;
  const units = () => $("proxy-toggle").checked ? 2 : 1;
  const eligible = (slot) => slot.status === "AVAILABLE" && slot.remaining >= units() && Date.parse(slot.startAt) > Date.now();

  function update() {
    $("invitation-field").hidden = !$("proxy-toggle").checked;
    $("capacity-note").textContent = `Your pickup uses ${units()} ${units() === 1 ? "space" : "spaces"}${units() === 2 ? ": 1 for you and 1 for your friend" : ""}.`;
    $("summary-date").textContent = A.date(`${$("booking-date").value}T12:00:00+08:00`);
    $("summary-time").textContent = selected ? `${A.time(selected.startAt)} – ${A.time(selected.endAt)}` : "Choose a slot";
    $("summary-units").textContent = String(units());
    $("book-button").disabled = !selected || !eligible(selected) || Boolean(activeBooking) || loadingSlots || submitting || uncertain;
    A.state("booking-state", activeBooking ? "You already have an active booking. View My pickups before making another." : uncertain ? "The result is not yet confirmed. Check My pickups or refresh before trying again." : selected && !eligible(selected) ? `This slot needs at least ${units()} available spaces.` : "");
    document.querySelectorAll(".date-tab").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.date === $("booking-date").value)));
    document.querySelectorAll(".slot-choice").forEach((button) => {
      const slot = slots.find((item) => String(item.id) === button.dataset.slot);
      button.setAttribute("aria-pressed", String(slot === selected));
      button.disabled = submitting || loadingSlots || Boolean(activeBooking) || !eligible(slot);
    });
  }

  function renderSlots() {
    $("booking-slots").replaceChildren();
    for (const slot of slots) {
      const button = A.node("button", "slot-choice"); button.type = "button"; button.dataset.slot = String(slot.id);
      button.setAttribute("aria-pressed", "false");
      button.append(A.node("span", "slot-time", `${A.time(slot.startAt)} – ${A.time(slot.endAt)}`), A.badge(slot.status));
      button.append(A.node("p", "slot-capacity", `${slot.remaining} / ${slot.capacity} spaces remaining`));
      if (Date.parse(slot.startAt) <= Date.now()) button.append(A.node("p", "slot-occupied", "This slot has already started."));
      button.addEventListener("click", () => { if (!submitting && !A.locked && eligible(slot)) { selected = slot; update(); } });
      $("booking-slots").append(button);
    }
    update();
  }

  async function loadSlots() {
    const ticket = ++version, date = $("booking-date").value;
    selected = undefined; slots = []; loadingSlots = true;
    $("booking-slots").replaceChildren(); A.state("slots-state", "Loading pickup slots…"); update();
    if (!date || date < $("booking-date").min || date > $("booking-date").max) {
      loadingSlots = false; A.fieldError("booking-date", "Choose a date within the available booking window."); A.state("slots-state", "Select an available date above."); update(); return;
    }
    A.fieldError("booking-date", "");
    try {
      const result = await A.api.getSlots(date);
      if (ticket !== version) return; // 快速切换日期时丢弃旧请求，不覆盖新日期的时段。
      slots = result.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
      A.state("slots-state", slots.length ? "" : "No pickup slots are listed for this date.");
    } catch (error) {
      if (ticket !== version) return;
      if (ticket === version) A.state("slots-state", A.errorText(error), true);
      throw error;
    } finally { if (ticket === version) { loadingSlots = false; renderSlots(); } }
  }

  $("booking-date").addEventListener("change", () => { if (!submitting) loadSlots().catch(A.handleError); });
  $("proxy-toggle").checked = new URLSearchParams(window.location.search).get("helper") === "1";
  $("proxy-toggle").addEventListener("change", () => { A.fieldError("invitation-code", ""); update(); });
  $("invitation-code").addEventListener("input", () => A.fieldError("invitation-code", ""));

  $("booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (A.locked || submitting) return;
    if (!selected || !eligible(selected) || activeBooking || uncertain) { update(); return; }
    const code = $("proxy-toggle").checked ? $("invitation-code").value.trim() : undefined;
    A.fieldError("invitation-code", $("proxy-toggle").checked && !code ? "Enter your friend’s invitation code." : "");
    if ($("proxy-toggle").checked && !code) { $("invitation-code").focus(); return; }
    // 确认后重新检查时间与容量提示，真正并发占位仍由后端事务保证。
    if (!await A.confirm("Confirm your pickup?", `${A.date(selected.startAt)} · ${A.time(selected.startAt)} – ${A.time(selected.endAt)}. This booking uses ${units()} ${units() === 1 ? "space" : "spaces"}.`, "Book pickup")) return;
    if (!eligible(selected)) { update(); A.notify("This slot is no longer available. Refresh and choose another.", "error"); return; }
    submitting = true;
    $("booking-date").disabled = true; $("proxy-toggle").disabled = true; $("invitation-code").disabled = true;
    update();
    await A.mutate($("book-button"), async () => {
      try {
        const appointment = await A.api.createAppointment(selected.id, code);
        if (appointment.status !== "BOOKED") throw { code: "INVALID_RESPONSE" };
        activeBooking = appointment;
        $("booking-form").hidden = true; $("booking-success").hidden = false;
        $("booking-result").textContent = `Booking ${A.reference(appointment)} · ${A.date(selected.startAt)} · ${A.time(selected.startAt)} – ${A.time(selected.endAt)}.`;
        $("invitation-code").value = "";
        A.notify(A.preview ? "Preview booking confirmed. This sample resets when you leave the page." : "Your pickup has been booked successfully.", "success");
      } catch (error) {
        if (["NETWORK_ERROR", "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(error.code)) uncertain = true;
        if (error.code === "BOOKING_EXISTS") activeBooking = { status: "BOOKED" };
        if (error.code === "SLOT_FULL") { selected = undefined; await loadSlots(); }
        throw error;
      }
    }, "Booking…");
    submitting = false; $("booking-date").disabled = false; $("proxy-toggle").disabled = false; $("invitation-code").disabled = false; update();
  });

  A.init(async () => {
    uncertain = false; selected = undefined; $("booking-success").hidden = true; $("booking-form").hidden = false;
    const days = Array.from({ length: A.config.bookingDays }, (_, index) => A.isoDay(index + A.config.bookingStartOffsetDays));
    $("booking-date").min = days[0]; $("booking-date").max = days.at(-1);
    const params = new URLSearchParams(window.location.search);
    if (days.includes(params.get("date"))) $("booking-date").value = params.get("date");
    else if (!days.includes($("booking-date").value)) $("booking-date").value = days.find((day) => day > A.isoDay()) || days[0];
    $("date-tabs").replaceChildren();
    for (const day of days) {
      const button = A.node("button", "date-tab", A.date(`${day}T12:00:00+08:00`, { year: undefined, weekday: "short" })); button.type = "button"; button.dataset.date = day;
      button.addEventListener("click", () => { if (!submitting && !A.locked) { $("booking-date").value = day; loadSlots().catch(A.handleError); } });
      $("date-tabs").append(button);
    }
    activeBooking = (await A.api.getAppointments()).find((item) => item.status === "BOOKED");
    await loadSlots();
    const suggested = slots.find((slot) => String(slot.id) === params.get("slotId"));
    if (suggested && eligible(suggested)) { selected = suggested; update(); }
  });
})();
