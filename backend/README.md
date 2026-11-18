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

P0 and P1 are implemented in the feature branch, including cancellation, staff handover, invitation lifecycle, no-show handling, slot administration and audit. See the [API contract](../docs/api-contract.md) for the provisional rules and endpoints.

For local role testing, register two fictional accounts first, then assign roles from the machine running the backend:

```sh
npm run dev:role -- STU0004 STAFF
npm run dev:role -- STU0005 ADMIN
```

The helper runs only in development and works only on registered whitelist accounts. Sign in as each account to use the staff and admin pages. No-show correction and audit history can be exercised through the API. Existing databases gain the audit reason column on open without replacing records.

`BOOKING_START_OFFSET_DAYS=0` and `BOOKING_DAYS=3` are provisional local settings matching the current frontend. They do not settle the SRS date-window question. Use a stable `SESSION_SECRET` in `.env`: it signs session cookies and keys invitation-code HMACs; changing it invalidates existing sessions and unbound codes.
