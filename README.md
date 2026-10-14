# GradLink ZW

A mobile-first marketplace for Zimbabwean students and companies, backed by PostgreSQL.

## Local setup (the PostgreSQL already installed on your PC)

1. Create an empty PostgreSQL database named `gradlink_zw` using pgAdmin.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to the username/password for your local PostgreSQL server. Keep `.env` private; it is ignored by Git.
3. Install packages and apply the schema:

   ```powershell
   npm install
   npm run db:migrate
   ```

4. Start the API and Vite frontend:

   ```powershell
   npm run dev
   ```

   Open the Vite URL printed in the terminal. The Vite dev server proxies `/api` calls to the PostgreSQL API on port 3001.

The schema and starter task listings are in `server/schema.sql`. It is safe to run the migration more than once.

## Accounts

- Student and company accounts are created from the app's sign-up screen. Passwords are hashed before storage; sessions use HttpOnly cookies.
- Admin accounts cannot be registered publicly. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and optionally `ADMIN_NAME` in your private `.env`, then run:

  ```powershell
  npm run admin:create
  ```

  Remove `ADMIN_PASSWORD` from `.env` after the initial admin account is created.
- The API checks account roles for posting, applying, moderation, and policy changes. Browser-side controls are not the security boundary.

## Hosting PostgreSQL and deploying

This project is prepared for a hosted **Neon PostgreSQL** database and a **Render** web service. Neon hosts the database; Render hosts the API and built frontend together, so session cookies stay same-origin.

1. Push this project to a private or public GitHub repository. This workspace currently has no Git remote configured.
2. Create a PostgreSQL project in Neon and copy its pooled connection string. Keep the password private.
3. In Render, create a Blueprint from the repository. The included `render.yaml` sets up a free web service with build, migration, start, and health-check commands.
4. In Render's environment settings, set `DATABASE_URL` to the Neon connection string. Set `NODE_ENV` to `production`; the blueprint already declares it.
5. Deploy. The start command applies the database schema before starting the service. Check `/api/health` on the deployed URL.
6. Provision the first admin against the hosted database by running `npm run admin:create` in a trusted environment with the hosted `DATABASE_URL`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` set. Do not put the admin password in the public frontend or commit it.

The PostgreSQL server installed on your PC is for local development. A hosted service cannot reach `localhost` on your PC; production must use the Neon connection string (or another hosted PostgreSQL URL). I cannot create hosting accounts or access your credentials, but these files are ready for you to connect and deploy from your provider dashboards.

## Validation and persistence

- Server-side Zod checks validate registration, profile updates, task listings, applications, uploads, and policy changes.
- PostgreSQL constraints protect task budgets, work levels, application status/uniqueness, file types, and interview thresholds.
- Task listings, applications, profiles, policy settings, sessions, and certificate files are stored in PostgreSQL rather than browser storage.
- Certificates are limited to PDF/JPG/PNG files up to 5 MB.
- Sign-in and registration attempts are rate limited.
- `npm run build` builds the browser app and type-checks the API.
