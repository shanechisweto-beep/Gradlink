# GradLink ZW Privacy Notice — Working Draft

**Draft only — not approved for publication.** This draft describes the browser prototype inspected on 22 October 2026. It must be updated after the operator, production configuration, and legal bases are confirmed. Do not publish with bracketed placeholders. It is not legal advice or a statement of legal compliance.

## Who operates GradLink

GradLink is operated by **[insert verified legal name and entity type]** (“GradLink,” “we,” or “us”). Privacy contact: **[insert monitored contact email and postal/business address]**. Do not publish until these details and the applicable data-controller role are confirmed.

## Scope and current product status

GradLink is currently a browser-based prototype for student and company workspaces. Marketplace profiles, task listings, applications, company-verification submissions, certificates, and payment details are stored in the browser that is using the app. They are not currently synchronized to a GradLink application database in this prototype. Supabase Auth is used for account sign-in when configured. A production launch may change these data flows; this notice must be revised before launch.

The app does not currently provide CV/resume uploads, in-app chat, a user data export, or an in-app account deletion workflow. A portfolio field accepts a link supplied by the user; opening that link takes the user to the linked third-party site.

## Information processed

Depending on the prototype features a person uses, information may include:

- **Account and sign-in information:** email address, password credential handled by Supabase Auth, authentication provider identifiers, and account metadata such as a name and selected student/company workspace. GradLink's app code sends basic account name/workspace metadata to Supabase Auth. Google sign-in is initiated through Supabase Auth.
- **Student profile and earning setup:** name, school/course, location, field of study, account track, email, phone, profile image, selected package, and payment-provider/account or phone details.
- **Student-submitted work information:** certificate/qualification files and file metadata; task application proposal, delivery estimate, portfolio URL, task status, submitted work, and related timestamps.
- **Company information:** company display/legal name, registration number, business email, contact name and phone, a registration document or public website/Facebook link, task descriptions, budgets, and listing status.
- **Marketplace workflow information:** application statuses, reviews/ratings, company feedback, interview invitations, and whether a company marked a payment as recorded. The prototype does not transfer or hold payment funds.
- **Preferences:** theme, selected workspace, remembered email if the user selects “Remember my email,” package selection, and notification/read state.

The prototype also contains fictional/demo task, application, company, and profile data. It should not be mistaken for actual user submissions or verified organizations.

## Where information is stored and who receives it

- **Browser storage:** app profiles, marketplace records, preferences, and some company/student metadata are kept in `localStorage`. Uploaded certificate and company verification files are kept in browser IndexedDB. This is storage in the current browser profile and origin, not a private server account. People with access to that browser profile or device may be able to access it. Clearing browser site data may remove it, but is not a request to GradLink to delete an account or server record.
- **Supabase Auth:** when authentication is configured, Supabase processes account credentials, sign-in events, provider identity, and session-related data to authenticate users. The live project's region, retention, logs, backups, configuration, and contractual settings have not been verified for this draft.
- **Google:** when a user chooses Google sign-in, Google processes the authentication request. The app code does not call Gmail, Drive, Contacts, or other Google APIs and does not request those integrations. The live Google consent scopes must be verified; the intended scope is limited to the basic identity, email, and profile needed to sign in.
- **External image hosts:** payment-provider logo images are loaded from Innbucks, Googleusercontent, and Wikimedia-hosted URLs. A browser request to those hosts may disclose ordinary connection information such as IP address and browser details to those hosts.
- **Hosting provider:** the intended deployment is Vercel, but production deployment and its logs/settings were not verified during this repository audit. Confirm the actual host and its privacy/security terms before launch.

The prototype code contains no custom analytics integration or advertising SDK. Provider-level operational logs and retention settings have not been inspected and should not be described as absent.

## How information is used

In this prototype, the app uses information to display the selected workspace, maintain profile and task forms, filter marketplace listings, track application workflow, show uploaded local documents, and demonstrate the authentication flow. Supabase Auth uses credentials and provider information to create and manage sign-in sessions. No payment processing, money transfer, CV distribution, or in-app messaging service is implemented.

## Visibility and sharing

The prototype does not have backend access controls or profile visibility settings. Its local app records are available to users of the same browser profile and origin; they are not isolated by GradLink accounts in a server database. Company/student views filter some information in the interface, but this is not a security boundary. Certificates and company documents are not uploaded to a GradLink server in the inspected code. Do not upload real identity, company registration, or sensitive documents to a shared device or treat the prototype as a private document vault.

## Security and international processing

Supabase Auth and the browser provide security features, but this repository audit did not verify the live provider configuration, encryption settings, server logs, backups, region, or deployment controls. This notice therefore makes no blanket encryption, private-file, retention, or deletion guarantee. Confirm the location and terms of every production processor and any cross-border transfers before launch.

## Retention and deletion

The prototype has no published retention schedule, inactivity deletion job, or account-wide deletion function. Browser-stored information may remain until the user removes it or clears the browser's site data; this is not a guaranteed retention period. Supabase Auth records are subject to the configured Supabase project and its applicable settings, which have not been inspected. Do not rely on this prototype for a promise that data will be deleted within a fixed time.

Users can edit some profile fields and remove individual certificates in the interface. These controls do not delete an Auth account or all associated browser/provider records. **[Before publication, insert a monitored process for access, correction, export, objection/other applicable rights, account deletion, and complaints.]**

## Children's data

**[Operator decision and legal review required: specify minimum age and process for handling children’s/young people’s data, consistent with applicable Zimbabwe law and the service’s intended audience.]** Do not publish a guessed age rule.

## Changes and contact

**[Insert process for policy changes and how users will be notified.]** For privacy questions or requests, contact **[verified contact details]**. No privacy-request channel is currently implemented in the app.

## Before this notice can be used

Confirm the operator/controller, lawful bases and purposes, live Google scopes, Supabase/hosting regions and retention, browser versus server data flows, account/data deletion procedures, user-rights contact, cross-border arrangements, minimum age, incident process, and applicable regulatory obligations. Obtain review from Zimbabwe-qualified counsel. This draft is not legal approval.
