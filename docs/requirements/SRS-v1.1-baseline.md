# SRS v1.1 Public Baseline

This is a privacy-safe implementation summary. The private source document, sharing link, member identities, student IDs and real credentials are intentionally excluded.

## Status

SRS v1.1 is a **Working Baseline**, not a fully frozen specification. The labels below are normative:

- **Confirmed**: may be implemented and tested as an acceptance rule.
- **Suggested**: a design proposal; keep configurable until confirmed.
- **Pending**: requires a team decision before becoming a formal acceptance rule.

## Confirmed MVP

- Virtual Student ID whitelist; no real campus authentication data.
- Student registration/login/logout using server-side sessions and password hashes.
- Query 1-hour pickup slots within the future 3-day window.
- Each slot has 60 capacity units.
- A normal appointment consumes 1 unit; an appointment carrying one other student's parcel consumes 2.
- A student may hold at most one future active appointment.
- Each appointment may carry for at most one other student. A second helper binding is rejected with no data change.
- An invitation code may be newly bound only within 1 hour of issue.
- Appointment creation, capacity allocation and optional invitation reservation are one atomic backend operation.
- SQLite contains only fictional test users, slots and parcel data.

## Priorities

| Priority | Scope |
| --- | --- |
| P0 | `FR-00` registration, `FR-01` auth, `FR-02` slots, `FR-03` booking, `FR-04` capacity, `FR-05` my appointments, `FR-07` invitation issue, `FR-08` invitation binding, `FR-09` one-proxy limit |
| P1 | `FR-06` cancellation, `FR-10` staff completion, `FR-11` no-show, `FR-12` slot administration, `FR-13` invitation lifecycle, `FR-14` audit logging |
| P2 | Statistics, notifications, password reset and visual polish |

## Core States

- Appointment: `BOOKED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`.
- Invitation: `ACTIVE`, `RESERVED`, `USED`, `EXPIRED`, `REVOKED`.
- Optional parcel: `READY`, `COLLECTED`.

## Pending Decisions

以下项目仍待小组确认。标注为已实现的行为用于开发和联调，暂不作为最终验收标准。 对应编号见 [待决事项](decision-log.md)。

| ID | 待决项 | 建议与当前状态 | 小组需确认 |
| --- | --- | --- | --- |
| DEC-01 | 注册 Email | SA3 要求 Email 唯一且格式正确，SRS 注册使用学号和密码。建议先维持现有接口，数据库保留可选且唯一的 Email。 | 确认是否要求 Email；如需提交，确认必填性和验收格式。 |
| DEC-02 | 三天预约窗口 | 建议按校园当地时间（UTC+8）计算今天及后两天，只能预约尚未开始的时段。现有开发配置默认采用该窗口。 | 确认是否包含今天、时区及日期和时段边界。 |
| DEC-03 | 取消与邀请码释放（FR-06） | 本次暂按开始前至少 24 小时允许取消，恰好 24 小时可取消。普通/代取归还 1/2 个容量单位，重复请求不重复归还。代取码未到原过期时间则恢复 ACTIVE，否则置 EXPIRED；不延长有效期。 | 确认采用提前 24 小时或前一日 23:59；确认邀请码按原有效期恢复的规则。 |
| DEC-04 | 代取范围和预约冲突（FR-08、FR-09） | 已暂按本人取件时最多代取一人实现；任一方已有未来有效预约（作为预约人或代取委托人）时拒绝重复占位。 | 确认能否只代取，以及冲突判定是同一时段还是任一未来有效预约。 |
| DEC-05 | 取件交接和邀请码生命周期（FR-10、FR-13） | 已暂按邀请码关联发码学生实现。发码人只能撤销未绑定且未到期的邀请码；1 小时限制只管首次绑定，绑定后保持 RESERVED。STAFF/ADMIN 在预约时段内按整笔确认，预约变为 COMPLETED，邀请码变为 USED。 | 确认学生或具体包裹、谁能确认、可确认的时段、部分领取如何处理、何时撤销或过期、交接要更新哪些记录。 |
| DEC-06 | 密码强度 | 暂沿用现有校验：8–128 字符，含数字和非字母数字字符。 | 确认最终长度、字符规则和前后端提示文案。 |
| DEC-07 | 未取件（FR-11） | 已暂按时段结束即判定，未取件记在预约人名下，代取码标为 EXPIRED。STAFF/ADMIN 填写原因后可更正为 COMPLETED，绑定码转为 USED，原判定与更正均保留审计事件。 | 确认是否设宽限期、未取件记在谁名下、谁能更正，以及更正后预约和邀请码如何处理。 |
| DEC-08 | 时段管理（FR-12） | 已暂按 ADMIN 创建未来、不重叠的一小时时段并开放或关闭实现。新时段固定 60，保留已有时段容量。关闭只阻止新预约，已有预约保留。 | 确认可调整的字段、已有预约时能否降容量，以及关闭是否影响已有预约。 |
| DEC-09 | 审计（FR-14） | 已暂按同一事务记录成功取消、撤销邀请码、交接、未取件判定和更正、时段创建及开关；更正保留原因。ADMIN 可查询最近 100 条；自动判定无人工操作者。 | 确认审计查看权限、需要记录的操作，以及是否需要记录失败结果。 |
