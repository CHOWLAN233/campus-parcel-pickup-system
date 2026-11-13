# Frontend to backend integration, 2026-11-13

The supplied frontend archive was inspected and only its 25 `.html`, `.css`, and `.js` source files were imported into `frontend/`. Browser profiles, cache, screenshots and editor metadata in the archive were excluded. The imported files contain no detected embedded API keys, bearer tokens or external URLs.

`frontend/js/api.js` sends same-origin `fetch('/api/...')` requests with JSON, `credentials: 'same-origin'`, and `cache: 'no-store'`. Login expects an HttpOnly server session cookie, `{ user: { id, studentId, role } }`, and then opens `dashboard.html`. Registration does not establish a session. The frontend never reads or stores the session token.

| Frontend flow | Endpoint | Current backend state |
| --- | --- | --- |
| Registration/login/logout/me | `/api/auth/*` | Implemented |
| Today and future slot list | `GET /api/slots?date=YYYY-MM-DD` | Implemented; date window is provisional config |
| Own bookings and create | `GET /api/appointments/me`, `POST /api/appointments` | Implemented, including atomic 1/2-unit capacity |
| Issue/list invitation | `POST /api/authorizations`, `GET /api/authorizations/me` | Implemented; raw code returned only on issue |
| Cancel and revoke | `POST /api/appointments/:id/cancel`, `POST /api/authorizations/:id/revoke` | Pending rule decision |
| No-show, staff, admin | `/api/no-shows/*`, `/api/staff/*`, `/api/admin/*` | Later phase |

The backend generates an eight-character invitation code for additional guessing resistance; the frontend's example placeholder must match that length. No real invitation code is committed. The imported frontend's `file:` preview uses an in-memory demo; HTTP always calls the real API.

One assignment conflict remains open: the SA3 assignment alignment asks for a unique validated Email, while SRS v1.1 and the current frontend registration send only `studentId` and `password`. The team has not chosen a final rule. The current working API accepts the two fields and the schema leaves `users.email` nullable/unique so the team can resolve the requirement without discarding accounts. This is an implementation state, not a signed-off acceptance rule.
