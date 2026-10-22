# GradLink ZW — Application, Security and Privacy Audit

**Audit date:** 22 October 2026  
**Scope:** Repository files and source code only. No live Supabase dashboard, Google Cloud project, Vercel deployment, browser session, database, or production data was accessed. This is an implementation review, not a penetration test or legal opinion.

## Executive summary

GradLink is currently a React/Vite browser prototype with Supabase Auth calls for email/password and Google sign-in. The Auth client persists its session in the browser. The actual GradLink marketplace records do not use Supabase: the app stores them in `localStorage` and uploaded certificate/verification files in IndexedDB on that browser origin. The repository contains no database schema/migrations, RLS policies, Supabase Storage configuration, server/API routes, privacy policy, or terms of service.

Consequently, the current application does not provide server-enforced multi-user isolation for profiles, tasks, applications, workspaces, or documents. UI filtering and checks are not authorization boundaries. The same browser origin can expose the prototype data to other users of the same browser profile, and browser developer tools can alter it. The hidden admin entry and admin login are also presentation-only: the admin submit handler explicitly reports that authentication is not connected.

Google authentication requests no additional scopes or Google APIs in app code. The app invokes Supabase `signInWithOAuth` for `google` without a `scope` override or Google API calls. The Google Cloud consent configuration and Supabase provider settings are external and could not be verified here. Supabase's Google setup documentation identifies `openid`, email, and profile as the basic login scopes; the live provider configuration must be checked to confirm it has not been expanded.

**Launch assessment:** Do not use the current prototype to collect real CVs, identity/company registration documents, payment account details, private applications, or messages from real users. First move records/files to a backend with per-user authorization, restrict the admin path, verify provider configuration, and establish user-facing privacy and support processes. No code or live data was changed for this audit.

## Feature inventory

| Category | Current state |
|---|---|
| Implemented in this repository | React/Vite client; Supabase Auth SDK initialization from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; email/password sign-up and sign-in calls; Google OAuth redirect call; Supabase session persistence and auth-state listener; sign-out call; local profile editing; local tasks/applications/workflow; local certificate and company-document upload, preview/download, and removal; local company-verification and task-moderation UI; theme and account preference persistence. These are code-path observations, not confirmation of live provider configuration or production reliability. |
| Partial or unverified | Supabase sign-up/sign-in behavior depends on live project settings (email confirmation, provider enablement, allowed redirects, rate limits, recovery flow). Google sign-in depends on Google OAuth client and Supabase provider setup. Profile/marketplace actions persist only on one browser origin. File checks run in the browser and inspect extension/MIME/size, not the true file contents. Company verification and task review are local status changes. Authentication may establish a session, but does not authorize the prototype's local data by account. Deployment on Vercel and its headers/domain/environment configuration are unverified. |
| Not implemented | GradLink database tables or migrations; RLS policies; backend/server routes; account-linked shared data; Supabase Storage; CV/resume upload; private/public profile controls; messaging/chat; deletion of GradLink accounts and associated data; data export; privacy policy/terms links; reporting/blocking; real employer verification evidence and controlled review audit trail; role-secure admin authentication; production retention/deletion process; production authorization tests. |

## Authentication and security

### Google scopes and token use

- `src/App.tsx` calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } })`.
- No explicit scopes are requested in the app. No Gmail, Drive, Contacts, Calendar, or other Google API client/call was found. No code stores or uses a Google provider token to call Google APIs.
- Supabase Auth creates the GradLink auth session; the client is initialized with session persistence, auto-refresh, and URL session detection. Supabase's Auth tokens are handled by the SDK in the browser. Actual token/session storage settings and the Google consent configuration were not inspected in the hosted project.
- Supabase's current Google guide says to configure `openid`, `userinfo.email`, and `userinfo.profile`; inspect the Google Auth Platform Data Access screen and Supabase provider settings before approval/deployment. Keep the integration limited to those login scopes.
- The app's Google client secret should exist only in Supabase provider configuration. Vite `VITE_*` values are frontend-visible by design. The source reads only the Supabase URL and publishable/anon key. No service-role key reference was found in source, but the local `.env` contents and hosted environment values were deliberately not read.

### Auth flow and authorization findings

- Email/password methods call Supabase `signUp` and `signInWithPassword`; Google uses Supabase OAuth; sign-out calls `supabase.auth.signOut`. Sign-up without an immediate session displays an email-confirmation message. Password reset, email change, account deletion, and user-facing session/device management are absent.
- When Supabase is not configured, `authLoading` starts false and `welcomePageOpen` starts false, so the app can render the student prototype workspace without requiring sign-in. This is another reason the prototype must not be treated as an authenticated production service.
- Workspace identity is stored in `user_metadata.account_type` and browser `localStorage`. The app also has a mutable local account selector/state and workspace-specific UI. Supabase documents `user_metadata` as user-editable; it must not determine privileged authorization.
- The app data itself is local and is not queried from Supabase. There are no server operations, data tables, or RLS policies to enforce account-level permissions. Student/company conditionals are UX only.
- Five taps on the welcome logo open the admin login form. Its submit action only shows “Admin authentication is not connected yet.” The admin workspace and its moderation actions are client-side; account state is persisted in browser storage. This is not a secure admin gate.
- Application mutation handlers perform useful UI checks (such as status transitions and matching IDs), but these checks run entirely in the client and can be bypassed or altered by changing browser state/code.
- Some errors are surfaced to the user, and generic storage failures are logged. No password logging was found. Supabase error messages are displayed directly; sanitize them if they could contain implementation detail.

### Access-control review

| Resource/action | Current enforcement | Finding |
|---|---|---|
| Student/company profiles | Browser state/storage and UI | Not associated with authenticated user ID; no private/public visibility setting or backend owner check. |
| Tasks and applications | Client-side filters and handlers | A shared local store on that browser origin; no server-side employer/student ownership check. Seed/demo records are mixed with live local edits. |
| Certificates and company documents | Browser IndexedDB | Files are local to the browser origin/profile, not uploaded to a server. No account ownership, role authorization, or remote access policy exists. This does not establish a secure private document vault. |
| CV/resume | None found | No CV upload or access path found. Portfolio is a user-supplied URL. |
| Chat/workspaces | None found | No messaging feature or workspace membership data model found. |
| Company verification | Local form/status and IndexedDB | Uploaded document is stored locally; “verified” values include hard-coded demo companies. No reliable reviewer identity/audit trail or independent verification evidence can be validated. |
| Admin moderation | Client-only workspace | No verified admin identity, backend role, server-side checks, or audit log. Treat as unauthenticated prototype UI. |

Supabase RLS and Storage protections are provider capabilities, not verified properties of this project. No project migrations, policies, or bucket configuration are present in the repository.

## Personal-data inventory

| Data category | Source/purpose | Current storage | Who can access/share it today | Deletion/export status |
|---|---|---|---|---|
| Email, password, provider identity, auth metadata (name and account type/company name) | Account creation/sign-in | Supabase Auth, as configured; session in browser SDK storage. Workspace/profile details may also be held in local app storage. | Supabase Auth processes sign-in data; Google participates in Google sign-in. GradLink application data is not server-synchronized. Actual retention, region, logs, backups, and project settings not verified. | No in-app account deletion/export or documented retention process. |
| Student name, school/course, location, field, track, email, phone, profile photo | Profile and earning setup | Profile record/avatar in `localStorage`; account email and name/workspace metadata may also be sent to Supabase Auth | Any person able to use/inspect the same browser profile and origin can access local records. No visibility/access controls. Other profile details are not synchronized to a GradLink application backend. | Profile editing exists; full profile deletion/export does not. Browser removal/clearing is not a product deletion process. |
| Payment provider and payment account/phone number | Earning setup/profile | `localStorage` | Same-browser/origin exposure described above. No payment integration or payment transfer found. | Editable; no account-level deletion/export process. Avoid collecting real payout details until storage/security and necessity are addressed. |
| Certificate/qualification files and metadata (filename, size, MIME label, upload date) | Student proof wallet | Binary file in IndexedDB; metadata in `localStorage` | Local browser origin/profile. No employer sharing workflow found. | Individual removal exists in the UI. No account-wide cleanup/export or retention schedule. |
| Company legal name, registration number, business email, contact name/phone, document filename, external URL, status, submission time | Company verification prototype | Record/metadata in `localStorage`; document binary in IndexedDB | Local browser origin/profile; no server reviewer or real separation by company. External URL can be opened by user/admin UI. | Local status update/rejection exists; no reliable account-wide deletion/export. |
| Task listings, budgets, skills, descriptions, deadlines, company labels and moderation state | Marketplace prototype | Seed bundle and `localStorage` | Shared local app data in the browser profile; no backend visibility policy. | Admin-like UI can remove task and related applications locally; no durable server delete. |
| Applications and workflow (student ID/name, study field/track, proposal, delivery estimate, portfolio URL, status/timestamps, submitted work, employer feedback, rating, payment-recorded status) | Applying to and completing prototype tasks | `localStorage`, with seed/demo records | Shared local app data in the browser profile; there is no participant-only messaging or backend access rule. Portfolio links are opened externally. | Local withdrawal/removal of task-linked data is partial; no user export/account deletion/retention process. |
| Theme, selected workspace, package, remembered email, read-candidate IDs | App preferences | `localStorage` | Same browser profile/origin | Some settings can be changed; there is no consolidated data-access/delete tool. Remembered email is stored in plain origin storage. |
| Technical/operational data | Browser runtime, Supabase Auth, hosting/network | Not fully inspectable from repository | Supabase and hosting/network providers may process their service logs. Vercel deployment and log settings were not available for review. No analytics package or custom analytics calls were found. | Provider settings/retention not verified. |

The application loads remote payment-provider logo images from Innbucks, Googleusercontent, and Wikimedia URLs. Those image requests disclose ordinary network metadata to the respective host; no payment API integration was found. The package file includes Supabase Auth and UI libraries, not an analytics/advertising SDK.

## Privacy/terms accuracy table

No Privacy Policy or Terms of Service document or in-app link was found in the repository. The following common claims must not be made as current facts:

| Statement or promise | Evidence in code/repository | Status | Recommended action |
|---|---|---|---|
| Google login uses only basic scopes | App passes no explicit scope and makes no Google API calls; live Google consent screen unavailable | Partially supported in code; live config unverified | Verify only `openid`, email, profile in Google/Supabase settings; do not add unrelated scopes. |
| CVs are private by default | No CV upload, server storage, bucket, or access policy | Incorrect if stated as a feature | Do not claim CV storage exists; implement private storage with participant-aware access before launch. |
| Users can delete their accounts and all associated data | No account deletion flow; app data is local and not linked to Auth UUID | Incorrect | Build authenticated deletion flow plus cleanup for profile, files, applications, auth user, and backups/retention exceptions. |
| CVs/files deleted within 30 days | No CV system, server retention job, or published schedule | Unverified/unsupported | Do not promise a fixed period until storage providers, backups, and deletion jobs support it. |
| Inactive accounts anonymized after 24 months | No inactivity scheduler or anonymization code | Unsupported | Do not publish. Decide and implement retention rules first. |
| Users can export their data | No export flow | Incorrect | Implement authenticated machine-readable export and test coverage. |
| Employer verification is performed | UI accepts registration details/documents; hard-coded demo “verified” records exist; admin actions are local | Partially implemented prototype; real verification unverified | Label as prototype; create reviewer process, evidence standards, decision records, and truthful public status before using “verified.” |
| Messages are private | No chat/message implementation found | Unsupported | Do not claim messaging or message privacy. Add only after participant-scoped authorization and retention are designed. |
| Data is encrypted at rest/in transit | No relevant deployment/provider configuration inspected | Unverified | Confirm provider/hosting transport and encryption settings and obtain accurate provider documentation; avoid absolute guarantees. |
| Only the account owner can see/change their data | App state is client-side and shared within one browser profile; no RLS/server authorization | Incorrect for prototype | Implement server-side ownership and RLS, then test across two accounts and roles. |
| Payment is processed/held by GradLink | UI explicitly says no transfer is made; payment status is manually recorded | Incorrect | Say payments are not connected and GradLink does not hold/transfer funds in this prototype. |
| Admin account is secured | Hidden logo gesture; admin auth handler is unconnected | Incorrect | Remove admin access from production until server-verified admin roles, MFA, audit trails, and route/API controls exist. |

## Draft documents

The proposed drafts are in [`draft-privacy-policy.md`](draft-privacy-policy.md) and [`draft-terms-of-service.md`](draft-terms-of-service.md). They deliberately describe the prototype limitations and contain operator/contact placeholders. They are not approved legal documents and should not be published until the responsible legal entity, contact route, provider configuration, data flows, lawful bases, and actual retention/deletion operations are confirmed.

## Prioritized implementation roadmap

### Launch-critical — before real users or sensitive data

1. **Choose and document the controller/operator.** Confirm legal entity/name, contact details, purpose and lawful basis per processing activity, data subject request path, applicable licensing/DPO obligations, cross-border processing, and the product's controller/processor roles. Get Zimbabwe privacy and consumer-law review.
2. **Build backend data model and ownership.** Add migrations for profiles, companies, listings, applications, reviews/status events, and membership/roles, all keyed to Supabase Auth UUID. Add constraints and indexes. Remove seed/demo records from production data paths.
3. **Enforce RLS and least privilege.** Enable RLS for every exposed table. Define explicit read/insert/update/delete policies and grants per role. Employer access should be limited to applicants for their listings and only fields justified by the workflow; students should see their own applications and their profile; public listing/profile fields need explicit publication choices. Admin permissions must use trusted server-controlled claims/roles—not `user_metadata` or client state.
4. **Secure file storage.** Use private Supabase buckets with restrictive MIME/size limits and per-owner paths/policies. Separate public profile images from private certificates and company documents. Use short-lived signed downloads only after authorization. Validate size/type on the server and inspect actual content; define malware handling and safe preview/download headers.
5. **Replace local application data with authenticated backend calls.** Scope queries/mutations to the signed-in user or verified company. Recheck all workflow transitions in a trusted server/RPC/database policy. Do not trust browser storage for task ownership, payment status, verification, tier, or role.
6. **Secure and verify authentication.** Verify Supabase email confirmation, password policy, rate limits, redirect allowlist, Google consent scopes/branding, and account linking. Add password recovery and account deletion. Decide how company/student workspace type is assigned and prevent self-escalation. Protect admin with a trusted role, MFA, and server-side authorization.
7. **Provide account controls and truthful notices.** Implement correction, export, deletion, privacy/terms access, consent/notice records where needed, and a workable privacy contact path. Establish data retention/deletion jobs and legal holds before stating periods.
8. **Before Vercel launch, review deployment.** Confirm production domain, environment variable boundaries, HTTPS, security headers/CSP, redirect allowlist, preview deployments, logs, error reporting, and provider-region/cross-border arrangements. No deployment configuration was available in this checkout.

### Later, after secure core

- Add opt-in profile visibility and controlled CV sharing with a clear revoke path.
- Add reporting/blocking and abuse/suspicious-post workflows with triage, evidence access limits, and appeal handling.
- Add chat only with participant checks, abuse controls, retention/deletion rules, and reporting.
- Add a real employer-verification procedure and review audit trail; clearly distinguish evidence reviewed from guarantees about an employer.
- Add user-facing activity/session controls, notification preferences, and data access history if justified by the product.

## Test plan and measurable acceptance criteria

The repository has no test script or test suite. The following are proposed tests; they were not run as part of this read-only audit.

| Area | Acceptance criteria |
|---|---|
| Auth lifecycle | Sign-up, confirmation, sign-in, Google sign-in, sign-out, password reset, expired session, and provider errors produce correct states; a failed/mismatched workspace cannot expose a workspace. Test local and production callback URLs. |
| Auth roles | A normal user cannot create/modify admin role claims, access admin routes or invoke admin operations by editing metadata, localStorage, or direct API requests. Admin role assignment is restricted to trusted server-side operations. |
| RLS isolation | With two student accounts and two companies, direct REST/SDK requests cannot read or mutate another owner's private profile, application, task, verification record, or file. Positive intended sharing is separately tested. Test anon and authenticated grants/policies for each CRUD operation. |
| Employer access | Company A can see only applications to Company A listings and only approved fields; cannot enumerate other companies' applicants or download unrelated files. |
| Student access | Student A can see/edit/export/delete only their own private account data and permitted public records; cannot change another student's application or status. |
| Storage | Unauthenticated and wrong-owner access fails; authorized signed links expire; MIME/size/content validation rejects malformed, oversized, mismatched, and active-content files; deleting a user removes or schedules all linked objects. |
| Deletion and export | Export includes all data categories and linked files or explains omissions; deletion removes account-linked data according to a documented schedule, reports any retained records/legal basis, and is idempotent. Verify provider/backups treatment before promising full deletion. |
| Abuse/reporting | Reporting/blocking actions persist; a blocked user cannot contact/reach the reporter through covered surfaces; moderators see only necessary report evidence; decision and appeal events are auditable. |
| Privacy copy | Every statement about data, visibility, sharing, processing, retention, deletion, verification, and payment matches tested behavior and named providers; no unresolved placeholders remain before publication. |
| Deployment | Production has HTTPS, restrictive origins, correct environment variables, no service-role key in built assets/source maps, safe security headers, and no sensitive payloads in client/server logs. |

## Human decisions and legal review required

- Confirm who operates GradLink (legal name/entity, jurisdiction, public contact address/email) and whether this entity is a data controller/service provider for each flow.
- Confirm whether this is a prototype-only demonstration or whether any real users/data already exist in Supabase, local browsers, or Vercel. This audit did not inspect those services.
- Decide what profile fields are public, visible to matched employers, or private; whether payment account/phone details are necessary before an earning is due; and what fields an employer sees before acceptance.
- Decide company verification evidence, reviewer qualifications, correction/appeal process, and whether the product will make any representation about employer trustworthiness.
- Set retention and deletion periods, operational owners, legal hold exceptions, export format, support workflow, backup treatment, breach response, and cross-border processor terms.
- Confirm Google consent configuration and Supabase project Auth settings; confirm deployment provider, production domain, Supabase region, and whether required Zimbabwe licensing/DPO steps apply.
- Have Zimbabwe counsel review the drafts for the Cyber and Data Protection Act [Chapter 12:07], its applicable regulations/guidelines, and the Consumer Protection Act [Chapter 14:44], including whether marketplace/payment representations create additional obligations.

## Sources checked

- [GradLink repository README](../README.md), [Supabase client](../src/lib/supabase.ts), [application source](../src/App.tsx), [types](../src/types.ts), [seed data](../src/data.ts), `.env.example`, `.gitignore`, `package.json`, `vite.config.ts`, `index.html`.
- [Supabase: Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: Auth users and metadata](https://supabase.com/docs/guides/auth/users)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Zimbabwe Cyber and Data Protection Act, Chapter 12:07](https://www.ictministry.gov.zw/assets/documents/Cyber-and-Data-Protection-Act-Chapter-1207.pdf)
- [Zimbabwe Consumer Protection Act, Chapter 14:44](https://www.mic.gov.zw/wp-content/uploads/2025/02/Consumer-Protection-Act-2019.pdf)
- [POTRAZ Data Protection Authority implementation guidelines](https://www.veritaszim.net/node/7966)
