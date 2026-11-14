/* 集中维护尚待小组确认的日期窗口，不把假设散落到各页面。
 * 当前默认含今天连续三天；若决定从明天开始，将 offset 改为 1。
 * 服务端仍需独立验证窗口、截止时间、名额和权限。
 */
window.ExpressBookConfig = Object.freeze({
  timeZone: "Asia/Kuala_Lumpur",
  bookingStartOffsetDays: 0,
  bookingDays: 3,
});
