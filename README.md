# GradLink ZW

A mobile-first React marketplace prototype for Zimbabwean students and SMEs.

## Theme
Black `#0A0A0A`, blue `#146BFF`, white `#FFFFFF`, with light neutral surfaces.

## Run
```bash
npm install
npm run dev
```

Then open the local Vite URL.

## Production build
```bash
npm run build
```

## Supabase authentication

Copy `.env.example` to `.env.local` and set the project URL and publishable/anon key from **Supabase Dashboard → Project Settings → API**:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Restart the Vite dev server after changing environment variables. Never put a Supabase `service_role` key in this client app.

In Supabase **Authentication → URL Configuration**, add your local app URLs (`http://localhost:5173` and `http://127.0.0.1:5173`) and your deployed origin to the redirect allow list. Enable email/password under **Authentication → Sign In / Providers**. Email confirmation behavior is controlled by the Supabase project's email settings.

To enable Google, configure a Google OAuth web client and enter its client ID and secret under Supabase **Authentication → Sign In / Providers → Google**. Set the Google authorized JavaScript origin to the app origin and the authorized redirect URI to the callback URL shown on that Supabase provider page. The app redirects back to its current origin after Google authentication.

The app uses Supabase Auth for email/password account creation and sign-in, Google OAuth, and persisted sessions. Google sign-in requires the Google provider to be configured in Supabase. Student profile/package fields and Professional/Advanced CV uploads are being saved to Supabase. Task listings, applications, company records, certificates, and some preferences remain in browser storage and are not yet synchronized across users/devices.

## Legal drafts

- [Privacy Notice — review draft](docs/draft-privacy-policy.md)
- [Terms of Service — review draft](docs/draft-terms-of-service.md)

These documents contain unresolved operator and product decisions. Have them reviewed and complete their placeholders before publishing or relying on them as final terms.

## Local prototype data

Task and application data use React state + browser localStorage.

## Main flows
- Live task search and skill filters
- Task detail
- Application modal with validation and live applicant count
- Student proof wallet/profile
- Company task posting
- New tasks appear at the top of the feed
- Data survives refresh via localStorage
