# API Contract v1.1

P0 and P1 are implemented in the P1 feature branch. The following provisional rules are open for team review in [DEC-01 through DEC-09](requirements/decision-log.md).

Base path: `/api`. JSON is used for requests and responses. Authentication uses an HttpOnly session cookie.

## MVP Endpoints

| Method and path | Request | Success | Main failures |
| --- | --- | --- | --- |
| `POST /auth/register` | `studentId`, `password` | `201` user | `400 INVALID_INPUT`, `409 ALREADY_REGISTERED` |
| `POST /auth/login` | `studentId`, `password` | `200` user + session cookie | `401 INVALID_CREDENTIALS` |
| `GET /auth/me` | session | `200` user | `401 UNAUTHORIZED` |
| `POST /auth/logout` | session | `204` | — |
| `GET /slots?date=YYYY-MM-DD` | date | `200` slots | `400 INVALID_DATE` |
| `POST /appointments` | `slotId`, optional `invitationCode` | `201` appointment | `409 SLOT_FULL`, `BOOKING_EXISTS`, invitation errors |
| `GET /appointments/me` | session | `200` appointments | `401 UNAUTHORIZED` |
| `POST /appointments/:id/cancel` | session | `200` appointment | `404 APPOINTMENT_NOT_FOUND`, `409 CANCEL_NOT_ALLOWED` |
| `POST /authorizations` | session | `201` code + expiry | `409` active-code conflict |

The MVP uses `POST /appointments` for normal and proxy bookings. Capacity allocation and invitation reservation must commit or roll back together. An endpoint that adds a helper after booking is an optional later extension and must not duplicate the same operation.

### Cancellation (provisional)

The owner can cancel at least 24 hours before the slot starts, including the exact cutoff. The appointment response includes `canCancel` and the UTC timestamp `cancelBefore`. Cancelling an already cancelled appointment returns its existing state. Capacity, invitation state and the successful cancellation audit event are updated in one transaction. A cancelled proxy booking retains its original capacity and proxy count; the removed invitation link lets an unexpired code be booked again.

## P1 Operations

| Method and path | Access | Contract |
| --- | --- | --- |
| `POST /authorizations/:id/revoke` | Student who issued the code | Revokes an unbound, unexpired code; returns `{ authorization }`. |
| `GET /no-shows/me` | Student | Returns `{ records }` for the appointment owner. |
| `GET /staff/appointments?reference=%231` | Staff or admin | Looks up a numeric reference with an optional # prefix; returns `{ appointment }` with handover eligibility and invitation status. |
| `POST /staff/appointments/:id/complete` | Staff or admin | Completes the whole booking during the slot and consumes its reserved invitation. Retries return the completed appointment. |
| `POST /staff/appointments/:id/correct-no-show` | Staff or admin | Requires `{ reason }` of 1–300 trimmed characters. Marks a missed pickup as completed, updates its linked code, and records the reason in audit history. |
| `POST /admin/slots` | Admin | Takes `startAt`, `endAt`, optional `status` and `capacity`. Creates a future, nonoverlapping one-hour slot with capacity 60. |
| `PATCH /admin/slots/:id` | Admin | Changes `status` to `AVAILABLE` or `CLOSED`; leaves capacity and existing bookings intact. |
| `GET /admin/audit-logs` | Admin | Returns up to 100 recent successful operations as `{ records }`. Automatic actions have a null actor. |

Times in API requests include a UTC offset or Z. The no-show cutoff is the slot end (inclusive). The server sweeps at startup and every minute; relevant queries also process elapsed bookings before returning results. Handover and correction retain historical slot occupancy.

## Stable Error Shape

```json
{
  "code": "SLOT_FULL",
  "message": "Not enough available spaces."
}
```

Required stable codes include `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `SLOT_FULL`, `BOOKING_EXISTS`, `INVALID_INVITATION`, `INVITATION_EXPIRED`, `INVITATION_USED`, `PROXY_LIMIT_EXCEEDED` and `CANCEL_NOT_ALLOWED`.

## Security Rules

- Return the same login error for unknown users and wrong passwords.
- Generate invitation codes with a cryptographically secure random source; store only a hash.
- Never log passwords, session secrets or plain invitation codes.
- Staff/Admin roles are seeded by the backend and cannot be self-selected during registration.
