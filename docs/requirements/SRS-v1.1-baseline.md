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

1. Whether the future 3-day window includes today and its exact server-time boundaries.
2. Whether cancellation closes 24 hours before start or at 23:59 on the previous calendar day.
3. Whether a user may collect only for another student without collecting their own parcel.
4. Conflict handling when an invitation owner already has an active appointment for that slot.
5. Whether an invitation represents a student or a specific fictional parcel.
6. Whether a reserved invitation remains reserved until collection and how cancellation releases it.
7. The exact time and correction workflow for `NO_SHOW`.

Until decided, these items must not be hard-coded as final acceptance criteria.
