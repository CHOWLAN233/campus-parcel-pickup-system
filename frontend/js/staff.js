/* 仅 Staff/Admin 可进入；完成出库前必须确认核对，服务端仍需再次检查权限与授权。 */
(() => {
  const A = window.ExpressBook, $ = A.find;
  let current;
  function updateButton() { $("complete-button").disabled = !current || current.status !== "BOOKED" || current.authorizationValid === false || !$("staff-verified").checked; }
  function render() {
    $("staff-result").hidden = !current;
    $("staff-verified").checked = false;
    if (!current) { updateButton(); return; }
    $("staff-status").replaceChildren(A.badge(current.status));
    $("staff-details").replaceChildren();
    const facts = A.node("dl", "pickup-facts");
    for (const [label, value] of [["Booking", A.reference(current)], ["Collector", current.studentId || "Not provided"], ["Date", A.date(A.start(current))], ["Time", `${A.time(A.start(current))} – ${A.time(A.end(current))}`], ["Pickup type", A.type(current)], ["Spaces reserved", current.occupiedCapacity ?? "Not provided"], ["Friend", current.helperStudentId || (current.proxyCount === 0 ? "None" : "Not provided")], ["Authorization", current.proxyCount === 0 ? "Not required" : current.authorizationStatus || "Not provided"]]) {
      const block = A.node("div"); block.append(A.node("dt", "", label), A.node("dd", "", value)); facts.append(block);
    }
    $("staff-details").append(facts);
    if (current.authorizationValid === false) $("staff-details").append(A.node("p", "soft-note", "The authorization is not valid. Do not hand over a friend’s parcel."));
    if (current.status !== "BOOKED") $("staff-details").append(A.node("p", "soft-note", "This booking is not awaiting collection. No further handover can be confirmed."));
    updateButton();
  }
  $("staff-verified").addEventListener("change", updateButton);
  $("staff-reference").addEventListener("input", () => { A.fieldError("staff-reference", ""); current = undefined; render(); });
  $("staff-search-form").addEventListener("submit", async (event) => {
    event.preventDefault(); if (A.locked) return;
    const reference = $("staff-reference").value.trim();
    A.fieldError("staff-reference", reference ? "" : "Enter a booking reference.");
    if (!reference) { $("staff-reference").focus(); return; }
    current = undefined; render();
    $("staff-reference").disabled = true;
    await A.mutate($("staff-search-button"), async () => {
      current = await A.api.findStaffAppointment(reference); render(); A.state("staff-state", "");
    }, "Finding…");
    $("staff-reference").disabled = false;
  });
  $("complete-button").addEventListener("click", async () => {
    if (A.locked || !current || current.status !== "BOOKED" || !$("staff-verified").checked || current.authorizationValid === false) return;
    const target = current;
    if (!await A.confirm("Confirm parcel handover?", `Booking ${A.reference(target)} will be marked completed${target.proxyCount === 1 ? " and the bound invitation marked used" : ""}. Confirm only after all parcels have been handed over.`, "Confirm handover")) return;
    $("staff-reference").disabled = true; $("staff-verified").disabled = true;
    await A.mutate($("complete-button"), async () => {
      let updated;
      try { updated = await A.api.completeAppointment(target.id); }
      catch (error) { if (["NETWORK_ERROR", "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(error.code)) { current = undefined; render(); A.state("staff-state", "The handover result is not confirmed. Look up the booking again before retrying.", true); } throw error; }
      if (updated.status !== "COMPLETED") throw { code: "INVALID_RESPONSE" };
      current = { ...target, ...updated }; render(); A.notify("Parcel handover confirmed.", "success");
    }, "Confirming…");
    $("staff-reference").disabled = false; $("staff-verified").disabled = false; updateButton();
  });
  A.init(async () => { current = undefined; render(); A.state("staff-state", "Enter a booking reference to begin."); });
})();
