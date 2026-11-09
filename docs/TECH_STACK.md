# 技术栈与选择依据

## 结论

本项目采用“原生浏览器前端 + Express 单体 API + PostgreSQL”的单仓库结构。该方案足够覆盖课程要求，同时能让两名 Developer 分别负责界面和后端/数据库，并通过清晰接口并行工作。

## 选型

| 层级 | 选择 | 用途与理由 |
| --- | --- | --- |
| 前端 | HTML5、CSS3、Bootstrap 5、原生 JavaScript | 无额外构建链，表单和响应式页面可快速完成；稳定的元素定位也便于 Selenium POM。 |
| 后端 | Node.js 22 LTS、Express 5、JavaScript ESM | 适合 REST API、表单处理和服务端校验；前后端都使用 JavaScript，降低协作成本。 |
| 数据库 | PostgreSQL 16、`pg`、SQL migrations | 事务和行锁适合验证“最后一个名额只能由一人预约”、邀请码单次占用等并发规则。 |
| 身份认证 | `express-session`、PostgreSQL session store、`bcrypt` | 使用服务器端会话；密码只保存强哈希，退出后会话失效。 |
| 安全基线 | `helmet`、参数化 SQL、角色中间件 | 支持输入校验、常见响应头、SQL 注入防护和 Student/Staff/Admin 权限验证。 |
| 单元与 API 测试 | Vitest、Supertest | 覆盖服务端校验、状态转换、权限和错误响应，无需启动真实浏览器。 |
| 系统测试 | Python、pytest、Selenium 4、Page Object Model | 满足作业对 Selenium 与 POM 的要求，并保留执行日志和截图证据。 |
| 性能测试 | Apache JMeter | 作业指定工具；测试注册/登录以及至少一个额外功能，报告平均值、p90、p95、p99、吞吐量和错误率。 |
| 协作 | GitHub Issues、Pull Requests、GitHub Actions | 让需求、提交、测试和缺陷可追踪，并保留每名成员的贡献证据。 |

## 为什么不先用 React 或微服务

作业重点是验证、缺陷发现、修复证据和性能测试，而不是前端框架复杂度。首版使用原生页面可减少构建、路由和部署问题。单体应用也更容易在有限时间内复现缺陷、运行 Selenium 与 JMeter，并维护需求到测试的追踪关系。

## 与需求的对应关系

| 需求/作业要求 | 技术支持 |
| --- | --- |
| 注册、登录、服务端校验 | Express 路由、中间件、session、bcrypt；注册验证 Username、唯一 Email、密码强度与 Confirm Password，登录保留 v1 指定的 Student ID + Password |
| 时段容量不得超卖 | PostgreSQL 事务、锁或原子条件更新、集成测试、JMeter 并发场景 |
| 同一预约最多代取两人 | 数据库约束 + service 层校验 + 边界值测试 |
| 邀请码不可猜测、不可重复使用 | `crypto` 安全随机值、只存哈希、唯一约束、事务状态更新 |
| 越权访问返回 403 | 服务端 role/ownership middleware + Supertest |
| 至少 4 个预设缺陷 | 本地 `docs/private/` Bug Log；公开仓库只保留无内容模板 |
| 外部组系统测试 | 可访问部署、虚构测试账号、一页用户指南、稳定测试选择器 |
| 贡献证据 | Issue、分支、commit、PR、review、个人 weekly logbook |

## 建议的接口边界

- `frontend/` 只负责展示、输入提示和调用 `/api/*`。
- `backend/src/routes/` 定义 HTTP 路由，不直接写 SQL。
- `backend/src/services/` 实现容量、授权与状态转换等业务规则。
- `database/` 管理结构变更与虚构测试数据。
- `tests/` 按 unit、integration、selenium、jmeter 分开保存，测试证据可追踪到 FR/TC/BUG ID。

## 待小组确认

- 每个时段默认 30 分钟、容量 10 人。
- 代取两人仍只占预约人的一个时段名额。
- 每位学生最多持有一笔未来有效预约。
- 邀请码 24 小时有效、单次使用。
- 预约开始前 30 分钟停止自行取消。
- 时段结束 15 分钟后未签到才可标记 No-show。

这些值应在编码前记录为正式决策，以免测试预期与实现不一致。
