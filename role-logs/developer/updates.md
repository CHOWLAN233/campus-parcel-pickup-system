# Developer Updates

Owners: Developer A; Backend Developer

| Date | Week | Public member label | Work and linked ID | Evidence | Result/Status | Issues | Mistakes and lessons | Next action | Leader initials |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-10 | Week 7 | Developer A | Completed the registration, login, and Overview pages. | `frontend/` | Done | Switching between the registration and login pages sometimes caused garbled text. | Identified page navigation and text encoding issues that need further debugging. | Fix the page switching and garbled text issues. | |
| 2026-11-09 | Week 7 | Backend Developer | Backend scope confirmed from internal SRS v1 | `role-logs/developer/backend-responsibilities.md` | Done | Business-rule defaults still require team confirmation | Separate confirmed requirements from suggested defaults before implementation | Define API contract and database schema |  |
| 2026-11-10 | Week 7 | Backend Developer | Aligned public repository with SRS v1.1 (`FR-00`–`FR-14`) | `docs/requirements/SRS-v1.1-baseline.md`, `docs/api-contract.md` | Done | Cancellation/date/no-show boundaries remain unconfirmed | A Working Baseline must preserve unresolved decisions instead of silently choosing defaults | Draft ERD, `schema.sql`, `seed.sql`, then implement auth/slots/booking transaction |  |
