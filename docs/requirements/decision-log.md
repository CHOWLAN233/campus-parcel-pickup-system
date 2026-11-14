# Open implementation decisions

| ID | Question | Current local treatment | Status |
| --- | --- | --- | --- |
| DEC-01 | SA3 Email uniqueness/format versus SRS `studentId` + password registration | `users.email` is optional and unique; no Email field is demanded by the current frontend or API | Team discussion pending |
| DEC-02 | Whether the 3-day window includes today and its exact boundaries | Local config defaults to today plus two days (`BOOKING_START_OFFSET_DAYS=0`, `BOOKING_DAYS=3`) | Team discussion pending |
| DEC-03 | Cancellation cutoff and invitation release after cancellation | Cancellation endpoint not yet implemented | Team discussion pending |
| DEC-04 | Whether only-for-another pickup is allowed; issuer's own booking conflict | No separate only-for-another flow in the current API; proxy booking uses one collector and one issuer | Team discussion pending |
| DEC-05 | Bound invitation expiry, no-show timing/correction, and staff handover | No automatic expiry of `RESERVED`, no no-show job or staff handover yet | Team discussion pending |
| DEC-06 | Final password length and strength wording | Local policy is 8–128 characters with a digit and a non-alphanumeric character; frontend currently relies on backend validation | Team discussion pending |

Do not mark provisional behavior as a final SRS acceptance criterion until the group signs it off.
