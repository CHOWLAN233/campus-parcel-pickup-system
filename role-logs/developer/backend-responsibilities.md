# Backend Developer Responsibilities

Owner: Backend Developer (identity stored in private course records)

依据小组内部 SRS v1，负责后端 API、数据库、业务约束、权限与后端测试。共享文档访问链接和协作邀请信息不得提交到仓库。

## P0 Implementation

- `FR-00` 注册/初始化：验证 Student ID/Username、唯一 Email、密码强度和 Confirm Password，只保存密码哈希。
- `FR-01` 登录/退出：Student ID + Password、服务器端 session、退出后会话失效。
- `FR-02` 时段查询：返回日期、开始/结束时间、容量、已预约人数、剩余名额和状态。
- `FR-03` 创建预约：生成唯一预约号，拒绝过期、关闭或冲突时段。
- `FR-04` 容量限制：在一个 PostgreSQL 事务内完成余量检查与创建；并发抢最后一个名额时最多一人成功。
- `FR-05` 我的预约：只返回当前登录用户的有效和历史预约。
- `FR-07` 邀请码：使用安全随机值，只保存哈希，不在日志中输出明文。
- `FR-08` 绑定代取：校验邀请码所有者、有效期、状态、重复使用和本人使用。
- `FR-09` 最多代取两人：服务层与数据库约束共同拒绝第三名，不影响已有绑定。

## P1 Implementation

- `FR-06` 取消预约与名额释放。
- `FR-10` Staff 签到和完成领取，记录操作人员。
- `FR-11` No-show 记录和学生查询。
- `FR-12` 管理时段、容量和开放状态。
- `FR-13` 邀请码撤销、过期和使用后失效。
- `FR-14` 预约、取消、授权、签到和违约修正的审计日志。

## Database Ownership

- 维护 `users`、`pickup_slots`、`appointments`、`pickup_authorizations`、`appointment_helpers`、`no_show_records`、`audit_logs`；`parcels` 为可选表。
- 使用 migration 管理结构，使用 seed 生成虚构账号、时段和包裹数据。
- 使用外键、唯一约束、检查约束和事务作为最终数据边界，不只依赖前端判断。
- 完成软取消和状态历史；不得物理删除已经完成或违约的预约记录。

## API and Security

- 路由只处理 HTTP；业务规则放在 service 层；SQL 使用参数化查询。
- Student、Staff、Admin 权限与资源所有权全部在服务器端检查。
- 错误响应使用稳定状态码和可理解消息，不暴露 SQL、密码哈希、邀请码或 stack trace。
- `.env`、数据库导出、真实账号、session secret 和隐藏 Bug Log 不得提交。

## Verification Evidence

- 为正常、错误、边界、状态转换、越权和并发场景编写 Vitest/Supertest 集成测试。
- 每个 API 和测试关联 `FR-xx`、`NFR-xx`、`TC-xx` 或 `BUG-xx`。
- 缺陷修复记录根因、修复内容、复测结果、commit/PR 和公开角色标签；姓名/Student ID 只进入课程私有记录。

## Decisions Required Before Coding

- 时段长度与容量。
- 代取是否只占预约人的一个名额。
- 每名学生允许同时持有的有效预约数量。
- 邀请码有效期与状态变更时机。
- 取消截止时间与 No-show 判定时间。
