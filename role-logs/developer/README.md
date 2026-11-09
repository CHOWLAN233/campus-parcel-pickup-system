# Developer

Owners:

- Developer A — 具体模块待组内确认
- Backend Developer — 后端/API/数据库

主要负责登录/注册、额外功能、服务端校验、数据库事务、预设缺陷、缺陷修复与复测。每名 Developer 必须在日志中标明自己负责的功能和缺陷 ID。

主要交付物：

- Frontend, backend and database source code
- Hidden seeded-defect log stored outside the public repository
- Fix log with root cause, change and re-test result
- Named evidence for owned functions, defects and Pull Requests

Backend Developer 的范围见 [backend-responsibilities.md](backend-responsibilities.md)。前后端接口必须先约定请求、响应和错误码，再分别实现。
