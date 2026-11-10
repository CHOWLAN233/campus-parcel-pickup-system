# Backend Developer Responsibilities

Owner: Backend Developer (identity stored in private course records)

依据小组内部 SRS v1.1 Working Baseline，负责后端 API、SQLite 数据库、业务约束、权限与后端测试。共享文档访问链接和协作邀请信息不得提交到仓库。

## P0 Implementation

- `FR-00` 注册/初始化：只允许白名单中的虚拟 Student ID 激活账号，拒绝重复注册，只保存密码哈希。
- `FR-01` 登录/退出：Student ID + Password、服务器端 session、退出后会话失效。
- `FR-02` 时段查询：返回日期、开始/结束时间、容量、已预约人数、剩余名额和状态。
- `FR-03` 创建预约：生成唯一预约号，拒绝过期、关闭或冲突时段。
- `FR-04` 容量限制：每时段 60 个容量单位；在一个 SQLite 事务内完成余量检查与创建，并发时始终保证 `occupied <= 60`。
- `FR-05` 我的预约：只返回当前登录用户的有效和历史预约。
- `FR-07` 邀请码：使用安全随机值，只保存哈希，不在日志中输出明文。
- `FR-08` 绑定代取：校验邀请码所有者、有效期、状态、重复使用和本人使用。
- `FR-09` 最多代取一人：普通预约 `capacity_units=1`，代取预约为 `2`；服务层与数据库约束共同拒绝第二名且不影响已有绑定。

## P1 Implementation

- `FR-06` 取消预约与名额释放。
- `FR-10` Staff 签到和完成领取，记录操作人员。
- `FR-11` No-show 记录和学生查询。
- `FR-12` 管理时段、容量和开放状态。
- `FR-13` 邀请码撤销、过期和使用后失效。
- `FR-14` 预约、取消、授权、签到和违约修正的审计日志。

## Database Ownership

- 维护 `users`、`pickup_slots`、`appointments`、`pickup_authorizations`、`appointment_helpers`、`no_show_records`、`audit_logs`；`parcels` 为可选表。
- 使用 `schema.sql` 管理结构，使用 `seed.sql` 生成虚构账号、时段和包裹数据；SQLite 数据库文件不得提交。
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

## Confirmed Before Coding

- 1 小时时段，容量 60；本人占 1，代取一人额外占 1。
- 每笔预约最多代取一人；每名学生同时最多一笔未来有效预约。
- 邀请码自签发起 1 小时内可绑定；必须安全随机、单次使用、只保存哈希。
- MVP 创建预约时通过 `POST /api/appointments` 同时提交可选邀请码，容量占用与邀请码预留原子完成。

## Decisions Still Required

- “未来 3 天”是否包含当天及精确起止时刻。
- 取消截止采用提前 24 小时还是前一个自然日 23:59。
- 是否允许只替别人取件，以及被代取学生已有预约时的冲突规则。
- 邀请码绑定后的保留/释放规则、No-show 精确判定时刻。
