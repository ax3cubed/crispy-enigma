Deployment — Postgres on Railway
================================

This project defaults to SQLite for local development but must use a Postgres
database in production (Railway, Heroku, etc.) to avoid native SQLite binaries
that may be incompatible with the host OS.

Quick steps
-----------

1. Provision a Postgres database on Railway (or any managed provider).
2. Add the connection string to the project's environment variables on Railway.
   - Preferred for the application DB: `APP_DATABASE_URL`
   - Preferred for the LTI plugin: `LTI_DB_URL` (falls back to `DATABASE_URL`)
   Example connection string: `postgres://user:password@host:5432/dbname`
3. Add LTI-related environment variables (see below).
4. Optionally migrate existing local SQLite data to Postgres using the provided
   script: `npm run migrate:sqlite-to-postgres -- path/to/app.db`.

Required environment variables
------------------------------

- `APP_DATABASE_URL` or `DATABASE_URL` — Postgres connection string used by the
  application (assessments, rubrics, scores). If `APP_DATABASE_URL` is set it
  will be preferred; otherwise `DATABASE_URL` is used.
- `LTI_DB_URL` or `DATABASE_URL` — Postgres connection string used by ltijs
  (LTI data). If `LTI_DB_URL` is set it will be preferred; otherwise
  `DATABASE_URL` is used.
- `LTI_KEY` — the tool key used by ltijs. The code provides a default insecure
  value for local dev; change this in production.
- Platform registration (to pre-register the LMS platform; optional but
  convenient): `PLATFORM_URL`, `PLATFORM_CLIENT_ID`, `PLATFORM_AUTH_ENDPOINT`,
  `PLATFORM_TOKEN_ENDPOINT`, `PLATFORM_JWKS_URL`.
- Optional DB SSL toggles: `DB_SSL=true` and `DB_SSL_REJECT_UNAUTHORIZED=false`
  (if your provider requires explicit SSL options).

Migration notes
---------------

- The repository contains a helper script at `scripts/migrate-sqlite-to-postgres.js`
  to copy data from a local `app.db` SQLite file into a Postgres database.
- Usage example (from project root):

```
npm run migrate:sqlite-to-postgres -- path/to/app.db
```

This will:
- create the required Postgres tables if they don't exist,
- copy `rubrics`, `rubric_criteria`, `assessments`, and `scores` into Postgres,
- use `ON CONFLICT DO UPDATE` to avoid duplicate primary-key insert errors.

After migration
---------------

- Ensure `APP_DATABASE_URL` (and `LTI_DB_URL` if separate) are set in Railway.
- Deploy the app; it will use Postgres in production and run Postgres migrations
  automatically at startup.

If you want help provisioning a Railway Postgres instance and configuring env
vars, tell me and I can create step-by-step instructions for your Railway
project.
