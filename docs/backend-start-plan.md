# Backend Start Plan

Owner: Backend Developer (public role label only)

## Pull Request 1 — Foundation

Deliver a runnable backend foundation without implementing unresolved business rules:

1. Initialize Node.js/Express with ESM, environment validation and `/api/health`.
2. Add the SQLite connection with foreign keys enabled and a transaction helper.
3. Draft the ERD and create `database/schema.sql` for `users`, `pickup_slots`, `appointments`, `pickup_authorizations`, `appointment_helpers`, `sessions`, `no_show_records` and `audit_logs`.
4. Add `database/seed.sql` containing only fictional Student/Staff/Admin accounts and future slots.
5. Configure Vitest/Supertest and a temporary test database.
6. Document local setup and database reset commands.

Acceptance: a clean clone can install dependencies, create a test database, start the API, call `/api/health` and run the test suite without private data.

## Pull Request 2 — Auth and Slots

- Implement virtual Student ID whitelist registration and uniform login errors.
- Store bcrypt hashes; add server-side sessions and logout invalidation.
- Add Student/Staff/Admin authorization middleware.
- Implement `GET /api/slots?date=YYYY-MM-DD` with server-calculated `occupied` and `remaining`.
- Cover validation, duplicate registration, bad credentials, expired session and unauthorized access.

## Pull Request 3 — Atomic Booking

- Implement `POST /api/appointments` and `GET /api/appointments/me`.
- Enforce one future active appointment per student.
- Allocate 1 unit normally or 2 units with one valid invitation.
- Validate and reserve an invitation in the same SQLite transaction as the appointment.
- Add boundary and concurrent tests for 58/59/60 occupied units and repeated submissions.

## Pull Request 4 — Invitation Flow

- Implement `POST /api/authorizations` with a 1-hour binding deadline.
- Generate the raw code once, store only its hash, and never log it.
- Reject own, expired, used, revoked or already-reserved codes.
- Reject a second proxy while preserving the first binding and capacity.

## Blocked Until Team Decision

Do not finalize cancellation, date-window boundaries, reserved-invitation release or no-show timing until the pending decisions in `docs/requirements/SRS-v1.1-baseline.md` are resolved.
