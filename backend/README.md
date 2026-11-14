# Backend local setup

Run from `backend/` on a supported Node.js release (the project target is Node 24 on the NAS):

```sh
npm ci
cp ../.env.example .env
# Replace SESSION_SECRET in .env with a unique random value of at least 32 characters.
npm run db:init
npm test
npm start
```

Open `http://127.0.0.1:3000/login.html`. The frontend and `/api` are served from the same origin. The development seed contains only fictional whitelist IDs `STU0001`–`STU0005` and future one-hour slots. Register one of those IDs with a password of 8–128 characters containing a digit and a non-alphanumeric character. No Staff/Admin credentials are included in the public seed.

The database is stored at `backend/data/parcel-pickup.sqlite` by default and is Git-ignored. Run `npm run db:init` on later days to add the next development slots without deleting existing records. Never copy real student, parcel, password, session or invitation data into this database.

Implemented now: health, virtual-student registration, login/logout/session, slot query, own appointment list, atomic normal/proxy booking, invitation issue and own invitation list. Cancellation, staff handover, no-show and admin editing are pending team decisions and later implementation. See [frontend integration](../docs/frontend-integration.md).

`BOOKING_START_OFFSET_DAYS=0` and `BOOKING_DAYS=3` are provisional local settings matching the current frontend. They do not settle the SRS date-window question. Use a stable `SESSION_SECRET` in `.env`: it signs session cookies and keys invitation-code HMACs; changing it invalidates existing sessions and unbound codes.
