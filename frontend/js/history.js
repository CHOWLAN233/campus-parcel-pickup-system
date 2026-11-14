/* 只展示服务端返回的违约记录；不在前端推导处罚、清除或申诉处理结果。 */
(() => {
  const A = window.ExpressBook, $ = A.find;
  A.init(async () => {
    const records = (await A.api.getNoShows()).sort((a, b) => (Date.parse(b.recordedAt ?? A.start(b)) || 0) - (Date.parse(a.recordedAt ?? A.start(a)) || 0));
    $("no-show-total").textContent = String(records.length);
    $("latest-no-show").textContent = records.length ? A.date(records[0].recordedAt ?? A.start(records[0])) : "None";
    $("history-body").replaceChildren(); $("history-wrap").hidden = !records.length;
    A.state("history-state", records.length ? "" : "No missed pickup records. Thanks for collecting on time.");
    for (const item of records) {
      const row = A.node("tr");
      for (const value of [item.appointmentNumber || (item.appointmentId !== undefined ? `#${item.appointmentId}` : "Not provided"), A.date(A.start(item)), `${A.time(A.start(item))} – ${A.time(A.end(item))}`, A.date(item.recordedAt)]) row.append(A.node("td", "", value));
      const status = A.node("td"); status.append(A.badge("NO_SHOW")); row.append(status); $("history-body").append(row);
    }
  });
})();
