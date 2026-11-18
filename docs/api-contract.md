# API Contract v1.1

The P0 endpoints are available locally. Cancellation (FR-06) is available with the provisional rule in DEC-03. The remaining staff, admin and invitation lifecycle extensions are pending. See [open decisions](requirements/decision-log.md).

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

## Staff/Admin P1

- `GET /no-shows/me`
- `POST /staff/appointments/:id/complete`
- `PATCH /admin/slots/:id`

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
