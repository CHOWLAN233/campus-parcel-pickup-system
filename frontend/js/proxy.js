/* 授权码只保存在当前页面内存；不放入 URL、日志或浏览器持久化存储。 */
(() => {
  const A = window.ExpressBook, $ = A.find;
  let authorizations = [], current, timer, generationUnknown = false;
  const expired = (item) => Date.parse(item.expiresAt) <= Date.now();
  const ongoing = (item) => item.status === "RESERVED" || (item.status === "ACTIVE" && !expired(item));

  function updateClock() {
    if (!current) return;
    const seconds = Math.max(0, Math.ceil((Date.parse(current.expiresAt) - Date.now()) / 1000));
    $("countdown").textContent = current.status === "ACTIVE" ? seconds ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "Binding window elapsed" : current.status === "RESERVED" ? "Bound to a booking" : "No longer available";
    $("generate-button").disabled = generationUnknown || authorizations.some(ongoing);
    $("copy-button").disabled = current.status !== "ACTIVE" || expired(current) || !current.invitationCode;
    $("revoke-button").disabled = current.status !== "ACTIVE" || expired(current) || current.id === undefined;
  }

  function render() {
    $("authorization-list").replaceChildren();
    A.state("codes-state", authorizations.length ? "" : "No invitations yet. Generate one when a friend is ready to book.");
    current = authorizations.find(ongoing) || authorizations[0];
    $("authorization-details").hidden = !current;
    if (current) {
      $("authorization-status").replaceChildren(A.badge(current.status));
      $("current-code").value = current.invitationCode || "Not available";
      $("expires-label").textContent = `Bind before ${A.date(current.expiresAt)} · ${A.time(current.expiresAt)} (UTC+08:00).`;
      $("authorization-note").textContent = current.status === "RESERVED" ? "This invitation is bound to a booking. The issuing window does not decide the validity of an already bound collection." : !current.invitationCode ? "For privacy, the original code may be shown only when issued. You can revoke an active invitation and generate a replacement." : current.id === undefined ? "Revocation is not available for this invitation. Contact the parcel station if needed." : "The countdown is a guide; invitation validity is checked when your friend books.";
    }
    for (const item of authorizations) {
      const row = A.node("li"); row.append(A.node("span", "", `Expires ${A.date(item.expiresAt)} · ${A.time(item.expiresAt)}`), A.badge(item.status)); $("authorization-list").append(row);
    }
    clearInterval(timer); timer = setInterval(updateClock, 1000); updateClock();
  }

  $("generate-button").addEventListener("click", async () => {
    if (A.locked || generationUnknown || authorizations.some(ongoing)) return;
    if (!await A.confirm("Generate an invitation?", "Give the code to the friend who will collect for you. It must be bound to their pickup booking within one hour.", "Generate code")) return;
    await A.mutate($("generate-button"), async () => {
      let item;
      try { item = await A.api.createAuthorization(); }
      catch (error) { if (["NETWORK_ERROR", "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(error.code)) generationUnknown = true; throw error; }
      if (item.status !== "ACTIVE") throw { code: "INVALID_RESPONSE" };
      authorizations.unshift(item); render(); A.state("authorization-state", ""); A.notify("Invitation generated. Share it with your collecting friend.", "success");
    }, "Generating…");
    updateClock();
    if (generationUnknown) { $("generate-button").disabled = true; A.notify("The invitation result is not yet confirmed. Refresh to check your invitation activity before generating another.", "error"); }
  });

  $("copy-button").addEventListener("click", async () => {
    if (!current || current.status !== "ACTIVE" || expired(current) || !current.invitationCode) return;
    try { await navigator.clipboard.writeText(current.invitationCode); A.notify("Invitation code copied.", "success"); }
    catch { $("current-code").focus(); $("current-code").select(); A.notify("The code is selected. Press Ctrl+C or use your device’s Copy action."); }
  });
  $("revoke-button").addEventListener("click", async () => {
    if (A.locked || !current || current.status !== "ACTIVE" || expired(current) || current.id === undefined) return;
    const target = current;
    if (!await A.confirm("Revoke this invitation?", "Your friend will no longer be able to bind this code. Generate a new invitation if you need help later.", "Revoke invitation")) return;
    await A.mutate($("revoke-button"), async () => {
      const updated = await A.api.revokeAuthorization(target.id);
      if (updated.status !== "REVOKED") throw { code: "INVALID_RESPONSE" };
      authorizations = authorizations.map((item) => item === target ? { ...item, ...updated } : item);
      render(); A.notify("Invitation revoked.", "success");
    }, "Revoking…");
    updateClock();
  });
  window.addEventListener("pagehide", () => clearInterval(timer));
  A.init(async () => {
    authorizations = []; current = undefined; clearInterval(timer);
    $("authorization-details").hidden = true;
    $("current-code").value = "";
    $("authorization-list").replaceChildren();
    $("generate-button").disabled = generationUnknown;
    try {
      authorizations = (await A.api.getAuthorizations()).sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt));
      generationUnknown = false;
      A.state("authorization-state", ""); render();
    } catch (error) {
      if (error.code === "UNAUTHORIZED") throw error;
      // 查询本人授权列表在 SRS 中为可选接口；失败不伪造空记录，也不阻断发码。
      A.state("authorization-state", `Couldn't load invitations. ${A.errorText(error)}`, true);
      A.state("codes-state", "Invitation activity is currently unavailable.", true);
    }
  });
})();
