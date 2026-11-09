# Campus Parcel Pickup and Appointment System

SWE301 小组项目协作仓库。项目实现校园快递站的学生注册/登录、取件时段预约与容量限制，并以邀请码支持每次最多代取两名其他学生的包裹。

## 当前范围

第一阶段只实现可演示、可测试的核心流程：

1. 测试学生账号注册、登录和退出。注册包含 Student ID/Username、唯一 Email、Password 和 Confirm Password，并执行服务端校验；登录使用 Student ID + Password。
2. 查看取件时段、剩余名额并创建预约。
3. 服务端阻止超额预约和重复预约。
4. 生成并绑定邀请码；同一预约最多绑定两名他人。

取消预约、签到、违约记录和管理端属于后续阶段。项目仅使用虚构账号与包裹数据。

## 技术栈

- 前端：HTML5、CSS3、Bootstrap 5、原生 JavaScript（Fetch API）
- 后端：Node.js 22 LTS、Express 5、JavaScript ESM
- 数据库：PostgreSQL 16、`pg` 驱动、SQL migration/seed 脚本
- 登录与安全：`express-session`、PostgreSQL session store、`bcrypt`、`helmet`
- 后端测试：Vitest、Supertest
- 浏览器自动化：Python、pytest、Selenium 4、Page Object Model
- 性能测试：Apache JMeter（作业指定）
- 协作与持续集成：GitHub、分支 + Pull Request 工作流；代码建立后接入 GitHub Actions

详细选择依据见 [docs/TECH_STACK.md](docs/TECH_STACK.md)。

## 仓库结构

```text
frontend/                 页面、样式与浏览器端脚本
backend/                  API、业务逻辑、权限与事务
database/                 migration 与虚构测试数据
tests/unit/               单元测试
tests/integration/        API 与数据库集成测试
tests/selenium/           Selenium POM、用例与运行证据
tests/jmeter/             .jmx、测试数据与结果说明
docs/requirements/        需求摘要与追踪矩阵
docs/test-plan/           测试策略、计划和用例
docs/defects/             对外缺陷报告
docs/fix-log/             修复与复测记录
docs/logbooks/            每周个人贡献记录
docs/templates/           项目文档模板
docs/private/             不提交 Git 的隐藏缺陷资料
role-logs/                六个 SA3 角色的负责人、交付物与每周更新日志
```

## GitHub 协作起步

1. 从 `develop` 创建 `feature/<issue>-<short-name>` 分支。
2. 每次提交只处理一个明确问题，并在提交或 PR 中引用 Issue。
3. Pull Request 至少由另一名组员审查后再合并。
4. 需求、测试用例和缺陷使用稳定 ID，例如 `FR-03`、`TC-05`、`BUG-04`。
5. 每位成员在本地 `docs/logbooks/` 中保留自己的实名周记和 commit/PR 证据；该目录的个人文件不会上传公开仓库。
6. 每个角色在 [`role-logs/`](role-logs/) 中更新角色进度；个人周记与角色日志互相引用，但不互相替代。

完整规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 重要注意事项

- 隐藏 Bug Log 不得推送到公开仓库，也不能让外部测试组在 Phase 2 前看到。
- 不提交真实学号、真实密码、真实快递信息、`.env`、数据库文件或测试结果大文件。
- 容量检查与预约创建必须位于同一个数据库事务中；前端禁用按钮不能替代服务端校验。
- 邀请码与密码均不得明文持久化或写入日志。

## 下一步

确认待定业务规则后再创建可运行代码：时段长度和容量、取消期限、No-show 判定、邀请码有效期，以及每名学生允许同时持有的有效预约数。
