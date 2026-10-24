# GradLink ZW Privacy Notice 

**GradLink ZW is a student presentation prototype created by Shane Munashe Chisweto. It is not currently operated as a public organisation or commercial service.** This notice is a project presentation draft, not a live-service privacy commitment. Prepared 24 October 2026 from the application code and schema in this repository; production Supabase configuration and deployment have not been independently inspected.

## 1. Who operates the service

GradLink is an academic prototype project created by **Shane Munashe Chisweto**, a student. It is not presented as an incorporated organisation or launched public service. Project contact: **shanchisweto@gmail.com** or **+263 773 180 399**. Address supplied for project contact: **62 Glenara Ave**.

## 2. Prototype status and intended demonstration

GradLink demonstrates a proposed marketplace for Zimbabwean students and companies. The prototype includes email/password account creation and sign-in through Supabase Auth. Google sign-in is available when configured in Supabase. The application code uses Google for authentication and does not call Gmail, Drive, Contacts, or other Google APIs. The demonstration is for evaluation and is not an invitation to submit real personal information.

Some student profile and package fields and interview-package CV files are connected to Supabase in the development project. The wider marketplace remains a prototype: task listings, applications, company information, certificates, verification files, and some preferences may be held in browser storage or demo application state. Records are not fully synchronized or protected by complete server-side access rules. For presentations, use fictional/demo information and do not upload real CVs, identity documents, payment details, or other sensitive information.

## 3. Information processed

Depending on how a person uses GradLink, the app may process:

- **Account information:** email address, password credential handled by Supabase Auth, authentication identifiers, name, and selected student/company workspace.
- **Student information:** name, school/course, location, field of study, account track, contact details, selected package, and CV file and file metadata when a student selects a Professional or Advanced package. The CV upload is stored in a private Supabase Storage bucket; its record includes an object path, filename, content type, size, version, and upload time.
- **Marketplace information:** task listings, budgets, applications, proposals, delivery estimates, submitted work, workflow statuses, reviews, feedback, and interview invitations. Most of this prototype information is currently stored in the browser rather than a shared GradLink database.
- **Company information:** company name, profile and contact details, task listings, and verification information/documents. These flows remain prototype features and may use browser storage.
- **Technical and preference information:** Supabase authentication/session data, theme, and ordinary connection data handled by the hosting and service providers. “Remember my email” stores the email in the current browser if selected.

The repository includes fictional/demo tasks and applications. Demo content is not evidence of real people, completed work, verified companies, or actual payment.

## 4. Purposes and recipients

Information is used to create and authenticate accounts, operate student and company workspaces, display the marketplace, manage task applications, and store an interview-track CV. Supabase processes authentication and, for enabled flows, database and private file storage. Google processes a sign-in request when selected. The hosting provider and its operational providers may process connection and service data; the production host and its settings must be confirmed.

A CV is not automatically shared with employers by the current application flow. The database design supports attaching a selected CV to an application, but the complete application interface and authorized employer-access flow have not yet been implemented. Do not assume employers can or cannot see an uploaded CV until the final flow is deployed and tested.

GradLink does not process task payments or hold money in the current prototype. A company’s “payment recorded” status is not proof that money was transferred.

## 5. Storage, access, and security

Supabase Auth stores and manages sign-in credentials and sessions according to the configured project. Interview CV files are intended for the private `student-cvs` Storage bucket, with owner-scoped paths and access policies. The operator must run the reviewed migration and verify the live Storage policies before collecting real CVs.

The wider marketplace is not yet fully migrated from browser storage. Browser records may be visible to another person using the same browser profile and may be lost if browser site data is cleared. UI filtering is not a security control. This draft does not promise complete account isolation, encryption configuration, backup behavior, or a particular hosting/database region; those settings have not been verified.

Google sign-in is intended to use only the basic identity, email, and profile scopes needed for authentication. Confirm the live Google consent screen and Supabase provider settings before launch.

## 6. Retention and user choices

GradLink has not yet established a complete retention schedule, account-wide deletion/export process, or operational privacy-request workflow. Users can edit some profile fields, but deleting a profile from the interface does not currently guarantee deletion of every Auth record, database row, browser record, uploaded file, backup, or provider log. The operator must set and implement those processes before publishing specific retention or deletion promises.

Subject to applicable law, questions or requests about access, correction, objection, or deletion may be sent to **shanchisweto@gmail.com** or **+263 773 180 399**. **[Establish and operate the request process before publication.]**

## 7. Children and eligibility

The operator must decide the minimum age and any guardian-consent process before launch. Zimbabwe's Data Protection Authority guidance discusses additional requirements when processing children's personal information. Do not use GradLink to collect children's data until the applicable requirements and safeguards have been reviewed.

## 8. Changes and contact

The operator will need to provide a practical way to notify users about material changes. Privacy contact: **Shane Munashe Chisweto, shanchisweto@gmail.com, +263 773 180 399**. **[Add an effective date after approval.]**

## 9. If the project becomes a live service

Before any public launch, identify the responsible controller and legal contact, confirm data-controller licensing and DPO obligations, lawful bases and purposes, minimum age, Google scopes, Supabase and hosting locations/processors, CV access and deletion behavior, retention schedule, user request process, breach process, cross-border arrangements, and actual data flows after marketplace migration. Obtain Zimbabwe-qualified legal review. This project draft is not legal advice or a compliance certification.

## References for review

- [Cyber and Data Protection Act [Chapter 12:07] (Veritas, gazetted text)](https://www.veritaszim.net/node/5522)
- [POTRAZ Data Protection Authority implementation guidelines](https://www.veritaszim.net/taxonomy/term/1023)
