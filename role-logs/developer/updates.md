# Developer Updates

Owners: Developer A; Backend Developer

| Date | Week | Public member label | Work and linked ID | Evidence | Result/Status | Issues | Mistakes and lessons | Next action | Leader initials |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-10 | Week 7 | Developer A | Completed the registration, login, and Overview pages. | `frontend/` | Done | Switching between the registration and login pages sometimes caused garbled text. | Identified page navigation and text encoding issues that need further debugging. | Fix the page switching and garbled text issues. | |
| 2026-11-09 | Week 7 | Backend Developer | Backend scope confirmed from internal SRS v1 | `role-logs/developer/backend-responsibilities.md` | Done | Business-rule defaults still require team confirmation | Separate confirmed requirements from suggested defaults before implementation | Define API contract and database schema |  |
| 2026-11-10 | Week 7 | Backend Developer | Aligned public repository with SRS v1.1 (`FR-00`–`FR-14`) | `docs/requirements/SRS-v1.1-baseline.md`, `docs/api-contract.md` | Done | Cancellation/date/no-show boundaries remain unconfirmed | A Working Baseline must preserve unresolved decisions instead of silently choosing defaults | Draft ERD, `schema.sql`, `seed.sql`, then implement auth/slots/booking transaction |  |
| 2026-11-13 | Week 7 | Backend Developer | Reviewed the supplied 10 Nov frontend handoff, imported only source files and mapped its `/api` calls (`FR-00`–`FR-09`) | `frontend/js/api.js`, `docs/frontend-integration.md` | Done locally | Frontend archive included unrelated browser/cache data, excluded from import | Use the frontend's real request layer as the integration contract; do not copy archive artifacts | Implement and verify core backend |  |
| 2026-11-13 | Week 7 | Backend Developer | Built SQLite schema/fictional seed, persistent sessions, auth and slot APIs (`FR-00`–`FR-02`) | `database/schema.sql`, `database/seed.sql`, `backend/src/`, `backend/test/api.test.js` | Done locally | SA3 asks for Email, but final SRS/frontend registration only send Student ID and password; team chose to leave conflict unresolved | Keep Email nullable/unique in schema and record `DEC-01`; no invented final rule | Confirm registration contract with team |  |
| 2026-11-13 | Week 7 | Backend Developer | Implemented transaction-protected normal/proxy booking, invitation issue and own lists (`FR-03`–`FR-05`, `FR-07`–`FR-09`) | `backend/src/services/booking.js`, `backend/test/api.test.js` | Done locally | Date-window start, cancellation and bound invitation lifecycle remain pending | Use configurable local date window; do not implement disputed P1 transitions | Add pending P1 rules after sign-off |  |
| 2026-11-13 | Week 7 | Backend Developer | Verified local API tests and real frontend registration → login → booking → own list | `backend/test/api.test.js`, `backend/README.md` | 8 API tests passed; browser flow passed | Mac Node 25 works, but Vitest declares Node 22/24/26 support; test listening needed an allowed local execution context | Validate with target Node 24 before deployment; keep all secrets and DB files Git-ignored | Review local changes and open a PR after team review |  |
| 2026-11-13 | Week 7 | Backend Developer | Uploaded the reviewed source to a separate branch and opened draft PR #2 | `feature/backend-foundation`, `https://github.com/CHOWLAN233/campus-parcel-pickup-system/pull/2` | Draft review open; `main` unchanged | Email and other pending rules remain in `DEC-01`–`DEC-06` | Keep incomplete P1 work explicit in the PR and wait for team review before merge | Confirm decisions and request reviewer feedback |  |

The implementation entries follow the actual sequence. The 10 Nov baseline is supported by the repository history; backend code and integration were performed on 13 Nov. No completion is claimed for 11–12 Nov because no dated evidence was available. This avoids backdating contributions while preserving the requested starting date.

## Backend PR log, 2026-11-13 to 2026-11-18

The reporting dates distribute milestones from the first backend PR through 18 Nov in implementation order. Entries allocated to 15–17 Nov were implemented and verified on 18 Nov.

| Reporting date | Public member label | Work and linked ID | Evidence | Status |
| --- | --- | --- | --- | --- |
| 2026-11-13 | Backend Developer | Published P0 backend and frontend integration | [PR #2](https://github.com/CHOWLAN233/campus-parcel-pickup-system/pull/2) | GitHub PR date |
| 2026-11-14 | Backend Developer | Merged backend foundation into main | PR #2, merge commit `4b9567d` | GitHub merge date |
| 2026-11-15 | Backend Developer | Cancellation, capacity and invitation release (FR-06) | Booking service and API tests | Allocated entry; implemented 18 Nov |
| 2026-11-16 | Backend Developer | Staff handover, invitation consumption/revocation and booking conflicts (FR-10, FR-13) | Booking service and staff API | Allocated entry; implemented 18 Nov |
| 2026-11-17 | Backend Developer | Automatic no-show, student history and staff correction with reason (FR-11) | Booking service and no-show API | Allocated entry; implemented 18 Nov |
| 2026-11-18 | Backend Developer | Admin slot creation and opening/closing; audited P1 transitions (FR-12, FR-14) | Admin API, audit schema and API tests | Implemented 18 Nov |
| 2026-11-18 | Backend Developer | Verified P0/P1, synced DEC-01–DEC-09 and updated [PR #3](https://github.com/CHOWLAN233/campus-parcel-pickup-system/pull/3) | API tests, decision log and SRS baseline | Provisional for review |
