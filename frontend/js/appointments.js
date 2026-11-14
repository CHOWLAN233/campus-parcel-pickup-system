/* 我的预约：筛选全部记录；取消资格优先采用服务端字段，不写死“提前24小时”。 */
(() => {
  const A = window.ExpressBook, $ = A.find;
  let appointments = [];
  function canCancel(item) {
    return item.status === "BOOKED" && item.canCancel !== false && (!item.cancelBefore || Date.parse(item.cancelBefore) > Date.now());
  }
  function render() {
    $("active-total").textContent = String(appointments.filter((item) => item.status === "BOOKED").length);
    $("completed-total").textContent = String(appointments.filter((item) => item.status === "COMPLETED").length);
    $("all-total").textContent = String(appointments.length);
    const query = $("booking-search").value.trim().toLowerCase();
    const filtered = appointments.filter((item) => ($("status-filter").value === "ALL" || item.status === $("status-filter").value) && A.reference(item).toLowerCase().includes(query));
    $("appointment-list").replaceChildren();
    A.state("appointments-state", filtered.length ? "" : appointments.length ? "No bookings match these filters." : "No bookings yet. Choose a pickup slot to get started.");
    for (const item of filtered) {
      const card = A.node("article", "appointment-card"), header = A.node("div", "pickup-topline");
      header.append(A.node("span", "pickup-reference", `Booking ${A.reference(item)}`), A.badge(item.status)); card.append(header);
      card.append(A.node("h3", "", A.date(A.start(item), { weekday: "long" })), A.node("p", "", `${A.time(A.start(item))} – ${A.time(A.end(item))} · UTC+08:00`));
      const facts = A.node("dl", "pickup-facts");
      for (const [label, value] of [["Pickup type", A.type(item)], ["Spaces reserved", [1, 2].includes(item.occupiedCapacity) ? item.occupiedCapacity : "Not provided"], ["Friend", item.helperStudentId || (item.proxyCount === 0 ? "None" : "Not provided")]]) {
        const block = A.node("div"); block.append(A.node("dt", "", label), A.node("dd", "", value)); facts.append(block);
      }
      card.append(facts);
      if (item.status === "BOOKED") {
        const button = A.node("button", "danger-button", "Cancel booking"); button.type = "button"; button.disabled = !canCancel(item); button.dataset.cancelId = item.id;
        button.addEventListener("click", async () => {
          if (A.locked || !canCancel(item)) return;
          if (!await A.confirm("Cancel this pickup?", `Booking ${A.reference(item)} will be cancelled. All spaces reserved by this booking, including any friend’s space, will be released.`, "Cancel booking")) return;
          await A.mutate(button, async () => {
            const updated = await A.api.cancelAppointment(item.id);
            if (updated.status !== "CANCELLED") throw { code: "INVALID_RESPONSE" };
            appointments = appointments.map((old) => String(old.id) === String(item.id) ? { ...old, ...updated } : old);
            render(); A.notify("Your booking has been cancelled.", "success");
          }, "Cancelling…");
        });
        card.append(button);
        card.append(A.node("p", "", item.cancelBefore ? `Cancellation deadline: ${A.date(item.cancelBefore)} · ${A.time(item.cancelBefore)}.` : canCancel(item) ? "Cancellation is subject to your pickup deadline." : "This booking can no longer be cancelled."));
      }
      $("appointment-list").append(card);
    }
  }
  $("status-filter").addEventListener("change", render); $("booking-search").addEventListener("input", render);
  A.init(async () => { appointments = (await A.api.getAppointments()).sort((a, b) => (Date.parse(b.createdAt ?? A.start(b)) || 0) - (Date.parse(a.createdAt ?? A.start(a)) || 0)); render(); });
})();
