# 协作规范

## 分支

- `main`：可演示、可发布版本，只接受 Pull Request。
- `develop`：日常集成分支。
- `feature/<issue>-<name>`：新功能。
- `fix/<issue>-<name>`：缺陷修复。
- `test/<issue>-<name>`：测试脚本或测试数据。
- `docs/<issue>-<name>`：文档与追踪记录。

## 提交与 Pull Request

提交信息使用 `type(scope): summary`，例如：

```text
feat(appointment): reject booking when slot is full
test(auth): add invalid password cases
fix(invitation): prevent a third helper binding
docs(traceability): link FR-04 to TC-03 and TC-05
```

每个 Pull Request 必须说明：

1. 对应的需求、Issue 或缺陷 ID。
2. 做了什么和为什么。
3. 如何验证以及实际结果。
4. 数据库、接口或截图是否发生变化。
5. 作者 GitHub 用户名或公开角色标签；姓名与 Student ID 只保存在课程私有记录中。

禁止直接向 `main` 推送。合并前至少需要一名非作者审查，并确保自动检查通过。

## 需求和缺陷追踪

- 功能需求：`FR-xx`
- 非功能需求：`NFR-xx`
- 测试用例：`TC-xx`
- 缺陷：`BUG-xx`

缺陷报告至少包含环境、严重程度、优先级、复现步骤、预期结果、实际结果和证据。公开修复记录使用 GitHub 用户名或角色标签；Developer 姓名与 Student ID 只进入课程私有记录。

## 敏感和隐藏资料

- 只使用虚构学生与包裹数据。
- `.env`、真实凭据、session secret 和数据库导出不得提交。
- 预设缺陷及隐藏 Bug Log 保存在 `docs/private/`，并按作业要求单独上传 Moodle；不要通过公开 Issue、commit message 或 PR 描述提前泄露。
- 不要故意加入可被利用的严重安全漏洞。

## Definition of Done

一个功能完成必须同时满足：

- 服务端实现相应业务规则和权限校验。
- 正常、错误和边界场景已有测试。
- 相关测试通过，且没有提交真实或敏感数据。
- README、接口说明或追踪矩阵已同步。
- Pull Request 已审查并关联 Issue。
