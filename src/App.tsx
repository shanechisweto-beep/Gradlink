import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Bell,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CircleCheck,
  CircleDollarSign,
  ChevronRight,
  CircleUserRound,
  FileText,
  Globe,
  Diamond,
  Clock3,
  Grid2x2,
  GraduationCap,
  Home,
  Link2,
  Layers3,
  LogOut,
  MapPin,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Monitor,
  Phone,
  Search,
  ShieldCheck,
  Shield,
  Save,
  Sun,
  Star,
  Trash2,
  Target,
  UnlockKeyhole,
  Upload,
  UserRound,
  Users,
  X,
  Zap,
  Sparkles,
  Wallet,
  type LucideIcon
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./lib/supabase";
import {
  SKILL_OPTIONS,
  type Application,
  type InterviewPolicy,
  type Skill,
  type StudentTrack,
  type Task,
  type WorkLevel
} from "./types";
import { seedApplications, seedTasks } from "./data";

const KEY = "gradlink-zw-v2";
const ACCOUNT_KEY = `${KEY}-workspace-account`;
const PENDING_AUTH_WORKSPACE_KEY = `${KEY}-pending-auth-workspace`;
const READ_NOTIFICATIONS_KEY = `${KEY}-read-notifications`;
const THEME_KEY = "gradlink-appearance";
type ThemePreference = "light" | "dark" | "system";
const CURRENT_STUDENT_ID = "student-default";

function loadWorkspaceAccount(): AccountType {
  try {
    const saved = localStorage.getItem(ACCOUNT_KEY);
    return saved === "company" || saved === "admin" ? saved : "student";
  } catch { return "student"; }
}

function loadThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  } catch (error) {
    console.warn("Could not read appearance preference", error);
    return "system";
  }
}
const fieldOptions: Array<"All" | Skill> = ["All", ...SKILL_OPTIONS];
type AccountType = "student" | "company" | "admin";
type CompanyVerificationStatus = "not-verified" | "pending" | "verified";
type CompanyVerification = { companyName: string; status: CompanyVerificationStatus; registrationNumber?: string; legalName?: string; businessEmail?: string; documentName?: string; documentFileId?: string; documentLink?: string; contactName?: string; contactPhone?: string; submittedAt?: string };
type Store = { tasks: Task[]; applications: Application[]; policy: InterviewPolicy; companyVerifications: CompanyVerification[] };
type StudentProfileData = { name: string; school: string; location: string; studyField: Skill; track: StudentTrack; email?: string; phone?: string; avatarDataUrl?: string; paymentProvider?: "Inbucks" | "Omari" | "EcoCash"; paymentNumber?: string };
type CertificateMeta = { id: string; name: string; size: number; type: string; uploadedAt: string };
const workLevels: WorkLevel[] = ["Entry level", "Intermediate"];
const interviewLevels: WorkLevel[] = ["Professional", "Advanced"];
const levels: WorkLevel[] = [...workLevels, ...interviewLevels];
const defaultPolicy: InterviewPolicy = { studentCompletedTasks: 10, companyFilledTasks: 10, minimumInterviewInvites: 5 };
const defaultCompanyVerifications: CompanyVerification[] = ["Tariro Pharmacy", "Gateway Church Mabelreign", "Nyasha Digital"].map((companyName) => ({ companyName, status: "verified" }));

function companyIsVerified(companyName: string, records: CompanyVerification[]) {
  return records.some((record) => record.status === "verified" && record.companyName.trim().toLocaleLowerCase() === companyName.trim().toLocaleLowerCase());
}

function completedAt(application: Application) {
  return [...(application.events || [])].reverse().find((event) => event.type === "completed")?.at || application.createdAt;
}

type StudentNotificationCategory = "Applications" | "Interviews" | "Tasks";
type StudentNotification = {
  id: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  category: StudentNotificationCategory;
  createdAt?: string;
  destination: string;
};

function createStudentNotifications(applications: Application[], tasks: Task[]): StudentNotification[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const invites = applications.filter((application) => application.interviewInvited || application.status === "interview-invited");
  const recommendations = tasks.filter((task) => task.verified && !applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID));
  const eventDate = (application: Application, type: NonNullable<Application["events"]>[number]["type"]) =>
    [...(application.events || [])].reverse().find((event) => event.type === type)?.at;
  return [
    ...invites.map((application) => ({
      id: `invite-${application.id}`,
      icon: GraduationCap,
      title: `Interview invitation from ${taskById.get(application.taskId)?.company || "a company"}`,
      detail: taskById.get(application.taskId)?.title || "View your application",
      category: "Interviews" as const,
      createdAt: eventDate(application, "interview-invited") || application.createdAt,
      destination: "applications"
    })),
    ...applications.filter((application) => application.status === "accepted").map((application) => ({
      id: `accepted-${application.id}`,
      icon: CircleCheck,
      title: "Your application was accepted",
      detail: taskById.get(application.taskId)?.title || "View your application",
      category: "Applications" as const,
      createdAt: eventDate(application, "accepted") || application.createdAt,
      destination: "applications"
    })),
    ...recommendations.slice(0, 1).map((task) => ({
      id: `task-${task.id}`,
      icon: Sparkles,
      title: "New verified task available",
      detail: task.title,
      category: "Tasks" as const,
      destination: `detail:${task.id}`
    }))
  ];
}

function loadReadNotificationIds() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(READ_NOTIFICATIONS_KEY) || "[]");
    return Array.isArray(saved) && saved.every((id) => typeof id === "string") ? saved : [];
  } catch (error) {
    console.error("Could not load notification read state", error);
    return [];
  }
}

const defaultStudentProfile: StudentProfileData = {
  name: "Tino Moyo",
  school: "HIT Software 3rd Year",
  location: "Harare",
  studyField: "Coding",
  track: "earning"
  ,paymentProvider: undefined,
  paymentNumber: ""
};

const paymentOptions: Array<{ name: NonNullable<StudentProfileData["paymentProvider"]>; logo: string }> = [
  { name: "Inbucks", logo: "https://wallet.innbucks.co.zw/images/logo-black.png" },
  { name: "Omari", logo: "https://play-lh.googleusercontent.com/j-LitLs-ASU8tFClK4jDan8b6apHzypTwkHR64px09R6Ir2uFbsqkaUprm0v4jjWJZUV_sjSKH78ZpK-9D75w" },
  { name: "EcoCash", logo: "https://upload.wikimedia.org/wikipedia/commons/5/54/EcoCash.png" }
];

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      if (Array.isArray(parsed.tasks) && Array.isArray(parsed.applications)) {
        const savedTaskIds = new Set(parsed.tasks.map((task) => task.id));
        const migratedDemoTasks = seedTasks.filter((task) => task.mine && !savedTaskIds.has(task.id));
        const savedApplicationIds = new Set(parsed.applications.map((application) => application.id));
        const migratedDemoApplications = seedApplications.filter((application) => application.id.startsWith("demo-") && !savedApplicationIds.has(application.id));
        return {
          tasks: [...parsed.tasks, ...migratedDemoTasks].map((task) => {
            const seedTask = seedTasks.find((seed) => seed.id === task.id);
            return { ...task, skill: SKILL_OPTIONS.includes(task.skill as Skill) ? task.skill : "Research", mine: task.mine ?? seedTask?.mine, level: seedTask?.level || task.level || "Intermediate" };
          }),
          applications: [...parsed.applications, ...migratedDemoApplications].map((application) => {
            const isSeedApplication = /^a\d+$/.test(application.id);
            return {
              ...application,
              studentName: isSeedApplication
                ? ["Ruth Ndlovu", "Simba Chitepo", "Elena Dube"][(Number(application.id.slice(1)) - 1) % 3]
                : application.studentName || "Tino Moyo",
              studentId: isSeedApplication ? `seed-${application.id}` : application.studentId || `legacy-${application.id}`,
              studentTrack: application.studentTrack || "earning",
              studentStudyField: application.studentStudyField || "Coding",
              status: application.status || "applied",
              interviewInvited: application.interviewInvited || false
            };
          }),
          policy: { ...defaultPolicy, ...parsed.policy },
          companyVerifications: [...defaultCompanyVerifications, ...(Array.isArray(parsed.companyVerifications) ? parsed.companyVerifications.filter((record) => !defaultCompanyVerifications.some((demo) => demo.companyName.toLowerCase() === record.companyName?.toLowerCase())) : [])]
        };
      }
    }
  } catch (error) {
    console.error("Could not load saved GradLink data", error);
  }
  return { tasks: seedTasks, applications: seedApplications, policy: defaultPolicy, companyVerifications: defaultCompanyVerifications };
}

function loadStudentProfile(): StudentProfileData {
  try {
    const raw = localStorage.getItem(`${KEY}-student-profile`);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<StudentProfileData> & { studyField?: string };
      return { ...defaultStudentProfile, ...saved, studyField: (SKILL_OPTIONS.includes(saved.studyField as Skill) ? saved.studyField : defaultStudentProfile.studyField) as Skill };
    }
  } catch (error) {
    console.error("Could not load the saved student profile", error);
  }
  return defaultStudentProfile;
}

function loadCertificates(): CertificateMeta[] {
  try {
    const raw = localStorage.getItem(`${KEY}-certificates`);
    return raw ? JSON.parse(raw) as CertificateMeta[] : [];
  } catch (error) {
    console.error("Could not load saved certificate details", error);
    return [];
  }
}

function openCertificateDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`${KEY}-certificate-files`, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("certificates", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open certificate storage"));
  });
}

async function saveCertificateFile(id: string, file: File): Promise<void> {
  const database = await openCertificateDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("certificates", "readwrite");
    transaction.objectStore("certificates").put({ id, file });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save certificate file"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving certificate file was cancelled"));
  }).finally(() => database.close());
}

async function readCertificateFile(id: string): Promise<Blob> {
  const database = await openCertificateDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("certificates", "readonly").objectStore("certificates").get(id);
    request.onsuccess = () => {
      database.close();
      const file = request.result?.file;
      if (file instanceof Blob) resolve(file);
      else reject(new Error("Certificate file is no longer available"));
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("Could not read certificate file"));
    };
  });
}

async function deleteCertificateFile(id: string): Promise<void> {
  const database = await openCertificateDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("certificates", "readwrite");
    transaction.objectStore("certificates").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete certificate file"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Deleting certificate file was cancelled"));
  }).finally(() => database.close());
}

function money(task: Task) {
  return `$${task.budget} ${task.payment === "EcoCash" ? "EcoCash" : "USD"}`;
}

function Toast({ message, error = false, onClose }: { message: string; error?: boolean; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`toast ${error ? "toast-error" : ""}`}
    >
      <span>{error ? "!" : "✓"}</span>
      {message}
      <button aria-label="Close notification" onClick={onClose}><X size={16} /></button>
    </motion.div>
  );
}

function CertificatePreview({ certificate, url, onClose }: { certificate: CertificateMeta; url: string; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal certificate-preview" role="dialog" aria-modal="true" aria-labelledby="certificate-preview-title">
      <div className="modal-head"><div><span className="eyebrow">CERTIFICATE</span><h2 id="certificate-preview-title">{certificate.name}</h2></div><button className="icon-btn" type="button" aria-label="Close certificate preview" onClick={onClose}><X /></button></div>
      <iframe title={`Preview of ${certificate.name}`} src={url} />
      <a className="primary download-certificate" href={url} download={certificate.name}>Download certificate</a>
    </section>
  </div>;
}

function Avatar({ initials = "TM", size = 34, src }: { initials?: string; size?: number; src?: string }) {
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>{src ? <img src={src} alt="" /> : initials}</div>;
}

function initialsFromName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "ST";
}

function resizeProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(objectUrl); reject(new Error("Image processing is unavailable")); return; }
      const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
      context.drawImage(image, (image.naturalWidth - cropSize) / 2, (image.naturalHeight - cropSize) / 2, cropSize, cropSize, 0, 0, 320, 320);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not read this image")); };
    image.src = objectUrl;
  });
}

function ThemeModeControl({ preference, onChange, className = "" }: { preference: ThemePreference; onChange: (preference: ThemePreference) => void; className?: string }) {
  return <div className={`theme-mode-control ${className}`} role="group" aria-label="Appearance theme">
    <button type="button" className={preference === "light" ? "theme-mode-option selected" : "theme-mode-option"} aria-label="Use light theme" aria-pressed={preference === "light"} title="Light theme" onClick={() => onChange("light")}><Sun size={15} /></button>
    <button type="button" className={preference === "dark" ? "theme-mode-option selected" : "theme-mode-option"} aria-label="Use dark theme" aria-pressed={preference === "dark"} title="Dark theme" onClick={() => onChange("dark")}><Moon size={15} /></button>
    <button type="button" className={preference === "system" ? "theme-mode-option selected" : "theme-mode-option"} aria-label="Use system theme" aria-pressed={preference === "system"} title="Follow system theme" onClick={() => onChange("system")}><Monitor size={14} /></button>
  </div>;
}

function DashboardNavigation({ account, page, go, notificationCount = 0, candidateCount = 0, open, onToggle, themePreference, onThemeChange, profileName = "", profilePicture }: { account: AccountType; page: string; go: (p: string) => void; notificationCount?: number; candidateCount?: number; open: boolean; onToggle: () => void; themePreference: ThemePreference; onThemeChange: (preference: ThemePreference) => void; profileName?: string; profilePicture?: string }) {
  const items: Array<[string, string, LucideIcon]> =
    account === "student"
      ? [
          ["dashboard", "Dashboard", Home],
          ["tasks", "Tasks", BriefcaseBusiness],
          ["applications", "Applications", CircleCheck],
          ["reviews", "Reviews", Star],
          ["notifications", "Notifications", BellRing],
          ["badges", "Badges", Award],
          ["profile", "Profile", UserRound]
        ]
      : account === "company"
        ? [
            ["company-dashboard", "Dashboard", Grid2x2],
            ["company-jobs", "Post task", BriefcaseBusiness],
            ["company-applicants", "Applicants", Users],
            ["company-candidates", "Candidates", BellRing],
            ["company-payouts", "Payouts", Wallet],
            ["company-profile", "Company Profile", Building2]
          ]
        : [
            ["admin-overview", "Overview", Grid2x2],
            ["admin-students", "Students", CircleUserRound],
            ["admin-companies", "Companies", Building2],
            ["admin-moderation", "Moderation", ShieldCheck]
          ];

  return <>
    {open && <button type="button" className="nav-backdrop" aria-label="Close side panel" onClick={onToggle} />}
    <nav id="workspace-side-panel" className={`app-nav ${open ? "is-open" : "is-closed"}`} aria-label={`${account} navigation`} aria-hidden={!open}>
      <div className="nav-heading"><span>{account === "student" ? "STUDENT WORKSPACE" : account === "company" ? "COMPANY WORKSPACE" : "ADMIN CONSOLE"}</span><ThemeModeControl preference={themePreference} onChange={onThemeChange} /></div>
      {items.map(([id, label, Icon]) => (
        <button key={id} type="button" tabIndex={open ? 0 : -1} className={`${page === id || (id === "tasks" && page === "tasks-all") ? "active" : ""} ${id === "profile" ? "nav-profile-bottom" : ""}`} aria-current={page === id || (id === "tasks" && page === "tasks-all") ? "page" : undefined} onClick={() => { go(id); onToggle(); }}>
          {id === "profile" ? <Avatar initials={initialsFromName(profileName)} size={26} src={profilePicture} /> : <Icon size={21} />}
          <span>{label}{id === "notifications" && notificationCount > 0 ? <small className="nav-count">{notificationCount}</small> : null}{id === "company-candidates" && candidateCount > 0 ? <small className="candidate-nav-count">{candidateCount}</small> : null}</span>
        </button>
      ))}
    </nav>
  </>;
}

function WorkspaceBackButton({ label, onClick, inHeader = false }: { label: string; onClick: () => void; inHeader?: boolean }) {
  const button = <button type="button" className={`secondary-btn workspace-back-button${inHeader ? " header-workspace-back" : ""}`} aria-label={label} onClick={onClick}><ArrowLeft size={16} /><span className={inHeader ? "workspace-back-label" : undefined}>{label}</span></button>;
  return inHeader ? button : <div className="workspace-back-row">{button}</div>;
}

function WelcomePage({ onContinue, onAdminLogoTap, themePreference, onThemeChange }: { onContinue: (workspace: "student" | "company") => void; onAdminLogoTap: () => void; themePreference: ThemePreference; onThemeChange: (preference: ThemePreference) => void }) {
  const [selected, setSelected] = useState<"student" | "company">("student");
  const workspaceLabel = selected === "student" ? "Student" : "Company";
  return <main className="login-preview-page">
    <div className="login-preview-top"><div className="login-brand-group"><button type="button" className="welcome-admin-logo" aria-label="GradLink logo" onClick={onAdminLogoTap}><GraduationCap size={30} /></button><span className="brand">GradLink <span>ZW</span></span><ThemeModeControl preference={themePreference} onChange={onThemeChange} className="login-theme-control" /></div></div>
    <section className="login-intro login-standalone" aria-label="Welcome to GradLink">
      <div className="login-animation" aria-hidden="true">
        <img className="login-reference-backdrop" src="/login-orbits.jpg" alt="" />
        <img className="login-reference-art" src="/login-orbits.jpg" alt="" />
        <div className="login-reference-glow" />
        <div className="login-reference-orbit orbit-one" />
        <div className="login-reference-orbit orbit-two" />
        <div className="login-reference-particles"><i /><i /><i /><i /><i /><i /></div>
      </div>
      <div className="login-copy">
        <span className="eyebrow">WELCOME TO GRADLINK ZW</span>
        <h1>Opportunity starts here.</h1>
        <p>Connect Zimbabwean students with meaningful work, experience, and future careers.</p>
        <div className="login-mode-label">Choose how you want to use GradLink</div>
        <div className="login-mode-buttons" role="group" aria-label="Choose a workspace">{(["student", "company"] as const).map((type) => <button type="button" key={type} className={selected === type ? "login-mode active" : "login-mode"} aria-pressed={selected === type} onClick={() => setSelected(type)}>
          <span>{type === "student" ? <GraduationCap /> : <Building2 />}</span>
          <strong>{type === "student" ? "Student" : "Company"}</strong>
          <small>{type === "student" ? "Find paid tasks and build experience" : "Post tasks and meet talent"}</small>
        </button>)}</div>
        <button className="primary login-continue" type="button" onClick={() => onContinue(selected)}>Continue as {workspaceLabel} <ArrowRight size={17} /></button>
        <p className="login-preview-note">Create an account or sign in to access your workspace.</p>
      </div>
    </section>
  </main>;
}

function AccountAccessPage({ workspace, onAuthenticate, onGoogleSignIn }: { workspace: "student" | "company"; onAuthenticate: (workspace: "student" | "company", mode: "create" | "signin", name: string, email: string, password: string) => Promise<{ error?: string; message?: string }>; onGoogleSignIn: () => void }) {
  const [mode, setMode] = useState<"create" | "signin">("signin");
  const [name, setName] = useState("");
  const emailKey = `${KEY}-remembered-email-${workspace}`;
  const [email, setEmail] = useState(() => { try { return localStorage.getItem(emailKey) || ""; } catch { return ""; } });
  const [rememberEmail, setRememberEmail] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isStudent = workspace === "student";
  return <main className="login-preview-page account-access-page">
    <div className="login-preview-top"><div className="login-brand-group"><span className="brand"><GraduationCap size={30} /> GradLink <span>ZW</span></span></div></div>
    <section className="access-card" aria-labelledby="access-title">
      <span className="eyebrow">{isStudent ? "STUDENT ACCESS" : "COMPANY ACCESS"}</span>
      <h1 id="access-title">{mode === "create" ? "Create your account" : "Sign in to your account"}</h1>
      <p>{mode === "create" ? isStudent ? "Create an account to access GradLink. Choose an earning package after setup to start applying for paid work." : "Create an account to access your company workspace and post tasks." : "Enter your account details to continue to your workspace."}</p>
      <form name={`${workspace}-${mode}`} autoComplete="on" onSubmit={async (event) => { event.preventDefault(); setAuthMessage(""); if (mode === "create" && password !== confirmPassword) { setPasswordError("Passwords do not match."); return; } setPasswordError(""); try { if (rememberEmail && email.trim()) localStorage.setItem(emailKey, email.trim()); else localStorage.removeItem(emailKey); } catch { /* browser autofill remains available if storage is blocked */ } setSubmitting(true); const result = await onAuthenticate(workspace, mode, name.trim(), email.trim(), password); setSubmitting(false); if (result.error) setPasswordError(result.error); if (result.message) setAuthMessage(result.message); }}>
        {mode === "create" && <label>{isStudent ? "Full name" : "Company name"}<input required autoComplete={isStudent ? "name" : "organization"} value={name} onChange={(event) => setName(event.target.value)} placeholder={isStudent ? "Your full name" : "Your company name"} /></label>}
        <label>{isStudent ? "Email address" : "Work email"}<input required id={`${workspace}-email`} name="username" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        {mode === "signin" && <label className="remember-email-option"><input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />Remember my email on this device</label>}
        <label>Password<input required id={`${workspace}-password`} name="password" type="password" minLength={8} autoComplete={mode === "create" ? "new-password" : "current-password"} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {mode === "create" && <label>Confirm password<input required type="password" minLength={8} autoComplete="new-password" placeholder="Enter your password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
        {passwordError && <small className="form-error" role="alert">{passwordError}</small>}
        <button className="primary full access-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "create" ? "Create account" : "Sign in"} {!submitting && <ArrowRight size={16} />}</button>
      </form>
      {authMessage && <p className="auth-feedback" role="status">{authMessage}</p>}
      {mode === "signin" && <><div className="access-divider"><span>or</span></div><button className="google-signin-btn" type="button" onClick={onGoogleSignIn} disabled={submitting}><svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5h6.5c3.8-3.5 6.1-8.6 6.1-14.7Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.5-5c-1.8 1.2-4.1 1.9-7 1.9-5.3 0-9.8-3.6-11.4-8.4H5.9v5.2C9.3 39.5 16.1 44 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12.1 12.1 0 0 1 0-7.4v-5.2H5.9a20 20 0 0 0 0 17.8l6.7-5.2Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4 16.1 4 9.3 8.5 5.9 15.1l6.7 5.2c1.6-4.8 6.1-8.2 11.4-8.2Z"/></svg>Continue with Google</button></>}
      <p className="access-switch">{mode === "create" ? "Already have an account?" : "New to GradLink?"} <button type="button" onClick={() => setMode(mode === "create" ? "signin" : "create")}>{mode === "create" ? "Sign in" : "Create account"}</button></p>
      {!supabaseConfigured && <small className="access-prototype-note">Sign-in is temporarily unavailable. Please try again later.</small>}
    </section>
  </main>;
}

function AdminLoginPage({ onBack, onSubmit }: { onBack: () => void; onSubmit: () => void }) {
  return <main className="login-preview-page admin-login-page"><div className="login-preview-top"><span className="brand"><GraduationCap size={30} /> GradLink <span>ZW</span></span><button className="secondary-btn" type="button" onClick={onBack}>Back</button></div>
    <section className="access-card" aria-labelledby="admin-login-title"><span className="eyebrow">RESTRICTED ACCESS</span><h1 id="admin-login-title">Admin sign in</h1><p>Sign in with an authorized platform administrator account.</p><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><label>Admin email<input required type="email" autoComplete="username" placeholder="admin@gradlink.co.zw" /></label><label>Password<input required type="password" autoComplete="current-password" placeholder="Your password" /></label><button className="primary full access-submit" type="submit">Sign in <ArrowRight size={16} /></button></form><small className="access-prototype-note">Admin authentication is not connected yet.</small></section>
  </main>;
}

const STUDENT_PACKAGES = [
  { id: "general", name: "General", cap: "Tasks up to $20", fee: "10% per earning", detail: "A $2 service fee on a $20 earning.", benefits: ["Access to General tasks", "Platform keeps 10% of each earning"] },
  { id: "intermediate", name: "Intermediate", cap: "Tasks up to $35", fee: "$5 per earning", detail: "Service fee starts at $5 per earning.", benefits: ["Access to Intermediate tasks", "Platform fee from $5 per earning"] },
  { id: "professional", name: "Professional", cap: "Tasks up to $50", fee: "$10 per earning", detail: "Includes access to interview opportunities.", benefits: ["Access to Professional tasks", "Unlock interviews", "$10 platform fee per earning"] },
  { id: "advanced", name: "Advanced", cap: "Tasks $80+", fee: "$30 per earning", detail: "Includes first preference and access to top paying tasks.", benefits: ["Access to Advanced tasks", "First preference", "Top paying tasks", "$30 platform fee per earning"] },
] as const;
const packageRank: Record<typeof STUDENT_PACKAGES[number]["id"], number> = { general: 1, intermediate: 2, professional: 3, advanced: 4 };
const taskLevelRank: Record<WorkLevel, number> = { "Entry level": 1, Intermediate: 2, Professional: 3, Advanced: 4 };

function StudentPackagePage({ onBack, onContinue }: { onBack: () => void; onContinue: (packageId: typeof STUDENT_PACKAGES[number]["id"]) => void }) {
  const [selected, setSelected] = useState<typeof STUDENT_PACKAGES[number]["id"] | null>(null);
  return <main className="login-preview-page package-access-page"><div className="login-preview-top"><span className="brand"><GraduationCap size={30} /> GradLink <span>ZW</span></span><button className="secondary-btn" type="button" onClick={onBack}>Back</button></div>
    <section className="package-selection" aria-labelledby="package-title"><span className="eyebrow">STUDENT EARNING SETUP</span><h1 id="package-title">Choose an earning package</h1><p>Your account gives you access to GradLink. Choose a package to unlock eligible paid tasks and earning features.</p><div className="package-grid">{STUDENT_PACKAGES.map((item) => <button type="button" key={item.id} className={`package-option ${selected === item.id ? "selected" : ""}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span className="package-option-top"><strong>{item.name}</strong><span>{item.cap}</span></span><strong className="package-fee">{item.fee}</strong><span className="package-detail">{item.detail}</span><ul>{item.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul></button>)}</div><button className="primary full access-submit" type="button" disabled={!selected} onClick={() => selected && onContinue(selected)}>Activate package &amp; continue <ArrowRight size={16} /></button><small className="access-prototype-note">Package activation is a prototype selection; payments and deductions are not connected.</small></section>
  </main>;
}

function StudentPackageDetailsPage({ packageId, profile, onBack, onSubmit }: { packageId: typeof STUDENT_PACKAGES[number]["id"]; profile: StudentProfileData; onBack: () => void; onSubmit: (profile: StudentProfileData, cvFile?: File) => Promise<void> }) {
  const packageInfo = STUDENT_PACKAGES.find((item) => item.id === packageId)!;
  const needsFormalDetails = packageId === "professional" || packageId === "advanced";
  const [name, setName] = useState(profile.name === defaultStudentProfile.name ? "" : profile.name);
  const [school, setSchool] = useState(profile.school === defaultStudentProfile.school ? "" : profile.school);
  const [location, setLocation] = useState(profile.location === defaultStudentProfile.location ? "" : profile.location);
  const [email, setEmail] = useState(profile.email || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [paymentProvider, setPaymentProvider] = useState<StudentProfileData["paymentProvider"]>(profile.paymentProvider);
  const [paymentNumber, setPaymentNumber] = useState(profile.paymentNumber || "");
  const [cvFile, setCvFile] = useState<File | undefined>();
  const [saving, setSaving] = useState(false);
  return <main className="login-preview-page package-access-page"><div className="login-preview-top"><span className="brand"><GraduationCap size={30} /> GradLink <span>ZW</span></span><button className="secondary-btn" type="button" onClick={onBack}>Back to packages</button></div>
    <section className="access-card package-details-card" aria-labelledby="package-details-title"><span className="eyebrow">{packageInfo.name.toUpperCase()} PACKAGE SETUP</span><h1 id="package-details-title">{needsFormalDetails ? "Complete your student details" : "Add your payment details"}</h1><p>{needsFormalDetails ? `Add the formal and payment details for your ${packageInfo.name} account.` : `General and Intermediate accounts only need payment details to receive earnings.`}</p><form onSubmit={async (event) => { event.preventDefault(); if (needsFormalDetails && !cvFile) return; setSaving(true); try { await onSubmit({ ...profile, ...(needsFormalDetails ? { name: name.trim(), school: school.trim(), location: location.trim(), email: email.trim(), phone: phone.trim() } : {}), paymentProvider, paymentNumber: paymentNumber.trim() }, cvFile); } finally { setSaving(false); } }}>
      {needsFormalDetails && <><label>Full legal name<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label>Phone number<input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label><label>School and course<input required value={school} onChange={(event) => setSchool(event.target.value)} /></label><label>Location<input required value={location} onChange={(event) => setLocation(event.target.value)} /></label></>}
      {needsFormalDetails && <label>Upload your CV (PDF or DOCX, up to 10 MB)<input required type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]; if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) { event.currentTarget.value = ""; setCvFile(undefined); return; } setCvFile(file); }} />{cvFile && <small>{cvFile.name} · {(cvFile.size / 1024 / 1024).toFixed(2)} MB · stored privately in Supabase</small>}</label>}
      <label>Payment method<select required value={paymentProvider || ""} onChange={(event) => setPaymentProvider((event.target.value || undefined) as StudentProfileData["paymentProvider"])}><option value="">Choose a method</option>{paymentOptions.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}</select></label><label>Payment account or phone number<input required value={paymentNumber} onChange={(event) => setPaymentNumber(event.target.value)} placeholder="Where you receive your earnings" /></label><div className="payment-provider-options" aria-label="Payment method icons">{paymentOptions.map((option) => <button type="button" className={paymentProvider === option.name ? "payment-provider selected" : "payment-provider"} key={option.name} onClick={() => setPaymentProvider(option.name)} aria-label={`Select ${option.name}`}><img src={option.logo} alt="" loading="lazy" /><span>{option.name}</span></button>)}</div><button className="primary full access-submit" type="submit" disabled={saving || (needsFormalDetails && !cvFile)}>{saving ? "Saving securely…" : `Save details and activate ${packageInfo.name}`} <ArrowRight size={16} /></button></form><small className="access-prototype-note">CV uploads are stored in private Supabase Storage. Payments are not connected.</small></section>
  </main>;
}

function StudentDashboard({ profile, applications, tasks, certificates, policy, interviewFields, packageTier, isCompanyVerified, go }: {
  profile: StudentProfileData; applications: Application[]; tasks: Task[]; certificates: CertificateMeta[]; policy: InterviewPolicy; interviewFields: Skill[]; packageTier: typeof STUDENT_PACKAGES[number]["id"] | null; isCompanyVerified: (companyName: string) => boolean; go: (page: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const interviewAccess = packageTier === "professional" || packageTier === "advanced";
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const completed = applications.filter((application) => application.status === "completed");
  const completedTaskCount = new Set(completed.map((application) => application.taskId)).size;
  const completedTaskValue = completed.reduce((value, application) => {
    const task = taskById.get(application.taskId);
    if (task) value[task.payment] += task.budget;
    return value;
  }, { USD: 0, EcoCash: 0 });
  const recommendedTasks = tasks.filter((task) => task.verified && (!interviewLevels.includes(task.level) || isCompanyVerified(task.company)) && packageTier && taskLevelRank[task.level || "Intermediate"] <= packageRank[packageTier] && task.budget <= ({ general: 20, intermediate: 35, professional: 50, advanced: Number.POSITIVE_INFINITY }[packageTier])).map((task) => {
    const priorWork = applications.filter((application) => application.hiredAgain && application.status === "completed" && application.studentId === CURRENT_STUDENT_ID).filter((application) => {
      const completedTask = tasks.find((item) => item.id === application.taskId);
      return completedTask?.company === task.company && completedTask.skill === task.skill;
    });
    const preference = priorWork.length ? 1000 + priorWork.reduce((sum, application) => sum + (application.rating || 0), 0) / priorWork.length * 10 + priorWork.length : 0;
    const applied = applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID);
    const relevant = task.skill === profile.studyField ? 1 : 0;
    return { task, preference, applied, relevant };
  }).filter(({ applied }) => !applied).sort((a, b) => packageTier === "advanced" ? b.task.budget - a.task.budget || b.preference - a.preference : b.preference - a.preference || b.relevant - a.relevant || b.task.match - a.task.match || b.task.rating - a.task.rating).slice(0, 2);
  const dashboardMotion = (index: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.34, delay: reduceMotion ? 0 : index * 0.055 }
  });

  return <main className="page student-dashboard">
    <motion.section className="dashboard-welcome" {...dashboardMotion(0)}><div><span className="eyebrow">STUDENT DASHBOARD</span><h1>Welcome back, {profile.name.split(" ")[0]}</h1><p>{profile.school} · {profile.location} · Track: {profile.track === "interview" ? "Interviews" : "Earning"}</p></div><button className="primary welcome-action" onClick={() => go("tasks")}><BriefcaseBusiness size={17} /> Browse tasks</button></motion.section>
    <section className="metrics-grid dashboard-metrics">
      <motion.div className="metric-card stat-card" {...dashboardMotion(1)}><span className="stat-icon"><CircleCheck /></span><div><span>Tasks completed</span><strong>{completedTaskCount}</strong><small>Verified completed assignments</small></div></motion.div>
      <motion.div className="metric-card stat-card" {...dashboardMotion(2)}><span className="stat-icon"><UnlockKeyhole /></span><div><span>Interview access</span><strong>{interviewAccess ? "Enabled" : "Not enabled"}</strong><small>{interviewAccess ? `${packageTier === "advanced" ? "Advanced" : "Professional"} package includes interviews${profile.track === "interview" ? ` · ${interviewFields.length} fields qualified` : " · Choose the interview track in your profile to pursue them"}` : "Professional or Advanced package required"}</small></div></motion.div>
      <motion.div className="metric-card stat-card" {...dashboardMotion(3)}><span className="stat-icon"><CircleDollarSign /></span><div><span>Completed task value</span><strong>USD ${completedTaskValue.USD.toFixed(2)}</strong><small>EcoCash ${completedTaskValue.EcoCash.toFixed(2)} · estimated task value</small></div></motion.div>
    </section>
    <section className="dashboard-panel favorite-tasks-panel">
      <div className="section-title"><div><h2><Sparkles size={19} /> Best tasks for you</h2><p>Verified openings ranked by your field, company preferences, and task ratings.</p></div><button className="primary view-all-tasks" type="button" onClick={() => go("tasks-all")}>View all tasks <ChevronRight size={15} /></button></div>
      {recommendedTasks.length ? <div className="favorite-task-grid">{recommendedTasks.map(({ task, preference, relevant }) => <article className="recommended-task favorite-task" key={task.id}>
        <div className="favorite-task-heading"><span className="eyebrow">{task.skill}</span>{preference > 0 ? <span className="favorite-tag"><Star size={12} fill="currentColor" /> Preferred match</span> : relevant ? <span className="favorite-tag">For your field</span> : null}</div>
        <h3>{task.title}</h3><p className="favorite-company">{task.company}</p><p>{task.description}</p>
        <div className="favorite-task-meta"><span><Star size={14} fill="currentColor" /> {task.rating > 0 ? `${task.rating.toFixed(1)} company rating` : "New listing"}</span><span>{money(task)}</span></div>
        <button className="primary" type="button" onClick={() => go(`detail:${task.id}`)}>View task <ChevronRight size={15} /></button>
      </article>)}</div> : <div className="empty"><BriefcaseBusiness /><h2>No recommended tasks right now</h2><p>New verified tasks will appear here when available.</p><button className="primary" type="button" onClick={() => go("tasks")}>Browse tasks</button></div>}
    </section>
  </main>;
}

function StudentReviews({ applications, tasks }: { applications: Application[]; tasks: Task[] }) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const completed = applications.filter((application) => application.status === "completed");
  const reviewHistory = completed.map((application) => ({ application, task: taskById.get(application.taskId) }))
    .filter((item): item is { application: Application; task: Task } => Boolean(item.task));
  const ratedReviews = reviewHistory.filter(({ application }) => Boolean(application.rating && application.rating > 0))
    .sort((a, b) => Date.parse(b.application.createdAt) - Date.parse(a.application.createdAt));
  const averageReview = ratedReviews.length ? ratedReviews.reduce((total, { application }) => total + (application.rating || 0), 0) / ratedReviews.length : 0;
  const awaitingReview = reviewHistory.length - ratedReviews.length;
  const chartReviews = ratedReviews.slice(0, 7).reverse();
  const trendPoints = chartReviews.map(({ application }, index) => ({
    x: chartReviews.length < 2 ? 50 : 5 + index * (90 / (chartReviews.length - 1)),
    y: 72 - ((application.rating || 0) / 5) * 56,
    rating: application.rating || 0,
    label: new Date(application.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }));
  const trendPath = trendPoints.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const trendArea = trendPath ? `${trendPath} L${trendPoints[trendPoints.length - 1].x},78 L${trendPoints[0].x},78 Z` : "";
  const highRatings = ratedReviews.filter(({ application }) => (application.rating || 0) >= 4).length;
  const middleRatings = ratedReviews.filter(({ application }) => (application.rating || 0) >= 3 && (application.rating || 0) < 4).length;
  const lowRatings = ratedReviews.length - highRatings - middleRatings;
  const highPct = ratedReviews.length ? highRatings / ratedReviews.length * 100 : 0;
  const midPct = ratedReviews.length ? middleRatings / ratedReviews.length * 100 : 0;
  return <main className="page student-reviews-page">
    <div className="page-title review-page-heading"><span className="eyebrow">YOUR WORK</span><h1>Review overview</h1><p>Ratings and feedback from your completed work.</p></div>
    <section className="review-dashboard-grid" aria-label="Review analytics">
      <article className="dashboard-panel review-chart-panel"><div className="section-title"><div><h2>Reviews received</h2><p>Ratings on completed tasks</p></div><span className="review-period-chip">All time</span></div>
        <div className="review-chart-metrics"><div><strong>{ratedReviews.length}</strong><span>company reviews</span></div><span className="review-change-chip"><i /> {awaitingReview} awaiting review</span></div>
        {chartReviews.length ? <div className="review-grouped-chart" role="img" aria-label="Ratings for your latest reviewed tasks"><div className="review-bars">{chartReviews.map(({ application, task }) => <div className="review-bar-group" key={application.id} title={`${task.title}: ${(application.rating || 0).toFixed(1)} out of 5`}><i className="review-bar-muted" style={{ height: `${Math.max(5, ((5 - (application.rating || 0)) / 5) * 100)}%` }} /><i className="review-bar-value" style={{ height: `${Math.max(5, ((application.rating || 0) / 5) * 100)}%` }} /></div>)}</div><div className="review-chart-labels">{chartReviews.map(({ application }, index) => <span key={application.id}>{new Date(application.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) || `#${index + 1}`}</span>)}</div></div> : <div className="review-empty-chart">Company ratings will appear here after your first completed task is reviewed.</div>}
        <div className="review-card-footer"><span>Latest {chartReviews.length} reviews</span><span>Rating scale: 5 stars</span></div>
      </article>
      <article className="dashboard-panel review-trend-panel"><div className="section-title"><div><h2>Rating trend</h2><p>Your latest company ratings</p></div><span className="review-period-chip">Out of 5</span></div>
        <div className="review-trend-value"><strong>{ratedReviews.length ? averageReview.toFixed(1) : "—"}</strong><span>Average rating</span></div>
        {trendPoints.length > 1 ? <div className="review-line-chart"><svg viewBox="0 0 100 82" preserveAspectRatio="none" role="img" aria-label="Rating trend over recent reviews"><defs><linearGradient id="reviewTrendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--theme-primary)" stopOpacity=".32"/><stop offset="100%" stopColor="var(--theme-primary)" stopOpacity="0"/></linearGradient></defs><path d={trendArea} fill="url(#reviewTrendFill)"/><path d={trendPath} fill="none" stroke="var(--theme-primary)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>{trendPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="var(--theme-primary)" vectorEffect="non-scaling-stroke"><title>{point.label}: {point.rating.toFixed(1)} / 5</title></circle>)}</svg><div className="review-trend-labels">{trendPoints.map((point, index) => <span key={index}>{point.label}</span>)}</div></div> : <div className="review-empty-chart review-empty-line">A rating trend will appear when you have more reviews.</div>}
        <div className="review-card-footer"><span>{ratedReviews.length} review{ratedReviews.length === 1 ? "" : "s"} total</span><span>All completed work</span></div>
      </article>
    </section>
    <section className="review-bottom-grid" aria-label="Review summary details">
      <article className="dashboard-panel review-donut-panel"><div className="review-bottom-heading"><div><h2>Rating mix</h2><p>Review distribution</p></div><span>All time</span></div><div className="review-donut-wrap"><div className="review-donut" style={{ background: ratedReviews.length ? `conic-gradient(var(--review-positive) 0 ${highPct}%, var(--theme-cyan) ${highPct}% ${highPct + midPct}%, var(--review-negative) ${highPct + midPct}% 100%)` : "var(--theme-surface-soft)" }}><div><strong>{ratedReviews.length}</strong><small>reviews</small></div></div></div><div className="review-donut-legend"><span><i className="good"/>4 to 5 stars <strong>{highRatings}</strong></span><span><i className="mid"/>3 stars <strong>{middleRatings}</strong></span><span><i className="low"/>1 to 2 stars <strong>{lowRatings}</strong></span></div></article>
      <article className="dashboard-panel review-profit-panel"><div className="review-bottom-heading"><div><h2>Average score</h2><p>Across rated completed tasks</p></div><Star size={18}/></div><div className="review-bottom-number">{ratedReviews.length ? averageReview.toFixed(1) : "—"}<small> / 5</small></div><div className="review-average-track" role="progressbar" aria-label="Average rating out of five" aria-valuemin={0} aria-valuemax={5} aria-valuenow={Number(averageReview.toFixed(1))}><i style={{ width: `${averageReview / 5 * 100}%` }} /></div><div className="review-legend-pair"><span><i className="good"/>Rated <strong>{ratedReviews.length}</strong></span><span><i className="low"/>Awaiting <strong>{awaitingReview}</strong></span></div></article>
      <article className="dashboard-panel review-total-panel"><div className="review-bottom-heading"><div><h2>Completed work</h2><p>Tasks in your review history</p></div><span className="review-period-chip">All time</span></div><div className="review-bottom-number">{reviewHistory.length}</div><div className="review-total-track"><i style={{ width: `${reviewHistory.length ? ratedReviews.length / reviewHistory.length * 100 : 0}%` }} /></div><div className="review-total-caption">{ratedReviews.length} rated · {awaitingReview} awaiting company review</div></article>
    </section>
  </main>;
}

function StudentApplications({ applications, tasks, go, onSubmitWork, onWithdraw }: {
  applications: Application[];
  tasks: Task[];
  go: (page: string) => void;
  onSubmitWork: (applicationId: string, work: string) => void;
  onWithdraw: (applicationId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "completed" | "closed">("all");
  const [query, setQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("All skills");
  const [paymentFilter, setPaymentFilter] = useState("All methods");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workDraft, setWorkDraft] = useState("");
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const counts = {
    all: applications.length,
    pending: applications.filter((a) => ["applied", "interview-invited"].includes(a.status)).length,
    accepted: applications.filter((a) => ["accepted", "submitted"].includes(a.status)).length,
    completed: applications.filter((a) => a.status === "completed").length,
    closed: applications.filter((a) => ["rejected", "withdrawn"].includes(a.status)).length
  };
  const deadlineValue = (task: Task | undefined) => {
    if (!task) return Number.POSITIVE_INFINITY;
    const exact = Date.parse(task.deadline);
    if (Number.isFinite(exact)) return exact;
    const relative = task.deadline.match(/(\d+)\s*(h|d|w)/i);
    if (!relative) return Number.POSITIVE_INFINITY;
    const unit = relative[2].toLowerCase() === "h" ? 3600000 : relative[2].toLowerCase() === "w" ? 604800000 : 86400000;
    return Date.now() + Number(relative[1]) * unit;
  };
  const matchesStatus = (a: Application) => statusFilter === "all"
    || (statusFilter === "pending" && ["applied", "interview-invited"].includes(a.status))
    || (statusFilter === "accepted" && ["accepted", "submitted"].includes(a.status))
    || (statusFilter === "completed" && a.status === "completed")
    || (statusFilter === "closed" && ["rejected", "withdrawn"].includes(a.status));
  const filtered = applications.filter((a) => {
    const task = taskById.get(a.taskId);
    const textMatches = ((task?.title || "") + " " + (task?.company || "")).toLowerCase().includes(query.trim().toLowerCase());
    return matchesStatus(a) && textMatches && (skillFilter === "All skills" || task?.skill === skillFilter)
      && (paymentFilter === "All methods" || task?.payment === paymentFilter);
  }).sort((a, b) => {
    const ta = taskById.get(a.taskId); const tb = taskById.get(b.taskId);
    if (sortBy === "deadline") return deadlineValue(ta) - deadlineValue(tb);
    if (sortBy === "payment") return (tb?.budget || 0) - (ta?.budget || 0);
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
  const selected = applications.find((a) => a.id === selectedId) || null;
  const selectedTask = selected ? taskById.get(selected.taskId) : undefined;
  const timeline = (a: Application) => {
    if (a.status === "rejected" || a.status === "withdrawn") return [{ label: a.status === "withdrawn" ? "Withdrawn" : "Not selected", complete: true }];
    return [
      { label: "Applied", complete: true },
      ...(a.interviewInvited ? [{ label: "Interview invited", complete: true }] : []),
      { label: "Accepted", complete: ["accepted", "submitted", "completed"].includes(a.status) },
      { label: "In progress", complete: ["accepted", "submitted", "completed"].includes(a.status) },
      { label: "Submitted", complete: ["submitted", "completed"].includes(a.status) },
      { label: "Completed", complete: a.status === "completed" },
      { label: "Paid", complete: Boolean(a.paymentRecordedAt) }
    ];
  };
  const totals = applications.reduce((result, a) => {
    const task = taskById.get(a.taskId);
    if (!task) return result;
    if (a.status === "completed" && !a.paymentRecordedAt) result.unrecorded[task.payment] += task.budget;
    if (a.paymentRecordedAt) result.recorded[task.payment] += task.budget;
    return result;
  }, { unrecorded: { USD: 0, EcoCash: 0 }, recorded: { USD: 0, EcoCash: 0 } });
  const activity = applications.flatMap((a) => a.events?.length
    ? a.events.map((event) => ({ ...event, application: a }))
    : [{ id: "submitted-" + a.id, type: "applied" as const, actor: "student" as const, description: "Application submitted", at: a.createdAt, application: a }]
  ).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 5);
  const urgent = applications.filter((a) => a.status === "accepted" && deadlineValue(taskById.get(a.taskId)) - Date.now() < 48 * 3600000);
  const clearFilters = () => { setStatusFilter("all"); setQuery(""); setSkillFilter("All skills"); setPaymentFilter("All methods"); };
  return <main className="page student-side-page applications-page">
    <div className="page-title application-page-heading"><div><h1><CircleCheck size={22} /> My applications</h1><p>Track decisions, next steps, deadlines, and recorded payments.</p></div><button className="primary" type="button" onClick={() => go("tasks")}><BriefcaseBusiness size={16} /> Browse tasks</button></div>
    <div className="application-stats">{([["all", "Total applications"], ["pending", "Pending"], ["accepted", "Accepted"], ["completed", "Completed"]] as const).map(([key, label]) => <button type="button" key={key} className={"application-stat " + (statusFilter === key ? "selected" : "")} onClick={() => setStatusFilter(key)}><span>{label}</span><strong>{counts[key]}</strong></button>)}</div>
    <div className="application-earnings"><div><span>Completed task value · payment not confirmed</span><strong>{"USD " + totals.unrecorded.USD.toFixed(2) + " · EcoCash " + totals.unrecorded.EcoCash.toFixed(2)}</strong></div><div><span>Payment recorded by company</span><strong>{"USD " + totals.recorded.USD.toFixed(2) + " · EcoCash " + totals.recorded.EcoCash.toFixed(2)}</strong></div></div>
    {urgent.length > 0 && <div className="application-alerts"><strong><BellRing size={16} /> Action required</strong><span>{urgent.length} accepted task(s) have a deadline within 48 hours. Submit your work from the tracker.</span></div>}
    <div className="application-toolbar"><label className="application-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search task or company" /></label><label>Skill<select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}><option>All skills</option>{SKILL_OPTIONS.map((skill) => <option key={skill}>{skill}</option>)}</select></label><label>Payment<select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}><option>All methods</option><option>USD</option><option>EcoCash</option></select></label><label>Sort by<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">Newest</option><option value="deadline">Deadline</option><option value="payment">Payment amount</option></select></label></div>
    <div className="application-status-tabs" role="tablist" aria-label="Filter applications">{([["all", "All"], ["pending", "Pending"], ["accepted", "Accepted / active"], ["completed", "Completed"], ["closed", "Closed"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={statusFilter === key} className={statusFilter === key ? "selected" : ""} onClick={() => setStatusFilter(key)}>{label}<span>{counts[key]}</span></button>)}</div>
    {filtered.length ? <div className="application-list">{filtered.map((a) => {
      const task = taskById.get(a.taskId);
      const next = a.status === "applied" ? "Waiting for the company to review your application."
        : a.status === "interview-invited" ? "You have an interview invitation. Check Notifications."
        : a.status === "accepted" ? "Complete the task and submit your work for review."
        : a.status === "submitted" ? "Your work is waiting for company review."
        : a.status === "completed" && !a.paymentRecordedAt ? "Work is complete; no payment record is available yet."
        : a.paymentRecordedAt ? "The company recorded payment for this task."
        : a.status === "rejected" ? "The company declined this application." : "You withdrew this application.";
      return <article className="application-tracker-card" key={a.id}>
      <div className="application-tracker-top"><div><h2>{task?.title || "Task listing unavailable"}</h2><p>{task?.company || "Company unavailable"} · {task?.skill || "Field unavailable"} · Applied {new Date(a.createdAt).toLocaleDateString()}</p></div><span className={"status-pill " + (["accepted", "submitted", "completed"].includes(a.status) ? "open" : "review")}>{a.status.replace(/-/g, " ")}</span></div>
        <div className="application-tracker-details"><span><small>Task reward</small><strong>{task ? money(task) : "Unavailable"}</strong></span><span><small>Deadline</small><strong>{task?.deadline || "Not available"}</strong></span><span><small>Delivery estimate</small><strong>{a.deliveryDays} day(s)</strong></span></div>
        <div className="application-timeline">{timeline(a).map((step, i) => <div key={step.label + i} className={"application-timeline-step " + (step.complete ? "complete" : "")}><i /><span>{step.label}</span></div>)}</div>
        <div className="application-next"><strong>What’s next?</strong><span>{next}</span></div>{a.companyFeedback && <div className="application-feedback"><strong>Company feedback</strong><p>{a.companyFeedback}</p></div>}
        <div className="application-card-actions"><button className="secondary-btn" type="button" onClick={() => { setSelectedId(a.id); setWorkDraft(a.submittedWork || ""); }}>Track application</button>{a.status === "accepted" && <button className="primary" type="button" onClick={() => { setSelectedId(a.id); setWorkDraft(a.submittedWork || ""); }}>Submit work</button>}{["applied", "interview-invited"].includes(a.status) && <button className="text-btn withdraw-application" type="button" onClick={() => { if (window.confirm("Withdraw this application? It will be closed and cannot be undone.")) onWithdraw(a.id); }}>Withdraw application</button>}</div>
      </article>;
    })}</div> : applications.length ? <div className="empty"><Search /><h2>No matching applications</h2><p>Try changing your search or filters.</p><button className="secondary-btn" onClick={clearFilters}>Clear filters</button></div> : <div className="empty"><BriefcaseBusiness /><h2>You’re all caught up</h2><p>You have no applications yet. Explore tasks that match your skills.</p><button className="primary" onClick={() => go("tasks")}>Browse tasks</button></div>}
    <section className="application-activity"><h2>Recent application activity</h2>{activity.map((event) => <div className="application-activity-row" key={event.id}><span className="activity-dot" /><div><strong>{event.description}</strong><small>{taskById.get(event.application.taskId)?.title || "Task"} · {event.actor === "student" ? "You" : "Company"} · {new Date(event.at).toLocaleString()}</small></div></div>)}</section>
    {selected && <div className="application-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}><aside className="application-detail-drawer" role="dialog" aria-modal="true" aria-label="Application details">
      <div className="application-drawer-head"><div><span className="eyebrow">APPLICATION TRACKER</span><h2>{selectedTask?.title || "Application details"}</h2><p>{selectedTask?.company || "Company unavailable"}</p></div><button className="icon-btn" type="button" aria-label="Close details" onClick={() => setSelectedId(null)}><X /></button></div>
      <div className="application-drawer-scroll"><section><h3>Task reward and deadline</h3><p>{selectedTask ? money(selectedTask) : "Task reward unavailable"} · Deadline: {selectedTask?.deadline || "Not available"}</p><p>Task reward is not confirmation of payment.</p></section><section><h3>Task description</h3><p>{selectedTask?.description || "Task details are no longer available."}</p></section><section><h3>Your proposal</h3><p>{selected.proposal}</p>{selected.portfolio && <a href={selected.portfolio} target="_blank" rel="noreferrer">View portfolio</a>}</section>
      <section><h3>Application progress</h3><div className="application-timeline drawer-timeline">{timeline(selected).map((step, i) => <div key={step.label + i} className={"application-timeline-step " + (step.complete ? "complete" : "")}><i /><span>{step.label}</span></div>)}</div><p>{selected.status === "applied" ? "Waiting for company review." : selected.status === "accepted" ? "The company accepted your application. Finish the work and submit it here." : selected.status === "submitted" ? "Your work is submitted and awaiting company review." : "Current status: " + selected.status.replace(/-/g, " ") + "."}</p></section>
      {selected.status === "accepted" && <section><h3>Submit work</h3><label>Work link or delivery notes<textarea value={workDraft} onChange={(e) => setWorkDraft(e.target.value)} placeholder="Add a link or explain how the company can access your work." /></label><button className="primary" type="button" disabled={!workDraft.trim()} onClick={() => { onSubmitWork(selected.id, workDraft.trim()); setSelectedId(null); }}>Submit work to company</button></section>}
      {selected.submittedWork && <section><h3>Submitted work</h3><p>{selected.submittedWork}</p>{selected.submittedAt && <small>Submitted {new Date(selected.submittedAt).toLocaleString()}</small>}</section>}{selected.companyFeedback && <section><h3>Company feedback</h3><p>{selected.companyFeedback}</p></section>}
      <section><h3>Payment status</h3><p>{selected.paymentRecordedAt ? "Company marked payment recorded on " + new Date(selected.paymentRecordedAt).toLocaleDateString() + "." : "GradLink has no payment record. This does not confirm whether an external payment was made."}</p></section>
      <section><h3>Recorded activity</h3>{(selected.events?.length ? selected.events : [{ id: "legacy-" + selected.id, description: "Application submitted", actor: "student" as const, at: selected.createdAt }]).slice().reverse().map((event) => <div className="application-activity-row" key={event.id}><span className="activity-dot" /><div><strong>{event.description}</strong><small>{event.actor === "student" ? "You" : "Company"} · {new Date(event.at).toLocaleString()}</small></div></div>)}</section></div>
    </aside></div>}
  </main>;
}

function StudentSidePanel({ page, profile, applications, tasks, certificates, policy, interviewFields, notifications, readNotificationIds, onMarkNotificationRead, onMarkAllNotificationsRead, go, onSubmitWork, onWithdraw }: {
  page: "applications" | "notifications" | "badges";
  profile: StudentProfileData;
  applications: Application[];
  tasks: Task[];
  certificates: CertificateMeta[];
  policy: InterviewPolicy;
  interviewFields: Skill[];
  notifications: StudentNotification[];
  readNotificationIds: string[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  go: (page: string) => void;
  onSubmitWork: (applicationId: string, work: string) => void;
  onWithdraw: (applicationId: string) => void;
}) {
  const [badgeFilter, setBadgeFilter] = useState<"all" | "earned" | "locked">("all");
  const [notificationFilter, setNotificationFilter] = useState<"All" | StudentNotificationCategory>("All");
  const [notificationQuery, setNotificationQuery] = useState("");
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const badgeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const badgeCloseRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!selectedBadgeId) return;
    badgeCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedBadgeId(null);
        badgeTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedBadgeId]);
  const closeBadgeDetails = () => {
    setSelectedBadgeId(null);
    badgeTriggerRef.current?.focus();
  };
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const completed = applications.filter((application) => application.status === "completed");
  const invites = applications.filter((application) => application.interviewInvited || application.status === "interview-invited");
  const unreadNotificationCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length;
  const filteredNotifications = notifications.filter((notification) => {
    const matchesCategory = notificationFilter === "All" || notification.category === notificationFilter;
    const matchesQuery = `${notification.title} ${notification.detail} ${notification.category}`.toLowerCase().includes(notificationQuery.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });
  const completedDates = completed.flatMap((application) => application.events?.filter((event) => event.type === "completed").map((event) => event.at) || []).sort((a, b) => Date.parse(a) - Date.parse(b));
  const inviteDates = invites.flatMap((application) => application.events?.filter((event) => event.type === "interview-invited").map((event) => event.at) || []).sort((a, b) => Date.parse(a) - Date.parse(b));
  const strongestFieldTaskCount = Math.max(0, ...SKILL_OPTIONS.map((skill) => completed.filter((application) => taskById.get(application.taskId)?.skill === skill).length));
  const interviewTaskTarget = Math.max(1, policy.studentCompletedTasks);
  const formatBadgeDate = (date?: string) => date && !Number.isNaN(Date.parse(date)) ? new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;
  const badges = [
    { id: "completed", icon: Award, title: "Tasks completed", description: "Recognises completed work recorded in your application history.", criteria: "A company marks work as complete after submission.", earned: completed.length > 0, progress: completed.length ? 100 : 0, progressLabel: completed.length ? `${completed.length} completed task${completed.length === 1 ? "" : "s"} recorded` : "Complete an assignment and have the company record it as complete.", note: `${completed.length} completed task${completed.length === 1 ? "" : "s"}`, earnedDate: formatBadgeDate(completedDates[0]), evidence: "Completion is based on company-recorded application activity." },
    { id: "verified", icon: BadgeCheck, title: "Verified skills", description: "Recognises certificates added to your professional profile.", criteria: "Upload a certificate to your profile.", earned: certificates.length > 0, progress: certificates.length ? 100 : 0, progressLabel: certificates.length ? `${certificates.length} certificate${certificates.length === 1 ? "" : "s"} on your profile` : "Add a certificate in your profile to record this milestone.", note: `${certificates.length} certificate${certificates.length === 1 ? "" : "s"} uploaded`, earnedDate: formatBadgeDate(certificates.map((certificate) => certificate.uploadedAt).filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b))[0]), evidence: "Certificate upload is recorded in your profile. The app does not store a separate verification decision." },
    { id: "interview", icon: GraduationCap, title: "Interview ready", description: "Recognises an interview invitation received through an application.", criteria: "Receive an interview invitation from a company.", earned: invites.length > 0, progress: invites.length ? 100 : 0, progressLabel: invites.length ? `${invites.length} invitation${invites.length === 1 ? "" : "s"} recorded` : "An interview invitation will be recorded here when received.", note: `${invites.length} invitation${invites.length === 1 ? "" : "s"} received`, earnedDate: formatBadgeDate(inviteDates[0]), evidence: "Based on interview invitation flags and activity stored with your applications." },
    { id: "unlocked", icon: UnlockKeyhole, title: "Interview fields unlocked", description: "Recognises skill fields that meet the current interview pathway thresholds.", criteria: `Enable the Interview track, complete ${policy.studentCompletedTasks} tasks in a field, and meet the company completion threshold of ${policy.companyFilledTasks} tasks.`, earned: interviewFields.length > 0, progress: interviewFields.length ? 100 : profile.track === "interview" ? Math.min(99, Math.round(strongestFieldTaskCount / interviewTaskTarget * 100)) : 0, progressLabel: interviewFields.length ? `${interviewFields.length} field${interviewFields.length === 1 ? "" : "s"} unlocked` : profile.track !== "interview" ? "Enable the Interview track to begin this pathway." : `${Math.min(strongestFieldTaskCount, policy.studentCompletedTasks)} of ${policy.studentCompletedTasks} student tasks in your strongest field; company thresholds also apply.`, note: interviewFields.length ? interviewFields.join(", ") : "No fields unlocked yet", earnedDate: null, evidence: "Unlocked fields are calculated from the existing student and company completion thresholds; the app does not store a separate unlock date." }
  ];
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const filteredBadges = badges.filter((badge) => badgeFilter === "all" || (badgeFilter === "earned" ? badge.earned : !badge.earned));
  const selectedBadge = badges.find((badge) => badge.id === selectedBadgeId) || null;
  const featuredBadge = badges.find((badge) => !badge.earned) || null;

  if (page === "applications") return <StudentApplications applications={applications} tasks={tasks} go={go} onSubmitWork={onSubmitWork} onWithdraw={onWithdraw} />;
  if (page === "notifications") return <main className="page student-side-page notifications-page">
    <div className="page-title notifications-heading"><div><span className="eyebrow">YOUR UPDATES</span><h1><BellRing size={22} /> Notifications</h1><p>Updates about your applications, interviews, and new tasks.</p></div><span className="notification-unread-summary">{unreadNotificationCount} unread</span></div>
    <div className="notifications-toolbar">
      <div className="notification-filters" role="group" aria-label="Filter notifications">
        {(["All", "Applications", "Interviews", "Tasks"] as const).map((category) => <button type="button" key={category} className={notificationFilter === category ? "selected" : ""} aria-pressed={notificationFilter === category} onClick={() => setNotificationFilter(category)}>{category}{category === "All" && <span>{notifications.length}</span>}</button>)}
      </div>
      <label className="notification-search"><Search size={17} /><input type="search" value={notificationQuery} onChange={(event) => setNotificationQuery(event.target.value)} placeholder="Search notifications..." aria-label="Search notifications" /></label>
      <button className="notification-mark-all" type="button" onClick={onMarkAllNotificationsRead} disabled={!unreadNotificationCount}><Check size={15} /> Mark all as read</button>
    </div>
    {notifications.length ? filteredNotifications.length ? <section className="notification-list" aria-label="Notification list">
      <div className="notification-list-heading"><h2>Recent updates</h2><span>{filteredNotifications.length} notification{filteredNotifications.length === 1 ? "" : "s"}</span></div>
      {filteredNotifications.map(({ id, icon: Icon, title, detail, category, createdAt, destination }) => {
        const unread = !readNotificationIds.includes(id);
        const dateLabel = createdAt && !Number.isNaN(Date.parse(createdAt)) ? new Date(createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Recently added";
        return <button className={`notification-row ${unread ? "is-unread" : ""}`} key={id} type="button" onClick={() => { onMarkNotificationRead(id); go(destination); }}>
          <span className={`notification-dot category-${category.toLowerCase()}`}><Icon size={18} /></span>
          <span className="notification-content"><strong>{title}</strong><span>{detail}</span><small>{dateLabel}</small></span>
          <span className={`notification-category category-${category.toLowerCase()}`}>{category === "Applications" ? "Application" : category.slice(0, -1)}</span>
          {unread && <i className="notification-unread-dot" aria-label="Unread" />}
        </button>;
      })}
    </section> : <div className="empty notifications-empty-state"><Search /><h2>No matching notifications</h2><p>Try another category or search term.</p><button className="secondary-btn" type="button" onClick={() => { setNotificationFilter("All"); setNotificationQuery(""); }}>Clear filters</button></div> : <div className="empty notifications-empty-state"><Bell /><h2>You’re all caught up</h2><p>New invitations and verified task matches will appear here.</p><button className="primary" type="button" onClick={() => go("tasks")}>Browse tasks</button></div>}
  </main>;
  return <main className="page student-side-page achievement-centre">
    <div className="page-title achievement-heading"><div><span className="eyebrow">CAREER RECORD</span><h1><Award size={24} /> My Achievements</h1><p>Badges recognise your skills, completed work and professional milestones.</p></div></div>
    <section className="achievement-overview" aria-label="Achievement overview">
      <article className="achievement-summary"><span className="achievement-summary-icon"><BadgeCheck size={18} /></span><div><span>Badges earned</span><strong>{earnedCount} <small>of {badges.length}</small></strong></div></article>
      <article className="achievement-summary"><span className="achievement-summary-icon"><Target size={18} /></span><div><span>Achievement progress</span><strong>{Math.round(earnedCount / badges.length * 100)}%</strong><div className="achievement-summary-track" role="progressbar" aria-label="Overall achievement progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(earnedCount / badges.length * 100)}><i style={{ width: `${earnedCount / badges.length * 100}%` }} /></div></div></article>
      <article className="achievement-summary"><span className="achievement-summary-icon"><Sparkles size={18} /></span><div><span>Still available</span><strong>{badges.length - earnedCount}</strong></div></article>
    </section>
    {featuredBadge && <section className="achievement-featured" aria-labelledby="featured-achievement-title"><div className="achievement-featured-icon"><featuredBadge.icon size={23} /></div><div className="achievement-featured-copy"><span className="achievement-kicker">NEXT MILESTONE</span><h2 id="featured-achievement-title">{featuredBadge.title}</h2><p>{featuredBadge.description}</p><small>{featuredBadge.criteria}</small><div className="achievement-progress-label"><span>{featuredBadge.progressLabel}</span><strong>{featuredBadge.progress}%</strong></div><div className="achievement-progress-track" role="progressbar" aria-label={`${featuredBadge.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={featuredBadge.progress}><i style={{ width: `${featuredBadge.progress}%` }} /></div></div></section>}
    <section className="achievement-collection" aria-labelledby="achievement-collection-title">
      <div className="achievement-collection-heading"><div><h2 id="achievement-collection-title">Badge collection</h2><p>{earnedCount} earned · {badges.length - earnedCount} available</p></div><div className="achievement-filters" role="group" aria-label="Filter badges">{([ ["all", "All"], ["earned", "Earned"], ["locked", "Locked"] ] as const).map(([filter, label]) => <button type="button" key={filter} aria-pressed={badgeFilter === filter} className={badgeFilter === filter ? "selected" : ""} onClick={() => setBadgeFilter(filter)}>{label}<span>{filter === "all" ? badges.length : filter === "earned" ? earnedCount : badges.length - earnedCount}</span></button>)}</div></div>
      {filteredBadges.length ? <div className="achievement-grid">{filteredBadges.map(({ id, icon: Icon, title, description, earned, note }) => <button type="button" className={`achievement-card ${earned ? "is-earned" : "is-locked"}`} key={id} onClick={(event) => { badgeTriggerRef.current = event.currentTarget; setSelectedBadgeId(id); }} aria-label={`${title}, ${earned ? "earned" : "locked"}. View details`}>
        <span className="achievement-card-icon"><Icon size={22} /></span><span className="achievement-card-status">{earned ? <><CircleCheck size={14} /> Earned</> : "Available"}</span><strong>{title}</strong><p>{description}</p><small>{earned ? note : "View criteria"}</small><span className="achievement-card-link">View details <ChevronRight size={14} /></span>
      </button>)}</div> : <div className="achievement-empty"><BadgeCheck size={22} /><strong>{badgeFilter === "earned" ? "No achievements earned yet" : "No locked achievements remain"}</strong><p>{badgeFilter === "earned" ? "Complete work, add certificates or receive an interview invitation to record your first milestone." : "You have earned every achievement currently tracked in GradLink."}</p></div>}
    </section>
    {selectedBadge && <div className="achievement-detail-backdrop" role="presentation" onClick={closeBadgeDetails}><section className="achievement-detail" role="dialog" aria-modal="true" aria-labelledby="achievement-detail-title" onClick={(event) => event.stopPropagation()}>
      <div className="achievement-detail-head"><div className={`achievement-card-icon ${selectedBadge.earned ? "is-earned" : "is-locked"}`}><selectedBadge.icon size={23} /></div><button ref={badgeCloseRef} className="icon-btn" type="button" aria-label="Close achievement details" onClick={closeBadgeDetails}><X size={18} /></button></div>
      <span className="achievement-kicker">{selectedBadge.earned ? "ACHIEVEMENT EARNED" : "ACHIEVEMENT AVAILABLE"}</span><h2 id="achievement-detail-title">{selectedBadge.title}</h2><p>{selectedBadge.description}</p>
      <div className="achievement-detail-section"><strong>Criteria</strong><p>{selectedBadge.criteria}</p></div>
      <div className="achievement-detail-section"><strong>Status</strong><p>{selectedBadge.earned ? "Earned" : "Not yet earned"}{selectedBadge.earnedDate ? ` · ${selectedBadge.earnedDate}` : selectedBadge.earned ? " · Date not recorded" : ""}</p></div>
      <div className="achievement-detail-section"><strong>Record</strong><p>{selectedBadge.evidence}</p></div>
    </section></div>}
  </main>;
}

function TaskCard({ task, onOpen, onApply, onView, applyDisabled = false, applyLabel = "Apply" }: {
  task: Task;
  onOpen: () => void;
  onApply: () => void;
  onView: () => void;
  applyDisabled?: boolean;
  applyLabel?: string;
}) {
  return (
    <article className="task-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    }}>
      <div className="company-row">
        <div className="company-logo">{task.company.charAt(0)}</div>
        <div className="company-meta">
          <strong>{task.company}</strong>
          {task.verified && <ShieldCheck size={15} className="verified" />}
          <span><Star size={13} fill="currentColor" /> {task.rating}</span>
        </div>
        <ChevronRight size={18} className="muted" />
      </div>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <div className="pills">
        <span className="pill blue">{money(task)}</span>
        <span className="pill gold"><Clock3 size={13} /> {task.deadline}</span>
        <span className="pill light">{task.skill}</span>
        <span className="pill light">{task.level || "Intermediate"}</span>
      </div>
      <div className="task-footer">
        <span>{task.applicants} applied</span>
        <span className="match"><Zap size={13} /> Skill match {task.match}%</span>
        <div className="task-actions">
          <button type="button" className="secondary-btn" onClick={(e) => { e.stopPropagation(); onView(); }}>
            View
          </button>
          <button type="button" className="apply-mini" disabled={applyDisabled} onClick={(e) => { e.stopPropagation(); onApply(); }}>
            {applyLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

function Detail({ task, applied, interviewTrack, onApply }: { task: Task; applied: boolean; interviewTrack: boolean; onApply: () => void }) {
  return (
    <div className="page detail-page">
      <div className="detail-head">
        <span className="eyebrow">{task.skill} TASK</span>
        <h1>{task.title}</h1>
        <div className="company-card">
          <div className="company-logo large">{task.company.charAt(0)}</div>
          <div>
            <strong>{task.company}</strong>
            <div className="subline">{task.verified && <><ShieldCheck size={14} /> Verified · </>}<Star size={13} fill="currentColor" /> {task.rating} · company rating</div>
          </div>
        </div>
      </div>

      <section className="detail-section">
        <h2>About the task</h2>
        <p>{task.description} The selected student will receive the agreed scope before starting and the payment remains secured until the company approves the work. Clear communication and a usable final file are expected.</p>
      </section>

      <section className="budget-box">
        <span>Total budget</span>
        <strong>{money(task)}</strong>
        <small>Estimated student amount: $${Math.round(task.budget * 0.9)} · estimated platform fee: $${Math.round(task.budget * 0.1)}. Prototype only; no payment or escrow is processed.</small>
      </section>

      <section className="detail-section">
        <h2>Skills</h2>
        <div className="pills">
          <span className="pill light">{task.skill}</span>
          <span className="pill light">{task.level}</span>
          <span className="pill light">Communication</span>
          <span className="pill light">Reliability</span>
        </div>
      </section>

      <section className="detail-section">
        <h2>Deadline</h2>
        <div className="deadline"><CalendarDays size={19} /><strong>{task.deadline}</strong></div>
      </section>

      <section className="detail-section">
        <h2>Applicants</h2>
        <p>{task.applicants} student{task.applicants === 1 ? " has" : "s have"} applied so far.</p>
      </section>

      <div className="sticky-apply">
        <button className="primary full" disabled={applied || (interviewTrack && !["Professional", "Advanced"].includes(task.level))} onClick={onApply}>
          {applied ? "Application submitted ✓" : interviewTrack && !["Professional", "Advanced"].includes(task.level) ? "Professional+ for interviews" : "APPLY FOR THIS TASK"}
        </button>
      </div>
    </div>
  );
}

function SignupPromptModal({ task, onClose, onSignup }: { task: Task; onClose: () => void; onSignup: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="modal-backdrop signup-prompt-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal signup-prompt" role="dialog" aria-modal="true" aria-labelledby="signup-prompt-title">
      <button type="button" className="icon-btn signup-prompt-close" aria-label="Close sign-up prompt" onClick={onClose}><X size={18} /></button>
      <span className="signup-prompt-icon"><Zap size={22} /></span>
      <span className="eyebrow">YOUR NEXT OPPORTUNITY</span>
      <h2 id="signup-prompt-title">Sign up to start earning</h2>
      <p>Create your free student account to apply for this task and get paid for your skills.</p>
      <div className="signup-prompt-task"><div><strong>{task.title}</strong><small>{task.company}</small></div><span>{money(task)}</span></div>
      <button type="button" className="primary full signup-prompt-cta" onClick={onSignup}>Sign up to start earning <ArrowRight size={17} /></button>
      <button type="button" className="signup-prompt-later" onClick={onClose}>Maybe later</button>
    </motion.section>
  </div>;
}

function StudentProfile({ toast, profile, applications, tasks, policy, completedByField, interviewFields, certificates, canInterview, onSave, onUploadCertificate, onRemoveCertificate, onOpenCertificate, go }: {
  toast: (m: string) => void;
  profile: StudentProfileData;
  applications: Application[];
  tasks: Task[];
  policy: InterviewPolicy;
  completedByField: Partial<Record<Skill, number>>;
  interviewFields: Skill[];
  certificates: CertificateMeta[];
  canInterview: boolean;
  onSave: (profile: StudentProfileData) => void;
  onUploadCertificate: (files: FileList | null) => void;
  onRemoveCertificate: (certificate: CertificateMeta) => void;
  onOpenCertificate: (certificate: CertificateMeta) => void;
  go: (page: string) => void;
}) {
  const [profileView, setProfileView] = useState<"overview" | "personal" | "professional">("overview");
  const [showEditOptions, setShowEditOptions] = useState(false);
  const [name, setName] = useState(profile.name);
  const [school, setSchool] = useState(profile.school);
  const [location, setLocation] = useState(profile.location);
  const [avatarDataUrl, setAvatarDataUrl] = useState(profile.avatarDataUrl || "");
  const [studyField, setStudyField] = useState<Skill>(profile.studyField);
  const [track, setTrack] = useState<StudentTrack>(profile.track);
  const [paymentProvider, setPaymentProvider] = useState<StudentProfileData["paymentProvider"]>(profile.paymentProvider);
  const [paymentNumber, setPaymentNumber] = useState(profile.paymentNumber || "");
  const profileStrength = (profile.name.trim() ? 20 : 0) + (profile.school.trim() ? 20 : 0) + (profile.location.trim() ? 15 : 0) + (profile.studyField ? 15 : 0) + (profile.track ? 10 : 0) + (certificates.length ? 20 : 0);
  const missingProfileItem = !profile.name.trim() ? "Add your name" : !profile.school.trim() ? "Add your school or qualification" : !profile.location.trim() ? "Add your location" : !certificates.length ? "Upload a certificate to reach 100%" : "Your profile is complete";
  const completedTasks = completedByField[profile.studyField] || 0;
  const completedApplications = applications.filter((application) => application.status === "completed");
  const totalCompletedTasks = new Set(completedApplications.map((application) => application.taskId)).size;
  const skillProgress = Array.from(new Set(completedApplications.map((application) => tasks.find((task) => task.id === application.taskId)?.skill).filter((skill): skill is Skill => Boolean(skill)))).map((skill) => {
    const records = completedApplications.filter((application) => tasks.find((task) => task.id === application.taskId)?.skill === skill);
    const rated = records.filter((application) => application.rating);
    const average = rated.length ? rated.reduce((sum, application) => sum + (application.rating || 0), 0) / rated.length : 0;
    const taskProgress = Math.min(100, records.length / Math.max(1, policy.studentCompletedTasks) * 100);
    const reviewProgress = average ? average / 5 * 100 : taskProgress;
    const progress = Math.round(taskProgress * 0.7 + reviewProgress * 0.3);
    return { skill, count: records.length, average, progress, ratedCount: rated.length };
  }).sort((a, b) => b.progress - a.progress || b.count - a.count).slice(0, 5);
  const skillsTracked = new Set([...skillProgress.map(({ skill }) => skill), profile.studyField]).size;
  const skillsWithReviews = skillProgress.filter(({ ratedCount }) => ratedCount > 0).length;
  const activeCount = applications.filter((application) => application.status === "accepted").length;
  const summary = `${totalCompletedTasks} task${totalCompletedTasks === 1 ? "" : "s"} completed in ${profile.studyField}; ${activeCount} active assignment${activeCount === 1 ? "" : "s"}.`;
  const reputation = Math.min(100, 30 + totalCompletedTasks * 10 + certificates.length * 5);

  return (
    <div className="page">
      {profileView === "overview" ? <>
      <section className="profile-hero">
        <Avatar initials={initialsFromName(profile.name)} size={80} src={profile.avatarDataUrl} />
        <div>
          <h1>{profile.name}</h1>
          <p>{profile.school} • {profile.location}</p>
        </div>
        <button className="outline-btn" onClick={() => setShowEditOptions((value) => !value)}>Edit profile</button>
      </section>
      {showEditOptions && <div className="profile-edit-options"><button type="button" className="secondary-btn" onClick={() => { setProfileView("personal"); setShowEditOptions(false); }}>Edit personal profile</button><button type="button" className="secondary-btn" onClick={() => { setProfileView("professional"); setShowEditOptions(false); }}>Edit professional profile</button></div>}
      <section className="skill-growth-profile">
        <h2>Your Skill Growth</h2>
        <p className="skill-growth-intro">Track your progress, showcase your strengths, and discover what to improve next.</p>
        <div className="skill-growth-stats">
          <div className="skill-growth-stat"><Layers3 size={19} /><strong>{skillsTracked}</strong><span>Skills tracked</span></div>
          <div className="skill-growth-stat"><CircleCheck size={19} /><strong>{skillsWithReviews}</strong><span>Skills with company reviews</span></div>
        </div>
        <div className="skill-growth-title"><h3>Your skills</h3><span>{skillProgress.length ? `Top ${skillProgress.length}` : "No completed skills yet"}</span></div>
        {skillProgress.length ? <div className="profile-skill-list">{skillProgress.map(({ skill, count, average, progress, ratedCount }) => <div className="profile-skill-item" key={skill}>
          <div className="profile-skill-heading"><strong>{skill}</strong><b>{progress}%</b></div>
          <div className="profile-skill-subline">{count} completed task{count === 1 ? "" : "s"}{ratedCount ? ` · ${average.toFixed(1)} / 5 average review` : " · Awaiting company reviews"}</div>
          <div className="profile-skill-track" role="progressbar" aria-label={`${skill} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        </div>)}</div> : <div className="chart-empty">Completed tasks will appear here as your skill history grows.</div>}
        <p className="skill-growth-footnote">Progress blends completed tasks toward your {policy.studentCompletedTasks}-task field goal with company reviews where available.</p>
        <div className="skill-growth-next"><Target size={22} /><div><h3>Recommended next step</h3><p>{skillProgress.length ? `Complete another ${skillProgress[0].skill} task to keep building your experience and review history.` : `Complete a practical ${profile.studyField} task to build your portfolio and demonstrate your skills.`}</p><button type="button" className="text-btn" onClick={() => go("tasks")}>Explore matching tasks <ArrowRight size={15} /></button></div></div>
      </section>
      <section className="dashboard-panel profile-strength-panel profile-page-strength"><h2><UserRound size={19} /> Profile strength</h2><div className="strength-score"><strong>{profileStrength}%</strong><span>— {profileStrength >= 80 ? "Strong profile" : "Keep building"}</span></div><div className="progress strength-progress" role="progressbar" aria-label="Profile strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileStrength}><span style={{ width: `${profileStrength}%` }} /></div><p><Link2 size={15} /> {missingProfileItem}</p></section>
      </> : <>
      <WorkspaceBackButton label="Back to profile" onClick={() => setProfileView("overview")} />
      {profileView === "personal" ? <>
        <div className="page-title"><span className="eyebrow">PERSONAL PROFILE</span><h1>Edit personal information</h1><p>Update your name and location details.</p></div>
        <div className="profile-picture-editor"><Avatar initials={initialsFromName(name)} size={76} src={avatarDataUrl || undefined} /><div><strong>Profile picture</strong><small>Choose a JPG, PNG, or WebP image. It will be cropped to a square.</small><div className="profile-picture-actions"><label className="secondary-btn profile-picture-upload">{avatarDataUrl ? "Change picture" : "Upload picture"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { toast("Choose a JPG, PNG, or WebP image under 5 MB"); return; }
          void resizeProfileImage(file).then(setAvatarDataUrl).catch(() => toast("Could not load that profile picture"));
        }} /></label>{avatarDataUrl && <button type="button" className="text-btn" onClick={() => setAvatarDataUrl("")}>Remove</button>}</div></div></div>
        <form className="form-card profile-edit" onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || !location.trim()) {
            toast("Enter your name and location before saving");
            return;
          }
          onSave({ ...profile, name: name.trim(), location: location.trim(), avatarDataUrl: avatarDataUrl || undefined });
          setProfileView("overview"); toast("Personal profile saved");
        }}>
          <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Location<input required value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          <button className="primary" type="submit">Save personal profile</button>
        </form>
      </> : <>
        <div className="page-title"><span className="eyebrow">PROFESSIONAL PROFILE</span><h1>Education and work preferences</h1><p>Manage your student registration, skills, certificates, and payment details.</p></div>
        <form className="form-card profile-edit" onSubmit={(event) => {
          event.preventDefault();
          if (!school.trim()) { toast("Enter your school or qualification"); return; }
          onSave({ ...profile, school: school.trim(), studyField, track });
          toast("Professional profile saved");
        }}>
          <label>School and course<input required value={school} onChange={(event) => setSchool(event.target.value)} /></label>
          <label>Field of study
            <select value={studyField} onChange={(event) => setStudyField(event.target.value as Skill)}>
              {SKILL_OPTIONS.map((field) => <option key={field} value={field}>{field}</option>)}
            </select>
          </label>
          <label>Account goal
            <select value={track} onChange={(event) => {
              const nextTrack = event.target.value as StudentTrack;
              if (nextTrack === "interview" && !canInterview) { toast("Professional or Advanced package is required to unlock interviews"); return; }
              setTrack(nextTrack);
            }}>
              <option value="earning">Earn through tasks</option>
              <option value="interview" disabled={!canInterview}>Earn and pursue interviews{canInterview ? "" : " (Professional package required)"}</option>
            </select>
          </label>
          <button className="primary" type="submit">Save professional profile</button>
        </form>

      <section className="section registration-card">
        <span className="eyebrow">STUDENT REGISTRATION</span>
        <h2>Choose your path</h2>
        <p>Study field: <strong>{profile.studyField}</strong> · {profile.track === "earning" ? "Earning track" : "Interview track"}</p>
        {profile.track === "interview" && (
          <p className="form-note">Interview work starts at Professional level. Complete {policy.studentCompletedTasks} tasks in {profile.studyField} to qualify; completed so far: {completedTasks}.</p>
        )}
        <label className="upload-label">Upload certificates (PDF, JPG or PNG; up to 5 MB each)
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={(event) => {
            onUploadCertificate(event.currentTarget.files);
            event.currentTarget.value = "";
          }} />
        </label>
        {certificates.length ? <div className="certificate-list">
          {certificates.map((certificate) => (
            <div className="certificate-row" key={certificate.id}>
              <span><strong>{certificate.name}</strong><small>{(certificate.size / 1024 / 1024).toFixed(2)} MB · uploaded {new Date(certificate.uploadedAt).toLocaleDateString()}</small></span>
              <button type="button" className="text-btn" onClick={() => onOpenCertificate(certificate)}>View</button>
              <button type="button" className="danger-btn" onClick={() => onRemoveCertificate(certificate)}>Remove</button>
            </div>
          ))}
        </div> : <p className="form-note">No certificates uploaded yet.</p>}
      </section>

      {profile.track === "interview" && interviewFields.length > 0 && (
        <section className="section opportunity-card">
          <h2>Interview opportunities</h2>
          <p>You meet the task-completion threshold in fields where companies have reached their hiring threshold:</p>
          <div className="pills">{interviewFields.map((field) => <span className="pill blue" key={field}>{field}</span>)}</div>
        </section>
      )}
      {applications.some((application) => application.interviewInvited) && (
        <section className="section opportunity-card">
          <h2>Interview invitations</h2>
          {applications.filter((application) => application.interviewInvited).map((application) => {
            const task = tasks.find((item) => item.id === application.taskId);
            return <p key={application.id}><strong>{task?.company || "Company"}</strong> invited you to interview for {task?.skill || "a role"} ({task?.title || "task"}).</p>;
          })}
        </section>
      )}

      <div className="reputation">
        <div className="ring"><strong>{reputation}</strong><span>/100</span></div>
        <div>
          <h3>Reputation</h3>
          <p>Based on completed tasks and uploaded certificates.</p>
        </div>
      </div>

      <section className="section payment-details">
        <h2><Wallet size={19} /> Payment details</h2>
        <p>Add the account where companies should send your task payments.</p>
        <div className="two-col">
          <label>Payment method
            <select value={paymentProvider || ""} onChange={(event) => setPaymentProvider((event.target.value || undefined) as StudentProfileData["paymentProvider"])}>
              <option value="">Choose a method</option>{paymentOptions.map((option) => <option key={option.name}>{option.name}</option>)}
            </select>
          </label>
          <label>Account or phone number<input value={paymentNumber} onChange={(event) => setPaymentNumber(event.target.value)} placeholder="Enter your payment number" /></label>
        </div>
        <div className="payment-provider-options" aria-label="Payment method icons">
          {paymentOptions.map((option) => <button type="button" className={paymentProvider === option.name ? "payment-provider selected" : "payment-provider"} key={option.name} onClick={() => setPaymentProvider(option.name)} aria-label={`Select ${option.name}`}>
            <img src={option.logo} alt="" loading="lazy" /><span>{option.name}</span>
          </button>)}
        </div>
        <button className="primary" type="button" onClick={() => { onSave({ ...profile, paymentProvider, paymentNumber: paymentNumber.trim() }); toast("Payment details saved"); }}>Save payment details</button>
        <p className="form-note">Only share details needed to receive payment. This prototype stores them in this browser.</p>
      </section>
      <section className="section career-summary">
        <span className="eyebrow">YOUR WORK HISTORY</span>
        <h2>Career summary</h2>
        <p>{summary}</p>
        <p>{profile.name} · {profile.school} · {profile.location}</p>
        <button className="primary" type="button" onClick={() => {
          const rows = applications.filter((application) => application.status === "completed").map((application) => {
            const task = tasks.find((item) => item.id === application.taskId);
            return `- ${task?.title || "Completed task"} | ${task?.skill || "Field not recorded"} | ${task?.company || "Company"} | ${new Date(application.createdAt).toLocaleDateString()}`;
          });
          const cvText = `${profile.name}\n${profile.school} · ${profile.location}\n\nCAREER SUMMARY\n${summary}\n\nCOMPLETED WORK\n${rows.length ? rows.join("\n") : "No completed task history yet."}\n\nCERTIFICATES\n${certificates.length ? certificates.map((certificate) => `- ${certificate.name}`).join("\n") : "No certificates uploaded."}`;
          const blob = new Blob([cvText], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${profile.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "student"}-work-history.txt`; anchor.click(); URL.revokeObjectURL(url);
        }}>Download work history for your CV</button>
        <p className="form-note">Downloads a CV-ready text file with your completed tasks and certificate names. Add your certificate files separately.</p>
      </section>
      </>}
      </>}
    </div>
  );
}

function CompanyDashboard({ tasks, applications, companyName, go }: {
  tasks: Task[];
  applications: Application[];
  companyName: string;
  go: (page: string) => void;
}) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const companyApplications = applications.filter((application) => taskIds.has(application.taskId));
  const totalApplicants = companyApplications.length;
  const hires = companyApplications.filter((application) => application.status === "completed").length;
  const companyRating = tasks.length ? tasks.reduce((total, task) => total + task.rating, 0) / tasks.length : null;
  const recentApplications = companyApplications
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3);
  const acceptedTaskValue = companyApplications
    .filter((application) => application.status === "accepted")
    .reduce((value, application) => {
      const task = tasks.find((item) => item.id === application.taskId);
      if (task) value[task.payment] += task.budget;
      return value;
    }, { USD: 0, EcoCash: 0 });
  const completedBySkill = tasks.map((task) => ({
    task,
    completed: companyApplications.filter((application) => application.taskId === task.id && application.status === "completed").length
  })).filter(({ completed }) => completed > 0).slice(0, 6);

  return (
    <div className="page company-dashboard">
      <div className="page-title">
        <h1>Company Dashboard - {companyName}</h1>
        <p>Manage your posted tasks, review student applicants and track delivery — all in one place.</p>
      </div>

      <div className="metrics-grid company-metrics">
        <div className="metric-card"><span>Tasks posted</span><strong>{tasks.length}</strong><small>{tasks.filter((task) => task.verified).length} verified listings</small></div>
        <div className="metric-card"><span>Applications received</span><strong>{totalApplicants}</strong><small>Across your task listings</small></div>
        <div className="metric-card"><span>Hires completed</span><strong>{hires}</strong><small>Marked complete</small></div>
        <div className="metric-card"><span>Average company rating</span><strong>{companyRating === null ? "—" : `${companyRating.toFixed(1)} / 5`}</strong><small>{tasks.length ? "Average listing rating" : "Shown when listings are rated"}</small></div>
      </div>

      <div className="company-dashboard-layout">
        <div className="company-main-column">
          <section className="dashboard-panel company-task-summary">
            <div className="section-title"><div><h2>Your task listings</h2><p>Summary of tasks posted by your company</p></div><button className="text-btn" type="button" onClick={() => go("company-jobs")}>Manage tasks</button></div>
            <div className="metrics-grid company-listing-metrics">
              <div className="metric-card"><span>Tasks posted</span><strong>{tasks.length}</strong></div>
              <div className="metric-card"><span>Published</span><strong>{tasks.filter((task) => task.verified).length}</strong></div>
              <div className="metric-card"><span>Pending review</span><strong>{tasks.filter((task) => !task.verified).length}</strong></div>
            </div>
            {tasks.length ? <div className="jobs-panel">
              {tasks.slice(0, 4).map((task) => <div className="job-row" key={task.id}>
                <div><strong>{task.title}</strong><small>{task.skill} · {money(task)} · {applications.filter((application) => application.taskId === task.id).length} applications</small></div>
                <span className={`status-pill ${task.verified ? "open" : "review"}`}>{task.verified ? "Published" : "Pending review"}</span>
              </div>)}
              {tasks.length > 4 && <button className="secondary-btn full-btn" type="button" onClick={() => go("company-jobs")}>View all {tasks.length} tasks</button>}
            </div> : <div className="empty"><BriefcaseBusiness /><h2>No tasks posted yet</h2><p>Post a task from the side panel to start receiving applications.</p></div>}
          </section>
        </div>
        <aside className="company-sidebar">
          <section className="dashboard-panel company-inbox">
            <div className="section-title"><div><h2>Student applicants</h2><p>Recent candidates for your tasks</p></div><button className="text-btn" type="button" onClick={() => go("company-applicants")}>View all</button></div>
            <div className="jobs-panel">
              <div className="application-summary-count"><strong>{totalApplicants}</strong><span>applications received across your task listings</span></div>
              {recentApplications.map((application) => {
                const task = tasks.find((item) => item.id === application.taskId);
                return <div className="job-row" key={application.id}>
                  <div className="candidate-heading"><Avatar initials={initialsFromName(application.studentName || "Student")} size={34} /><span><strong>{application.studentName || "Student"}</strong><small>{task?.title || "Task listing"}</small></span></div>
                  <span className={`status-pill ${application.status === "accepted" || application.status === "completed" ? "open" : "review"}`}>{(application.status || "applied").replace("-", " ")}</span>
                </div>;
              })}
              {!recentApplications.length && <div className="empty"><Users /><h2>No applicants yet</h2><p>New applications to your listings will appear here.</p></div>}
            </div>
            <button className="secondary-btn full-btn" type="button" onClick={() => go("company-applicants")}>Review applicants</button>
          </section>
          <section className="dashboard-panel">
            <h2>Payouts / escrow</h2>
            <div className="escrow-summary"><span>Accepted task budget</span><strong>USD ${acceptedTaskValue.USD.toFixed(2)}<br />EcoCash ${acceptedTaskValue.EcoCash.toFixed(2)}</strong></div>
            <p className="form-note">Prototype only — funds are not held, transferred, or withdrawn in this app.</p>
            <button className="secondary-btn full-btn" type="button" disabled>Withdraw unavailable</button>
          </section>
          <section className="dashboard-panel">
            <h2>Task completion</h2>
            {completedBySkill.length ? completedBySkill.map(({ task, completed }) => <div className="completion-row" key={task.id}><div><span>{task.title}</span><strong>{completed}</strong></div><div className="progress"><span style={{ width: `${Math.min(100, completed / Math.max(1, task.applicants) * 100)}%` }} /></div></div>) : <p>Completed task activity will appear here once a company marks work complete.</p>}
            <div className="completion-total"><strong>Completion rate</strong><span>{totalApplicants ? `${Math.round(hires / totalApplicants * 100)}%` : "—"}</span></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function CompanyJobs({ tasks, applications, companyName, onCompanyName, onCreateTask, companyVerified, embedded = false, go }: {
  tasks: Task[];
  applications: Application[];
  companyName: string;
  onCompanyName: (name: string) => void;
  onCreateTask: (task: Omit<Task, "id" | "applicants" | "match" | "rating" | "verified" | "mine">) => void;
  companyVerified: boolean;
  embedded?: boolean;
  go: (page: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [payment, setPayment] = useState<"USD" | "EcoCash">("USD");
  const [skill, setSkill] = useState<Skill>("Coding");
  const [level, setLevel] = useState<WorkLevel>("Intermediate");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (interviewLevels.includes(level) && !companyVerified) {
      setError("Professional and Advanced tasks are only for verified companies. Please upload company registration to get verified.");
      return;
    }
    const amount = Number(budget);
    if (!companyName.trim() || !title.trim() || description.trim().length < 10 || !Number.isFinite(amount) || amount <= 0 || !deadline) {
      setError("Enter a company name, complete task details, a positive budget and deadline.");
      return;
    }
    onCreateTask({
      company: companyName.trim(),
      title: title.trim(),
      description: description.trim(),
      budget: amount,
      payment,
      skill,
      level,
      deadline
    });
    setTitle("");
    setDescription("");
    setBudget("");
    setDeadline("");
    setError("");
  };

  return (
    <div className={embedded ? "company-jobs embedded" : "page company-jobs"}>
      <div className="page-title">
        <h1>{embedded ? "Post new task" : "Post and manage tasks"}</h1>
        <p>Listings are saved in this browser and appear in the student marketplace.</p>
      </div>
      <form className="form-card" onSubmit={submit}>
        <label>Company name<input required value={companyName} onChange={(event) => onCompanyName(event.target.value)} placeholder="Your company" /></label>
        <label>Task title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Create a social media campaign" /></label>
        <label>Task brief<textarea required minLength={10} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the work and expected deliverables." /></label>
        <div className="two-col">
          <label>Budget<input required type="number" min="1" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
          <label>Payment method<select value={payment} onChange={(event) => setPayment(event.target.value as "USD" | "EcoCash")}><option value="USD">USD</option><option value="EcoCash">EcoCash</option></select></label>
        </div>
        <div className="two-col">
          <label>Field<select value={skill} onChange={(event) => setSkill(event.target.value as Skill)}>{SKILL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Required work level<select value={level} onChange={(event) => setLevel(event.target.value as WorkLevel)}>{workLevels.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
        <fieldset className="interview-levels"><legend>Interview level category</legend><p>Choose Professional or Advanced to indicate interview level work.</p>
          <div className="level-choice-grid">{interviewLevels.map((option) => <label key={option}><input type="radio" name="interview-level" checked={level === option} onChange={() => setLevel(option)} /> {option}</label>)}</div>
        </fieldset>
        <div className="two-col">
          <label>Deadline<input required type="date" min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="primary full" type="submit">Publish task listing</button>
        <p className="form-note">Prototype only: this does not collect or hold real escrow funds.</p>
      </form>
      <section className="section">
        <h2>Your listings</h2>
        {tasks.length ? tasks.map((task) => (
          <div className="job-row" key={task.id}>
            <div><strong>{task.title}</strong><small>{task.skill} · {money(task)} · {applications.filter((application) => application.taskId === task.id).length} applications</small></div>
            <span className={`status-pill ${task.verified ? "open" : "review"}`}>{task.verified ? "Published" : "Pending review"}</span>
          </div>
        )) : <div className="empty"><BriefcaseBusiness /><h2>No listings yet</h2><p>Complete the form above to publish your first task.</p></div>}
      </section>
    </div>
  );
}

function CompanyCandidates({ tasks, allTasks, applications, policy, onInviteInterview, go }: {
  tasks: Task[];
  allTasks: Task[];
  applications: Application[];
  policy: InterviewPolicy;
  onInviteInterview: (applicationId: string) => void;
  go: (page: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("All");
  const [dateRange, setDateRange] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskByIdAll = new Map(allTasks.map((task) => [task.id, task]));
  const skills = [...new Set(tasks.map((task) => task.skill))];
  const companyApplications = applications.filter((application) => taskById.has(application.taskId));
  const completedForStudent = (studentId: string, skill: Skill) => new Set(
    applications
      .filter((application) => application.studentId === studentId && application.status === "completed")
      .filter((application) => taskByIdAll.get(application.taskId)?.skill === skill)
      .map((application) => application.taskId)
  ).size;
  const datePresets = [{ value: "24h", label: "24 hours ago" }, { value: "7d", label: "7 days ago" }, ...Array.from({ length: 8 }, (_, index) => ({ value: `${index + 1}m`, label: `${index + 1} ${index ? "months" : "month"} ago` }))];
  const matchesDateRange = (date: Date) => {
    if (!Number.isFinite(date.getTime())) return false;
    const now = new Date();
    if (dateRange === "24h") return date.getTime() >= now.getTime() - 24 * 60 * 60 * 1000;
    if (dateRange === "7d") return date.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (/^[1-8]m$/.test(dateRange)) {
      const monthsAgo = Number(dateRange.slice(0, -1));
      const start = new Date(now);
      const targetMonth = now.getMonth() - monthsAgo;
      start.setDate(1);
      start.setMonth(targetMonth);
      start.setDate(Math.min(now.getDate(), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
      return date >= start;
    }
    if (dateRange === "custom") {
      const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const end = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
      return (!start || date >= start) && (!end || date <= end);
    }
    return true;
  };
  const candidates = applications.filter((application) => taskById.has(application.taskId)).filter((application) => {
    const task = taskById.get(application.taskId)!;
    if (selectedSkill !== "All" && task.skill !== selectedSkill) return false;
    const appliedDate = new Date(application.createdAt);
    if (!matchesDateRange(appliedDate)) return false;
    const search = query.trim().toLocaleLowerCase();
    return !search || task.skill.toLocaleLowerCase().includes(search);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <main className="page company-candidates-page">
    <div className="page-title"><span className="eyebrow">COMPANY INBOX</span><h1>Candidates</h1><p>Applications to tasks your company has posted.</p></div>
    <div className="candidate-search-row"><div className="search-box company-candidates-search"><Search size={18} /><input aria-label="Search candidates by skillset" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skillset" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={16} /></button>}</div><label className="candidate-select"><span>Date range</span><select aria-label="Filter candidates by date range" value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option value="">Any time</option>{datePresets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}<option value="custom">Custom date range</option></select></label></div>
    {dateRange === "custom" && <div className="candidate-custom-date-range"><label className="candidate-select"><span>From date</span><input aria-label="From date" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label><label className="candidate-select"><span>To date</span><input aria-label="To date" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label><button type="button" className="secondary-btn" onClick={() => { setDateRange(""); setFromDate(""); setToDate(""); }}>Clear dates</button></div>}
    <div className="filter-scroll candidate-filter-scroll"><button type="button" className={selectedSkill === "All" ? "selected" : ""} onClick={() => setSelectedSkill("All")}>All</button>{skills.map((skill) => <button type="button" key={skill} className={selectedSkill === skill ? "selected" : ""} onClick={() => setSelectedSkill(skill)}>{skill}</button>)}</div>
    <p className="candidate-results-count">{candidates.length} candidate{candidates.length === 1 ? "" : "s"}</p>
    {candidates.length ? <div className="jobs-panel">{candidates.map((application) => {
      const task = taskById.get(application.taskId)!;
      const completedCount = completedForStudent(application.studentId, task.skill);
      const companyCompletedCount = new Set(companyApplications
        .filter((item) => item.status === "completed" && taskById.get(item.taskId)?.skill === task.skill)
        .map((item) => item.taskId)).size;
      const alreadyInvited = companyApplications.some((item) => item.studentId === application.studentId
        && (item.interviewInvited || item.status === "interview-invited")
        && taskById.get(item.taskId)?.skill === task.skill);
      const interviewEligible = ["applied", "interview-invited"].includes(application.status)
        && application.studentTrack === "interview"
        && (task.level === "Professional" || task.level === "Advanced")
        && completedCount >= policy.studentCompletedTasks
        && companyCompletedCount >= policy.companyFilledTasks;
      return <article className="candidate-notification-card" key={application.id}>
        <Avatar initials={initialsFromName(application.studentName || "Student")} size={42} />
        <div className="candidate-notification-main"><strong>{application.studentName || "Student"}</strong><span>{task.title}</span><small>{task.skill} · Applied {new Date(application.createdAt).toLocaleDateString()}</small></div>
        <span className={`status-pill ${application.status === "accepted" || application.status === "completed" ? "open" : "review"}`}>{application.status.replace(/-/g, " ")}</span>
        <div className="candidate-interview-actions">
          {alreadyInvited
            ? <span className="candidate-interview-sent"><Check size={14} /> Interview invited</span>
            : <button type="button" className="secondary-btn" disabled={!interviewEligible} title={interviewEligible ? "Send an interview invitation" : `Requires Interview pathway, a Professional or Advanced listing, ${policy.studentCompletedTasks} completed student tasks in ${task.skill}, and ${policy.companyFilledTasks} completed company tasks in this field.`} onClick={() => onInviteInterview(application.id)}>Invite to interview</button>}
          {!alreadyInvited && !interviewEligible && <small className="candidate-interview-requirements">Interview criteria not met</small>}
        </div>
        <button type="button" className="secondary-btn" onClick={() => go("company-applicants")}>Review</button>
      </article>;
    })}</div> : <div className="empty"><Users /><h2>No candidates match</h2><p>Try another skill filter or date.</p></div>}
  </main>;
}

type CompanyProfileDetails = {
  industry: string;
  website: string;
  location: string;
  email: string;
  phone: string;
  description: string;
  logoFileId: string;
  documents: Array<{ kind: "registration" | "tax-clearance" | "director-id"; name: string; fileId: string; uploadedAt: string }>;
};

const companyIndustries = ["Technology", "Agriculture", "Arts & Entertainment", "Education", "Finance", "Healthcare", "Hospitality", "Manufacturing", "Non-profit", "Retail", "Transport", "Other"];
const companyDocumentTypes: Array<{ kind: CompanyProfileDetails["documents"][number]["kind"]; label: string }> = [
  { kind: "registration", label: "Business Registration Certificate" },
  { kind: "tax-clearance", label: "Tax Clearance Certificate" },
  { kind: "director-id", label: "Director ID / Passport" }
];

function CompanyProfile({ companyName, verification, tasks, applications, onSubmit, onUploadDocument, onDeleteDocument, onReadDocument, go, toast }: {
  companyName: string;
  verification: CompanyVerification | undefined;
  tasks: Task[];
  applications: Application[];
  onSubmit: (record: CompanyVerification) => void;
  onUploadDocument: (file: File) => Promise<string | null>;
  onDeleteDocument: (fileId: string) => Promise<void>;
  onReadDocument: (fileId: string) => Promise<Blob>;
  go: (page: string) => void;
  toast: (message: string, error?: boolean) => void;
}) {
  const profileKey = `${KEY}-company-profile-${encodeURIComponent(companyName.trim().toLowerCase())}`;
  const [profile, setProfile] = useState<CompanyProfileDetails>(() => {
    try {
      const saved = localStorage.getItem(profileKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CompanyProfileDetails>;
        return {
          industry: parsed.industry || "",
          website: parsed.website || verification?.documentLink || "",
          location: parsed.location || "",
          email: parsed.email || verification?.businessEmail || "",
          phone: parsed.phone || verification?.contactPhone || "",
          description: parsed.description || "",
          logoFileId: parsed.logoFileId || "",
          documents: Array.isArray(parsed.documents) ? parsed.documents : []
        };
      }
    } catch (error) {
      console.error("Could not load the company profile", error);
    }
    return {
      industry: "",
      website: verification?.documentLink || "",
      location: "",
      email: verification?.businessEmail || "",
      phone: verification?.contactPhone || "",
      description: "",
      logoFileId: "",
      documents: verification?.documentFileId && verification.documentName
        ? [{ kind: "registration", name: verification.documentName, fileId: verification.documentFileId, uploadedAt: verification.submittedAt || new Date().toISOString() }]
        : []
    };
  });
  const [draft, setDraft] = useState(profile);
  const [registrationNumber, setRegistrationNumber] = useState(verification?.registrationNumber || "");
  const [legalName, setLegalName] = useState(verification?.legalName || companyName);
  const [documentLink, setDocumentLink] = useState(verification?.documentLink || profile.website);
  const [contactName, setContactName] = useState(verification?.contactName || "");
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const status = verification?.status || "not-verified";
  const statusLabel = status === "verified" ? "Verified" : status === "pending" ? "Pending" : "Not Verified";
  const companyApplications = applications.filter((application) => tasks.some((task) => task.id === application.taskId));
  const hiredStudentCount = new Set(companyApplications.filter((application) => application.status === "accepted" || application.status === "completed").map((application) => application.studentId)).size;
  const completionFields = [companyName, profile.industry, profile.website, profile.location, profile.email, profile.phone, profile.description, profile.logoFileId];
  const completion = Math.round(completionFields.filter((field) => field.trim()).length / completionFields.length * 100);

  useEffect(() => {
    let objectUrl = "";
    if (profile.logoFileId) {
      void onReadDocument(profile.logoFileId).then((file) => {
        objectUrl = URL.createObjectURL(file);
        setLogoUrl(objectUrl);
      }).catch((readError: unknown) => {
        console.error("Could not load the company logo", readError);
        toast("Could not load the saved company logo", true);
      });
    } else {
      setLogoUrl("");
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile.logoFileId, onReadDocument]);

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      localStorage.setItem(profileKey, JSON.stringify(draft));
      setProfile(draft);
      toast("Company profile saved");
    } catch (saveError) {
      console.error("Could not save the company profile", saveError);
      toast("Could not save the company profile in this browser", true);
    }
  };

  const uploadProfileFile = async (file: File, kind: "logo" | CompanyProfileDetails["documents"][number]["kind"]) => {
    const isLogo = kind === "logo";
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = isLogo ? ["png", "jpg", "jpeg", "webp"] : ["pdf", "jpg", "jpeg", "png"];
    const maxSize = isLogo ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!allowed.includes(extension) || file.size > maxSize) {
      toast(isLogo ? "Choose a PNG, JPG or WebP logo up to 2 MB" : "Choose a PDF, JPG or PNG document up to 5 MB", true);
      return;
    }
    setUploading(kind);
    try {
      const fileId = await onUploadDocument(file);
      if (!fileId) return;
      if (isLogo) {
        setDraft((current) => ({ ...current, logoFileId: fileId }));
        setProfile((current) => ({ ...current, logoFileId: fileId }));
        try {
          localStorage.setItem(profileKey, JSON.stringify({ ...profile, logoFileId: fileId }));
        } catch (saveError) {
          console.error("Could not save the company logo reference", saveError);
          toast("Logo uploaded but its reference could not be saved", true);
          return;
        }
        toast("Company logo uploaded");
      } else {
        const document = { kind, name: file.name, fileId, uploadedAt: new Date().toISOString() };
        const updated = { ...profile, documents: [...profile.documents.filter((item) => item.kind !== kind), document] };
        try {
          localStorage.setItem(profileKey, JSON.stringify(updated));
          setProfile(updated);
          setDraft((current) => ({ ...current, documents: updated.documents }));
          toast(`${companyDocumentTypes.find((item) => item.kind === kind)?.label || "Document"} uploaded`);
        } catch (saveError) {
          console.error("Could not save the company document reference", saveError);
          await onDeleteDocument(fileId);
          toast("The document could not be saved to this browser", true);
        }
      }
    } catch (uploadError) {
      console.error("Could not upload company profile file", uploadError);
      toast("Could not upload the selected file", true);
    } finally {
      setUploading(null);
    }
  };

  const removeDocument = async (kind: CompanyProfileDetails["documents"][number]["kind"]) => {
    const document = profile.documents.find((item) => item.kind === kind);
    if (!document) return;
    try {
      await onDeleteDocument(document.fileId);
      const updated = { ...profile, documents: profile.documents.filter((item) => item.kind !== kind) };
      localStorage.setItem(profileKey, JSON.stringify(updated));
      setProfile(updated);
      setDraft((current) => ({ ...current, documents: updated.documents }));
      toast("Verification document removed");
    } catch (deleteError) {
      console.error("Could not remove the company verification document", deleteError);
      toast("Could not remove the verification document", true);
    }
  };

  const submitVerification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const freeDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "live.com"];
    const domain = profile.email.trim().split("@")[1]?.toLowerCase();
    if (!domain || freeDomains.includes(domain)) { setError("Use a company-domain business email, not a personal email address."); return; }
    const registration = profile.documents.find((document) => document.kind === "registration");
    if (!registration && !/^https?:\/\//i.test(documentLink.trim())) { setError("Upload a business registration certificate or provide a company website link."); return; }
    setError("");
    onSubmit({
      companyName,
      status: "pending",
      registrationNumber: registrationNumber.trim(),
      legalName: legalName.trim(),
      businessEmail: profile.email.trim(),
      documentName: registration?.name,
      documentFileId: registration?.fileId,
      documentLink: documentLink.trim() || profile.website.trim(),
      contactName: contactName.trim(),
      contactPhone: profile.phone.trim(),
      submittedAt: new Date().toISOString()
    });
    toast("Verification submitted for review");
  };

  return <main className="page company-profile-page">
    <div className="company-profile-heading"><div className="page-title"><span className="eyebrow">COMPANY PROFILE</span><h1>{companyName}</h1><p>Manage your company details and verification status.</p></div><span className={`company-verification-badge status-${status}`}>{status === "verified" ? <BadgeCheck size={17} /> : <i />} {statusLabel}</span></div>
    <div className="company-profile-layout">
      <div className="company-profile-main">
        <form className="dashboard-panel company-details-form" onSubmit={saveProfile}>
          <div className="company-profile-section-heading"><div><h2>Company Details</h2><p>Keep your company information current.</p></div><Building2 size={19} /></div>
          <div className="company-details-grid">
            <label>Company name<input value={companyName} readOnly aria-readonly="true" /></label>
            <label>Industry<select value={draft.industry} onChange={(event) => setDraft((current) => ({ ...current, industry: event.target.value }))} required><option value="">Select industry</option>{companyIndustries.map((industry) => <option key={industry}>{industry}</option>)}</select></label>
            <label><span><Globe size={14} /> Website</span><input type="url" value={draft.website} onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))} placeholder="https://yourcompany.co.zw" /></label>
            <label><span><MapPin size={14} /> Location</span><input value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Harare, Zimbabwe" /></label>
            <label><span><Mail size={14} /> Email address</span><input type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} placeholder="contact@company.co.zw" /></label>
            <label><span><Phone size={14} /> Phone number</span><input type="tel" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="+263 ..." /></label>
            <label className="company-description-field">Company description<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} maxLength={1000} rows={4} placeholder="Describe your company, what you do, and the kind of opportunities you offer." /></label>
          </div>
          <div className="company-profile-form-actions"><span>{draft.description.length}/1000</span><button className="primary" type="submit"><Save size={16} /> Save changes</button></div>
        </form>

        <section className="dashboard-panel company-recent-tasks">
          <div className="company-profile-section-heading"><div><h2>Recent Tasks</h2><p>Latest opportunities posted by your company.</p></div><button type="button" className="text-btn" onClick={() => go("company-jobs")}>View all <ChevronRight size={15} /></button></div>
          {tasks.length ? <div className="company-profile-table-wrap"><table className="company-profile-table"><thead><tr><th>Task</th><th>Status</th><th>Applicants</th><th>Deadline</th><th>Action</th></tr></thead><tbody>{tasks.slice(0, 5).map((task) => <tr key={task.id}><td><strong>{task.title}</strong><small>{task.skill} · {money(task)}</small></td><td><span className={`status-pill ${task.verified ? "open" : "review"}`}>{task.verified ? "Open" : "In Review"}</span></td><td>{applications.filter((application) => application.taskId === task.id).length}</td><td>{task.deadline}</td><td><button type="button" className="text-btn" onClick={() => go("company-jobs")}>View</button></td></tr>)}</tbody></table></div> : <div className="empty"><BriefcaseBusiness /><h2>No tasks posted yet</h2><p>Your company’s latest task listings will appear here.</p></div>}
        </section>
      </div>

      <aside className="company-profile-sidebar">
        <section className="dashboard-panel company-logo-card">
          <h2>Company Logo</h2>
          <div className="company-logo-preview">{logoUrl ? <img src={logoUrl} alt={`${companyName} logo`} /> : <span>{companyName.trim().charAt(0).toUpperCase() || <Building2 size={30} />}</span>}</div>
          <label className="company-logo-upload"><Upload size={15} /><span>{uploading === "logo" ? "Uploading..." : "Upload new logo"}<small>PNG, JPG or WebP · up to 2 MB</small></span><input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={uploading !== null} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadProfileFile(file, "logo"); }} /></label>
        </section>

        <section className="dashboard-panel company-profile-overview">
          <h2>Overview</h2>
          <div><span>Tasks Posted</span><strong>{tasks.length}</strong></div>
          <div><span>Interns Hired</span><strong>{hiredStudentCount}</strong></div>
          <div className="company-completion"><div><span>Profile Completion</span><strong>{completion}%</strong></div><div className="company-completion-track"><i style={{ width: `${completion}%` }} /></div><small>{completion === 100 ? "Profile complete" : `${Math.ceil((100 - completion) / (100 / completionFields.length))} steps remaining`}</small></div>
        </section>

        <section className="dashboard-panel company-verification-documents">
          <div className="company-profile-section-heading"><div><h2>Verification Documents</h2><p>Upload documents to verify your company.</p></div><ShieldCheck size={19} /></div>
          <div className="company-document-list">{companyDocumentTypes.map(({ kind, label }) => {
            const document = profile.documents.find((item) => item.kind === kind);
            return <div className="company-document-row" key={kind}><span className={`company-document-icon ${document ? "uploaded" : ""}`}>{document ? <Check size={16} /> : <FileText size={16} />}</span><div><strong>{label}</strong><small>{document ? document.name : "Not uploaded"}</small></div>{document ? <button type="button" aria-label={`Remove ${label}`} onClick={() => void removeDocument(kind)}><Trash2 size={15} /></button> : <label className="company-document-upload" aria-label={`Upload ${label}`}><Upload size={15} /><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={uploading !== null} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadProfileFile(file, kind); }} /></label>}</div>;
          })}</div>
          <form className="company-verification-form" onSubmit={submitVerification}>
            <label>Registration number<input required value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} placeholder="e.g. 12345/2020" /></label>
            <label>Legal company name<input required value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label>
            <label>Contact person<input required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Full name" /></label>
            <label>Company website or verification link<input type="url" value={documentLink} onChange={(event) => setDocumentLink(event.target.value)} placeholder="https://" /></label>
            {error && <p className="field-error" role="alert">{error}</p>}
            <button className="primary full" type="submit" disabled={status === "pending" || status === "verified"}>{status === "pending" ? "Verification pending" : status === "verified" ? "Company verified" : "Submit for verification"}</button>
          </form>
          <small className="company-document-note">Uploaded files are stored in this browser prototype; a secure shared document service is not connected.</small>
        </section>
      </aside>
    </div>
  </main>;
}

function CompanyPayouts({ tasks, applications }: { tasks: Task[]; applications: Application[] }) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const companyApplications = applications.filter((application) => taskIds.has(application.taskId));
  const totals = companyApplications.filter((application) => application.status === "accepted" || application.status === "completed").reduce((total, application) => { const task = tasks.find((item) => item.id === application.taskId); if (task) total[task.payment] += task.budget; return total; }, { USD: 0, EcoCash: 0 });
  return <main className="page"><div className="page-title"><span className="eyebrow">COMPANY FINANCE</span><h1>Payouts</h1><p>Review accepted task budgets and payment records.</p></div><div className="metrics-grid"><div className="metric-card"><span>Accepted task budgets · USD</span><strong>${totals.USD.toFixed(2)}</strong></div><div className="metric-card"><span>Accepted task budgets · EcoCash</span><strong>${totals.EcoCash.toFixed(2)}</strong></div></div><section className="dashboard-panel company-payout-list"><h2>Task payment status</h2>{companyApplications.filter((application) => application.status === "accepted" || application.status === "completed").map((application) => { const task = tasks.find((item) => item.id === application.taskId)!; return <div className="job-row" key={application.id}><div><strong>{task.title}</strong><small>{application.studentName} · {task.payment}</small></div><span>{money(task)}</span><span className={`status-pill ${application.paymentRecordedAt ? "open" : "review"}`}>{application.paymentRecordedAt ? "Recorded" : application.status === "completed" ? "Awaiting record" : "In progress"}</span></div>; })}{!companyApplications.some((application) => application.status === "accepted" || application.status === "completed") && <p>No accepted task payments to show yet.</p>}<p className="form-note">Prototype only: GradLink does not hold, transfer, or withdraw funds.</p></section></main>;
}

function CompanyApplicants({ tasks, allTasks, applications, policy, isCompanyVerified, onSetStatus, onInviteInterview, onRateApplicant, onHireAgain, onRecordPayment, go }: {
  tasks: Task[];
  allTasks: Task[];
  applications: Application[];
  policy: InterviewPolicy;
  isCompanyVerified: (companyName: string) => boolean;
  onSetStatus: (applicationId: string, status: Application["status"], feedback?: string) => void;
  onInviteInterview: (applicationId: string) => void;
  onRateApplicant: (applicationId: string, rating: number) => void;
  onHireAgain: (applicationId: string) => void;
  onRecordPayment: (applicationId: string) => void;
  go: (page: string) => void;
}) {
  const [completionFeedback, setCompletionFeedback] = useState<Record<string, string>>({});
  const ownedTaskIds = new Set(tasks.map((task) => task.id));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const received = applications.filter((application) => ownedTaskIds.has(application.taskId));
  const taskByIdAll = new Map(allTasks.map((task) => [task.id, task]));
  const completedForStudent = (studentId: string, skill: Skill) => new Set(
    applications
      .filter((application) => application.studentId === studentId && application.status === "completed")
      .filter((application) => taskByIdAll.get(application.taskId)?.skill === skill)
      .map((application) => application.taskId)
  ).size;

  return (
    <main className="page">
      <div className="page-title">
        <h1>Review applicants</h1>
        <p>Read each proposal and record your decision.</p>
      </div>
      {received.length ? <div className="jobs-panel">
        {SKILL_OPTIONS.map((skill) => {
          const filledTasks = new Set(received
            .filter((application) => application.status === "completed" && taskById.get(application.taskId)?.skill === skill)
            .map((application) => application.taskId)).size;
          if (filledTasks < policy.companyFilledTasks) return null;
          const invited = new Set(received
            .filter((application) => application.interviewInvited && taskById.get(application.taskId)?.skill === skill)
            .map((application) => application.studentId)).size;
          return (
            <div className={`threshold-notice ${invited >= policy.minimumInterviewInvites ? "threshold-met" : ""}`} key={skill}>
              <strong>{skill} interview commitment</strong>
              <span>{filledTasks} completed tasks · {invited}/{policy.minimumInterviewInvites} required interview invitations</span>
            </div>
          );
        })}
        {received.map((application) => {
          const task = taskById.get(application.taskId);
          const status = application.status || "applied";
          const completedCount = task ? completedForStudent(application.studentId, task.skill) : 0;
          const companyFilledTasks = task ? new Set(received
            .filter((item) => item.status === "completed" && taskById.get(item.taskId)?.skill === task.skill)
            .map((item) => item.taskId)).size : 0;
          const alreadyInvitedStudent = received.some((item) =>
            item.studentId === application.studentId
            && (item.interviewInvited || item.status === "interview-invited")
            && taskById.get(item.taskId)?.skill === task?.skill
          );
          const candidateHistory = applications.filter((item) => item.studentId === application.studentId && item.status === "completed").map((item) => {
            const historyTask = taskByIdAll.get(item.taskId);
            return { application: item, task: historyTask };
          }).filter((item) => item.task).sort((a, b) => Date.parse(completedAt(b.application)) - Date.parse(completedAt(a.application)));
          const skillCounts = new Map<string, number>();
          candidateHistory.forEach(({ task: historyTask }) => skillCounts.set(historyTask!.skill, (skillCounts.get(historyTask!.skill) || 0) + 1));
          const topSkills = [...skillCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
          const mutualSkill = task && candidateHistory.some(({ task: historyTask }) => historyTask?.skill === task.skill) ? task.skill : task?.skill;
          const interviewEligible = Boolean(task
            && ["applied", "interview-invited"].includes(status)
            && application.studentTrack === "interview"
            && (task.level === "Professional" || task.level === "Advanced")
            && completedCount >= policy.studentCompletedTasks
            && companyFilledTasks >= policy.companyFilledTasks);
          return (
            <article className="application-card" key={application.id}>
              <div className="application-heading">
                <div><strong>{application.studentName || "Student"}</strong><small>{task?.title || "Task listing"} · {task?.level} · {new Date(application.createdAt).toLocaleDateString()}</small></div>
                <span className={`status-pill ${status === "accepted" || status === "completed" ? "open" : "review"}`}>{status}</span>
              </div>
              <p>{application.proposal}</p>
              <div className="application-meta">Delivery: {application.deliveryDays} day{application.deliveryDays === 1 ? "" : "s"} · {application.studentTrack === "interview" ? "Interview pathway" : "Earning pathway"} · {task ? `${completedCount} completed ${task.skill} tasks` : ""}</div>
              <section className="candidate-review">
                <header className="candidate-profile-heading"><Avatar initials={initialsFromName(application.studentName || "Student")} size={48} /><div><h2>{application.studentName || "Student"}</h2><p>{application.studentTrack === "interview" ? "Interview pathway" : "Student"} · {application.studentStudyField || "Emerging professional"}</p></div></header>
                <div className="candidate-profile-section"><h3>Highlights</h3><p>You and {application.studentName || "this candidate"} both work in <strong>{mutualSkill || "this field"}</strong>.</p></div>
                <div className="candidate-profile-section"><h3>About</h3><p>{application.proposal || "This candidate has not added an application proposal."}</p></div>
                <div className="candidate-profile-section"><h3>Top skills</h3>{topSkills.length ? <div className="candidate-skill-list">{topSkills.map(([skill, count]) => <span key={skill}><Diamond size={14} />{skill}<small>{count} completed</small></span>)}</div> : <p>Completed work will build this candidate’s skill profile.</p>}</div>
                <div className="candidate-profile-section"><h3>Experience <small>Completed tasks</small></h3>
                  {candidateHistory.length ? <div className="candidate-timeline">{candidateHistory.map(({ application: historyItem, task: historyTask }) => {
                    return <article className="candidate-experience" key={historyItem.id}><h4>{historyTask?.title || "Completed task"}</h4><p className="candidate-experience-company">{historyTask?.company || "Company"}{historyTask && isCompanyVerified(historyTask.company) && <span className="verified-company-mark" title="Verified company"><BadgeCheck size={15} /> Verified</span>}</p><p className="candidate-experience-meta">{new Date(completedAt(historyItem)).toLocaleDateString()} · {historyItem.deliveryDays} day{historyItem.deliveryDays === 1 ? "" : "s"} · {historyItem.rating ? `${historyItem.rating}/5 ★` : "No rating"}</p><p className="candidate-experience-meta">Reviewed by: {historyTask?.company || "Company"} Manager</p><div className="candidate-skill-list">{historyTask && <span><Diamond size={13} />{historyTask.skill}</span>}</div></article>;
                  })}</div> : <p>No completed work recorded yet.</p>}
                </div>
                <div className="candidate-history">
                  <label>Rate completed work
                    <select aria-label={`Rate ${application.studentName}`} value={application.rating || ""} onChange={(event) => event.target.value && onRateApplicant(application.id, Number(event.target.value))}>
                      <option value="">Choose rating</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
                    </select>
                  </label>
                  {application.rating && <p className="form-note">Your rating: {application.rating}/5{application.ratingFeedback ? ` · ${application.ratingFeedback}` : ""}</p>}
                </div>
              </section>
              {application.portfolio && /^https?:\/\//i.test(application.portfolio) && <a href={application.portfolio} target="_blank" rel="noopener noreferrer">View portfolio</a>}
              <div className="application-actions">
                {["applied", "interview-invited"].includes(status) && <>
                  <button type="button" className="primary" onClick={() => onSetStatus(application.id, "accepted")}>Accept</button>
                  <button type="button" className="secondary-btn" onClick={() => onSetStatus(application.id, "rejected")}>Reject</button>
                </>}
                {status === "accepted" && <p className="form-note">Accepted · waiting for the student to submit their work.</p>}
                {status === "submitted" && <><div className="submitted-work-preview"><strong>Student submission</strong><p>{application.submittedWork}</p><label>Feedback for student<textarea value={completionFeedback[application.id] || ""} onChange={(event) => setCompletionFeedback((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Optional feedback about the submitted work" /></label></div><button type="button" className="primary" onClick={() => onSetStatus(application.id, "completed", completionFeedback[application.id] || "")}>Approve work and mark complete</button></>}
                {status === "completed" && <button type="button" className={`secondary-btn ${application.hiredAgain ? "selected" : ""}`} onClick={() => onHireAgain(application.id)}>{application.hiredAgain ? "Preferred for future tasks ✓" : "Hire again"}</button>}
                {status === "completed" && <button type="button" className="secondary-btn" disabled={Boolean(application.paymentRecordedAt)} onClick={() => onRecordPayment(application.id)}>{application.paymentRecordedAt ? "Payment recorded" : "Record payment"}</button>}
                {interviewEligible && <button type="button" className="secondary-btn" disabled={alreadyInvitedStudent} onClick={() => onInviteInterview(application.id)}>
                  {alreadyInvitedStudent ? "Interview invitation sent" : "Invite to interview"}
                </button>}
                {application.studentTrack === "interview" && !interviewEligible && status !== "rejected" && (
                  <span className="form-note">Interview eligibility requires a {policy.studentCompletedTasks}-task record in this field, a Professional or Advanced application, and the company's {policy.companyFilledTasks}-task field threshold.</span>
                )}
              </div>
            </article>
          );
        })}
      </div> : <div className="empty"><Users /><h2>No applications yet</h2><p>Applications to your task listings will appear here with their proposals and delivery times.</p></div>}
    </main>
  );
}

function ModerationQueue({ tasks, onSetVerified, onDeleteTask }: {
  tasks: Task[];
  onSetVerified: (taskId: string, verified: boolean) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [taskToRemove, setTaskToRemove] = useState<Task | null>(null);
  const removeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!taskToRemove) return;
    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTaskToRemove(null);
        removeTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [taskToRemove]);
  const cancelRemoval = () => {
    setTaskToRemove(null);
    removeTriggerRef.current?.focus();
  };
  const confirmRemoval = () => {
    if (!taskToRemove) return;
    onDeleteTask(taskToRemove.id);
    setTaskToRemove(null);
  };

  return (
    <section className="section">
      <div className="section-title"><h2>Task listing moderation</h2></div>
      <div className="jobs-panel moderation-jobs-panel">
        {tasks.map((task) => (
          <div className="job-row moderation-job-row" key={task.id}>
            <div className="moderation-task-info">
              <strong>{task.company}</strong>
              <small>{task.title}</small>
              <span className={`moderation-verification ${task.verified ? "is-verified" : "is-unverified"}`}>
                {task.verified ? <ShieldCheck size={14} /> : <Shield size={14} />}
                {task.verified ? "Verified" : "Unverified"}
              </span>
            </div>
            <div className="admin-actions moderation-actions">
              <button className="moderation-btn moderation-btn-verify" type="button" aria-label={`${task.verified ? "Unverify" : "Verify"} listing: ${task.title}`} onClick={() => onSetVerified(task.id, !task.verified)}>
                <ShieldCheck size={15} />{task.verified ? "Unverify" : "Verify"}
              </button>
              <button className="moderation-btn moderation-btn-remove" type="button" aria-label={`Remove listing: ${task.title}`} onClick={(event) => {
                removeTriggerRef.current = event.currentTarget;
                setTaskToRemove(task);
              }}>
                <Trash2 size={15} />Remove
              </button>
            </div>
          </div>
        ))}
        {!tasks.length && <div className="empty"><ShieldCheck /><h2>No task listings to review</h2></div>}
      </div>
      {taskToRemove && <div className="modal-backdrop moderation-confirm-backdrop" role="presentation" onClick={cancelRemoval}>
        <section className="modal moderation-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-confirm-title" onClick={(event) => event.stopPropagation()}>
          <div className="moderation-confirm-icon"><Trash2 size={20} /></div>
          <h2 id="moderation-confirm-title">Remove this task listing?</h2>
          <p className="moderation-confirm-listing"><strong>{taskToRemove.title}</strong><span>{taskToRemove.company}</span></p>
          <p>This permanently removes the listing and all applications attached to it. This action cannot be undone.</p>
          <div className="moderation-confirm-actions">
            <button ref={cancelRef} className="moderation-btn moderation-btn-cancel" type="button" onClick={cancelRemoval}>Cancel</button>
            <button className="moderation-btn moderation-btn-remove-confirm" type="button" onClick={confirmRemoval}><Trash2 size={15} />Remove listing</button>
          </div>
        </section>
      </div>}
    </section>
  );
}
function AdminDashboard({ tasks, applications, policy, companyVerifications, onSetCompanyVerification, onDownloadVerificationDocument, onSetPolicy, onSetVerified, onDeleteTask, go }: {
  tasks: Task[];
  applications: Application[];
  policy: InterviewPolicy;
  companyVerifications: CompanyVerification[];
  onSetCompanyVerification: (companyName: string, status: CompanyVerificationStatus) => void;
  onDownloadVerificationDocument: (record: CompanyVerification) => void;
  onSetPolicy: (policy: InterviewPolicy) => void;
  onSetVerified: (taskId: string, verified: boolean) => void;
  onDeleteTask: (taskId: string) => void;
  go: (page: string) => void;
}) {
  const verified = tasks.filter((task) => task.verified).length;
  const totalStudents = new Set(applications.map((application) => application.studentId)).size;
  const totalCompanies = new Set(tasks.map((task) => task.company)).size;
  const completedTasks = applications.filter((application) => application.status === "completed").length;
  const pendingTasks = tasks.filter((task) => !task.verified);
  const taskApplications = (taskId: string) => applications.filter((application) => application.taskId === taskId);
  const completedBySkill = Array.from(new Set(tasks.map((task) => task.skill))).map((skill) => ({
    skill,
    count: new Set(applications.filter((application) => application.status === "completed" && tasks.find((task) => task.id === application.taskId)?.skill === skill).map((application) => application.taskId)).size
  })).sort((a, b) => b.count - a.count).slice(0, 6);
  const maxCompleted = Math.max(1, ...completedBySkill.map(({ count }) => count));
  const recentTasks = tasks.slice().sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
  const [thresholds, setThresholds] = useState(policy);

  useEffect(() => setThresholds(policy), [policy]);

  return (
    <div className="page">
      <div className="page-title">
        <h1>GradLink Admin</h1>
        <p>Hiring infrastructure overview · Zimbabwe</p>
      </div>

      <div className="metrics-grid admin-metrics">
        <div className="metric-card">
          <span>Total students</span>
          <strong>{totalStudents}</strong>
        </div>
        <div className="metric-card">
          <span>Active tasks</span>
          <strong>{tasks.filter((task) => task.verified).length}</strong>
        </div>
        <div className="metric-card">
          <span>Companies</span>
          <strong>{totalCompanies}</strong>
        </div>
        <div className="metric-card">
          <span>Completed tasks</span>
          <strong>{completedTasks}</strong>
        </div>
        <div className="metric-card"><span>Pending verifications</span><strong>{tasks.length - verified}</strong></div>
      </div>

      <div className="admin-dashboard-grid">
        <section className="dashboard-panel admin-recent-tasks">
          <div className="section-title"><div><h2>Recent tasks</h2><p>Latest listings and application status</p></div><button className="text-btn" type="button" onClick={() => go("admin-moderation")}>View all <ChevronRight size={15} /></button></div>
          <div className="admin-task-table">
            <div className="admin-task-row admin-task-header"><span>Company / task</span><span>Budget</span><span>Status · rating</span></div>
            {recentTasks.map((task) => {
              const taskApps = taskApplications(task.id);
              const completed = taskApps.filter((application) => application.status === "completed").length;
              const status = !task.verified ? "Pending" : completed ? "Completed" : taskApps.length ? "In progress" : "Open";
              return <div className="admin-task-row" key={task.id}>
                <span><strong>{task.company}</strong><small>{task.title}</small></span>
                <span>{money(task)}</span>
                <span><i className={`status-pill ${status === "Pending" ? "review" : "open"}`}>{status}</i><small className="admin-rating">{task.rating.toFixed(1)} ★ · {taskApps.length} applicants</small></span>
              </div>;
            })}
            {!tasks.length && <div className="empty compact-empty"><p>No task listings have been posted yet.</p></div>}
          </div>
        </section>

        <aside className="admin-insights-column">
          <section className="dashboard-panel admin-alert-panel">
            <div className="section-title"><div><h2>Pending verifications</h2><p>{pendingTasks.length} listing{pendingTasks.length === 1 ? "" : "s"} require review</p></div><ShieldCheck size={22} /></div>
            {pendingTasks.slice(0, 3).map((task) => <div className="job-row" key={task.id}><div><strong>{task.company}</strong><small>{task.title}</small></div><span className="status-pill review">Review</span></div>)}
            {!pendingTasks.length && <p>All task listings are verified.</p>}
            <button className="secondary-btn full-btn" type="button" onClick={() => go("admin-moderation")}>Review listings</button>
          </section>
          <section className="dashboard-panel">
            <div className="section-title"><div><h2>Company approvals</h2><p>{new Set(pendingTasks.map((task) => task.company)).size} pending</p></div><Building2 size={22} /></div>
            {Array.from(new Set(pendingTasks.map((task) => task.company))).slice(0, 3).map((company) => <p className="approval-row" key={company}><strong>{company}</strong><span>New listing · review required</span></p>)}
            {!pendingTasks.length && <p>No company submissions are waiting for review.</p>}
            <button className="text-btn" type="button" onClick={() => go("admin-companies")}>Open company directory <ChevronRight size={15} /></button>
          </section>
          <section className="dashboard-panel">
            <div className="section-title"><div><h2>Interview pathway</h2><p>Current qualification thresholds</p></div></div>
            <form className="form-card policy-form" onSubmit={(event) => {
              event.preventDefault();
              onSetPolicy({
                studentCompletedTasks: Math.max(1, Math.floor(thresholds.studentCompletedTasks)),
                companyFilledTasks: Math.max(1, Math.floor(thresholds.companyFilledTasks)),
                minimumInterviewInvites: Math.max(1, Math.floor(thresholds.minimumInterviewInvites))
              });
            }}>
              <label>Student completed tasks per field
                <input type="number" min="1" step="1" required value={thresholds.studentCompletedTasks} onChange={(event) => setThresholds((current) => ({ ...current, studentCompletedTasks: Number(event.target.value) }))} />
              </label>
              <label>Company completed tasks per field
                <input type="number" min="1" step="1" required value={thresholds.companyFilledTasks} onChange={(event) => setThresholds((current) => ({ ...current, companyFilledTasks: Number(event.target.value) }))} />
              </label>
              <label>Minimum interview invitations
                <input type="number" min="1" step="1" required value={thresholds.minimumInterviewInvites} onChange={(event) => setThresholds((current) => ({ ...current, minimumInterviewInvites: Number(event.target.value) }))} />
              </label>
              <button className="primary full" type="submit">Save thresholds</button>
            </form>
          </section>
        </aside>
      </div>

      <section className="dashboard-panel admin-company-verifications">
        <div className="section-title"><div><h2>Company Verifications</h2><p>Review business registration submissions</p></div><Building2 size={22} /></div>
        {companyVerifications.filter((record) => record.status === "pending").length ? companyVerifications.filter((record) => record.status === "pending").map((record) => <div className="job-row" key={record.companyName}><div><strong>{record.legalName || record.companyName}</strong><small>{record.registrationNumber} · {record.businessEmail} · Contact: {record.contactName} ({record.contactPhone})</small>{record.documentName && <button className="text-btn" type="button" onClick={() => onDownloadVerificationDocument(record)}>Open document: {record.documentName}</button>}{record.documentLink && <a href={record.documentLink} target="_blank" rel="noreferrer">Open company link</a>}</div><div className="moderation-actions"><button className="moderation-btn moderation-btn-verify" type="button" onClick={() => onSetCompanyVerification(record.companyName, "verified")}><BadgeCheck size={15} />Approve</button><button className="moderation-btn moderation-btn-remove" type="button" onClick={() => onSetCompanyVerification(record.companyName, "not-verified")}>Reject</button></div></div>) : <p>No company verifications are pending.</p>}
      </section>

      <section className="dashboard-panel admin-performance">
        <div className="section-title"><div><h2>Performance overview</h2><p>Completed unique tasks by skill</p></div><span className="metric-caption">{completedTasks} completed applications</span></div>
        {completedBySkill.map(({ skill, count }) => <div className="performance-row" key={skill}><span>{skill}</span><div className="performance-track"><i style={{ width: `${count / maxCompleted * 100}%` }} /></div><strong>{count}</strong></div>)}
        {!completedBySkill.length && <p>No completed task data is available yet.</p>}
      </section>

      <section className="section admin-moderation-section"><ModerationQueue tasks={tasks} onSetVerified={onSetVerified} onDeleteTask={onDeleteTask} /></section>
    </div>
  );
}

export function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(loadThemePreference);
  const [store, setStore] = useState<Store>(loadStore);
  const [studentProfile, setStudentProfile] = useState<StudentProfileData>(defaultStudentProfile);
  const [certificates, setCertificates] = useState<CertificateMeta[]>(loadCertificates);
  const [certificatePreview, setCertificatePreview] = useState<{ certificate: CertificateMeta; url: string } | null>(null);
  const [companyName, setCompanyName] = useState(() => {
    try {
      const savedName = localStorage.getItem(`${KEY}-company-name`);
      return !savedName || savedName === "My Company" ? "TechNest Pvt" : savedName;
    } catch (error) {
      console.error("Could not load the saved company name", error);
      return "TechNest Pvt";
    }
  });
  const [account, setAccount] = useState<AccountType>(loadWorkspaceAccount);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [page, setPage] = useState(() => account === "company" ? "company-dashboard" : account === "admin" ? "admin-overview" : "dashboard");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | Skill>("All");
  const [levelFilter, setLevelFilter] = useState<"All levels" | WorkLevel>("All levels");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Task | null>(null);
  const [toastState, setToastState] = useState<{ m: string; e?: boolean } | null>(null);
  const [welcomePageOpen, setWelcomePageOpen] = useState(false);
  const [accessWorkspace, setAccessWorkspace] = useState<"student" | "company" | null>(null);
  const [packageSelectionOpen, setPackageSelectionOpen] = useState(false);
  const [packageSetupTier, setPackageSetupTier] = useState<typeof STUDENT_PACKAGES[number]["id"] | null>(null);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [studentPackage, setStudentPackage] = useState<typeof STUDENT_PACKAGES[number]["id"] | null>(null);
  const adminLogoClicks = useRef(0);
  const adminLogoResetTimer = useRef<number | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [readCompanyCandidateIds, setReadCompanyCandidateIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${KEY}-read-company-candidates`) || "[]") as string[]; } catch { return []; }
  });
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(loadReadNotificationIds);

  const activateAuthenticatedUser = (user: User) => {
    setAuthUser(user);
    let pendingWorkspace: string | null = null;
    try {
      pendingWorkspace = localStorage.getItem(PENDING_AUTH_WORKSPACE_KEY);
      localStorage.removeItem(PENDING_AUTH_WORKSPACE_KEY);
    } catch { /* session can still be restored using Supabase metadata */ }
    const metadata = user.user_metadata || {};
    const metadataWorkspace = metadata.account_type === "student" || metadata.account_type === "company" ? metadata.account_type : null;
    const requestedWorkspace = pendingWorkspace === "student" || pendingWorkspace === "company" ? pendingWorkspace : null;
    if (metadataWorkspace && requestedWorkspace && metadataWorkspace !== requestedWorkspace) {
      setWelcomePageOpen(true);
      setToastState({ m: `This email is registered for the ${metadataWorkspace} workspace.`, e: true });
      window.setTimeout(() => { void supabase?.auth.signOut(); }, 0);
      return;
    }
    const workspace = metadataWorkspace || requestedWorkspace;
    if (!workspace) {
      setWelcomePageOpen(true);
      setToastState({ m: "Choose Student or Company to finish setting up your account.", e: true });
      return;
    }
    setAccount(workspace);
    setWelcomePageOpen(false);
    setAccessWorkspace(null);
    setPackageSelectionOpen(false);
    setPackageSetupTier(null);
    const displayName = String(metadata.full_name || metadata.name || "").trim();
    if (workspace === "student") {
      setStudentProfile((profile) => ({ ...profile, ...(displayName ? { name: displayName } : {}), ...(user.email ? { email: user.email } : {}) }));
      setPage("dashboard");
    } else {
      const company = String(metadata.company_name || displayName || user.email?.split("@")[0] || "My Company").trim();
      setCompanyName(company);
      setPage("company-dashboard");
    }
  };

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthLoading(false);
      if (session?.user) {
        setAuthUser(session.user);
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED") activateAuthenticatedUser(session.user);
      } else {
        setAuthUser(null);
        if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
          setWelcomePageOpen(true);
          setAccessWorkspace(null);
          setPackageSelectionOpen(false);
          setPackageSetupTier(null);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !authUser || account !== "student") return;
    let cancelled = false;
    void supabase.from("profiles")
      .select("package_tier,full_name,location,study_field,student_track,email,phone")
      .eq("id", authUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Could not load student profile from Supabase", error);
          setToastState({ m: "Could not load your profile from Supabase.", e: true });
          return;
        }
        const tier = data?.package_tier;
        const validTier = STUDENT_PACKAGES.some((item) => item.id === tier)
          ? tier as typeof STUDENT_PACKAGES[number]["id"]
          : null;
        setStudentPackage(validTier);
        if (!validTier) setPackageSelectionOpen(true);
        if (data) setStudentProfile((current) => ({
          ...current,
          name: data.full_name || current.name,
          location: data.location || current.location,
          studyField: (SKILL_OPTIONS.includes(data.study_field as Skill) ? data.study_field : current.studyField) as Skill,
          track: data.student_track === "interview" ? "interview" : "earning",
          email: data.email || authUser.email || current.email,
          phone: data.phone || current.phone
        }));
        else setPackageSelectionOpen(true);
      });
    return () => { cancelled = true; };
  }, [authUser?.id, account]);

  useEffect(() => {
    if (!supabase || !authUser || account !== "student") return;
    let cancelled = false;
    void supabase.from("profiles")
      .select("package_tier,full_name,location,study_field,student_track,email,phone")
      .eq("id", authUser.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Could not load student profile from Supabase", error);
          setToastState({ m: "Could not load your profile from Supabase.", e: true });
          return;
        }
        const tier = data?.package_tier;
        const validTier = STUDENT_PACKAGES.some((item) => item.id === tier)
          ? tier as typeof STUDENT_PACKAGES[number]["id"]
          : null;
        setStudentPackage(validTier);
        if (data) setStudentProfile((current) => ({
          ...current,
          name: data.full_name || current.name,
          location: data.location || current.location,
          studyField: (SKILL_OPTIONS.includes(data.study_field as Skill) ? data.study_field : current.studyField) as Skill,
          track: data.student_track === "interview" ? "interview" : "earning",
          email: data.email || authUser.email || current.email,
          phone: data.phone || current.phone
        }));
        else setPackageSelectionOpen(true);
      });
    return () => { cancelled = true; };
  }, [authUser?.id, account]);

  useEffect(() => {
    if (!supabase || !authUser || authUser.user_metadata?.account_type) return;
    const data = account === "company"
      ? { account_type: account, company_name: companyName }
      : { account_type: account, full_name: studentProfile.name };
    void supabase.auth.updateUser({ data }).then(({ data: updated, error }) => {
      if (error) { console.warn("Could not save the workspace on this Google account", error); return; }
      if (updated.user) setAuthUser(updated.user);
    });
  }, [authUser, account, companyName, studentProfile.name]);

  useEffect(() => {
    try { localStorage.setItem(ACCOUNT_KEY, account); }
    catch (error) { console.warn("Could not save workspace selection", error); }
  }, [account]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = themePreference === "system" ? (media.matches ? "dark" : "light") : themePreference;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themePreference = themePreference;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#0B1930" : "#edf4ff");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      const next = event.newValue;
      if (next === "light" || next === "dark" || next === "system") setThemePreference(next);
      else setThemePreference("system");
    };
    applyTheme();
    if (themePreference === "system") media.addEventListener("change", applyTheme);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", applyTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, [themePreference]);

  const chooseTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch (error) {
      console.warn("Could not save appearance preference", error);
    }
  };

  const saveStudentProfile = (profile: StudentProfileData) => {
    setStudentProfile(profile);
    if (!supabase || !authUser) {
      setToastState({ m: "Sign in to save your profile to Supabase.", e: true });
      return;
    }
    void supabase.from("profiles").update({
      full_name: profile.name,
      location: profile.location,
      study_field: profile.studyField,
      student_track: profile.track,
      email: profile.email,
      phone: profile.phone
    }).eq("id", authUser.id).then(({ error }) => {
      if (error) {
        console.error("Could not save student profile to Supabase", error);
        setToastState({ m: "Could not save your profile to Supabase.", e: true });
      }
    });
  };

  const handleAdminLogoTap = () => {
    adminLogoClicks.current += 1;
    if (adminLogoResetTimer.current !== null) window.clearTimeout(adminLogoResetTimer.current);
    if (adminLogoClicks.current >= 5) {
      adminLogoClicks.current = 0;
      setAdminLoginOpen(true);
      return;
    }
    adminLogoResetTimer.current = window.setTimeout(() => { adminLogoClicks.current = 0; }, 2500);
  };

  useEffect(() => () => {
    if (adminLogoResetTimer.current !== null) window.clearTimeout(adminLogoResetTimer.current);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (error) {
      console.error("Could not save GradLink data", error);
      setToastState({ m: "Could not save changes in this browser", e: true });
    }
  }, [store]);
  useEffect(() => {
    try {
      localStorage.setItem(`${KEY}-certificates`, JSON.stringify(certificates));
    } catch (error) {
      console.error("Could not save certificate details", error);
      setToastState({ m: "Could not save certificate details in this browser", e: true });
    }
  }, [certificates]);
  useEffect(() => {
    try {
      localStorage.setItem(`${KEY}-company-name`, companyName);
    } catch (error) {
      console.error("Could not save the company name", error);
      setToastState({ m: "Could not save the company name in this browser", e: true });
    }
  }, [companyName]);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);

  const toast = (m: string, e?: boolean) => setToastState({ m, e });

  const authenticateWithEmailPassword = async (workspace: "student" | "company", mode: "create" | "signin", name: string, email: string, password: string): Promise<{ error?: string; message?: string }> => {
    if (!supabase) return { error: "Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the app." };
    try {
      localStorage.setItem(PENDING_AUTH_WORKSPACE_KEY, workspace);
      if (mode === "create") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { account_type: workspace, ...(workspace === "student" ? { full_name: name } : { company_name: name }) } }
        });
        if (error) { localStorage.removeItem(PENDING_AUTH_WORKSPACE_KEY); return { error: error.message }; }
        if (!data.session) return { message: "Account created. Check your email to confirm your address, then sign in." };
        return {};
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { localStorage.removeItem(PENDING_AUTH_WORKSPACE_KEY); return { error: error.message }; }
      return {};
    } catch (error) {
      try { localStorage.removeItem(PENDING_AUTH_WORKSPACE_KEY); } catch { /* no-op */ }
      return { error: error instanceof Error ? error.message : "Could not connect to Supabase authentication." };
    }
  };

  const signInWithGoogle = async (workspace: "student" | "company") => {
    if (!supabase) { toast("Authentication is not configured. Add your Supabase project settings first.", true); return; }
    try {
      localStorage.setItem(PENDING_AUTH_WORKSPACE_KEY, workspace);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } }
      });
      if (error) { localStorage.removeItem(PENDING_AUTH_WORKSPACE_KEY); toast(error.message, true); }
    } catch (error) {
      try { localStorage.removeItem(PENDING_AUTH_WORKSPACE_KEY); } catch { /* no-op */ }
      toast(error instanceof Error ? error.message : "Could not start Google sign-in.", true);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) toast(error.message, true);
  };

  const go = (p: string) => {
    setModal(null);
    if (p === "company-candidates") {
      const currentOwnedIds = new Set(store.tasks.filter((task) => task.mine && task.company.trim().toLowerCase() === companyName.trim().toLowerCase()).map((task) => task.id));
      const readIds = store.applications.filter((application) => currentOwnedIds.has(application.taskId)).map((application) => application.id);
      const updated = [...new Set([...readCompanyCandidateIds, ...readIds])];
      setReadCompanyCandidateIds(updated);
      try { localStorage.setItem(`${KEY}-read-company-candidates`, JSON.stringify(updated)); } catch { /* unread badge is session-only if storage is unavailable */ }
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addTask = (task: Task) => setStore((s) => ({ ...s, tasks: [task, ...s.tasks] }));

  const apply = (task: Task) => {
    if (!studentPackage) {
      setPackageSelectionOpen(true);
      return;
    }
    const maxBudgetByPackage = { general: 20, intermediate: 35, professional: 50, advanced: Number.POSITIVE_INFINITY };
    if (task.budget > maxBudgetByPackage[studentPackage]) {
      toast(`${STUDENT_PACKAGES.find((item) => item.id === studentPackage)?.name} package covers tasks up to $${maxBudgetByPackage[studentPackage]}. Choose a higher package for this task.`, true);
      setPackageSelectionOpen(true);
      return;
    }
    if (studentProfile.track === "interview" && !["professional", "advanced"].includes(studentPackage)) {
      toast("Professional or Advanced package is required to pursue interviews", true);
      setPackageSelectionOpen(true);
      return;
    }
    if (studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced") {
      toast("Interview-pathway applications require Professional or Advanced work", true);
      return;
    }
    if (store.applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID)) {
      toast("This student has already submitted an application for this task");
      return;
    }
    setModal(task);
  };

  const createCompanyTask = (task: Omit<Task, "id" | "applicants" | "match" | "rating" | "verified" | "mine">) => {
    if (interviewLevels.includes(task.level) && !companyIsVerified(companyName, store.companyVerifications)) {
      toast("Professional and Advanced tasks are only for verified companies. Please upload company registration to get verified.", true);
      setPage("company-profile");
      return;
    }
    addTask({
      ...task,
      id: `company-${Date.now()}`,
      applicants: 0,
      match: 80,
      rating: 0,
      verified: false,
      mine: true
    });
    toast("Task listing published and sent for admin verification");
  };

  const setApplicationStatus = (applicationId: string, status: Application["status"], feedback = "") => {
    const existing = store.applications.find((application) => application.id === applicationId);
    if (!existing) {
      toast("Could not find this application", true);
      return;
    }
    const validTransition = status === "accepted" || status === "rejected"
      ? existing.status === "applied" || existing.status === "interview-invited"
      : status === "completed" && existing.status === "submitted";
    if (!validTransition) {
      toast("That application status change is not available", true);
      return;
    }
    setStore((current) => ({
      ...current,
      applications: current.applications.map((application) => {
        if (application.id !== applicationId) return application;
        const description = status === "accepted" ? "Company accepted application" : status === "rejected" ? "Company declined application" : "Company marked work complete";
        const type = status === "accepted" ? "accepted" as const : status === "rejected" ? "rejected" as const : "completed" as const;
        const event = { id: "event-" + Date.now(), type, actor: "company" as const, description, at: new Date().toISOString() };
        return { ...application, status, ...(status === "completed" && feedback.trim() ? { companyFeedback: feedback.trim() } : {}), events: [...(application.events || []), event] };
      })
    }));
    toast(status === "completed" ? "Work marked complete" : `Application ${status.replace("-", " ")}`);
  };

  const submitStudentWork = (applicationId: string, work: string) => {
    const existing = store.applications.find((application) => application.id === applicationId);
    if (!existing || existing.status !== "accepted" || !work.trim()) {
      toast("Work can only be submitted for an accepted application", true);
      return;
    }
    const submittedAt = new Date().toISOString();
    const event = { id: "event-" + Date.now(), type: "work-submitted" as const, actor: "student" as const, description: "Student submitted work for review", at: submittedAt };
    setStore((current) => ({ ...current, applications: current.applications.map((application) => application.id === applicationId ? { ...application, status: "submitted", submittedWork: work.trim(), submittedAt, events: [...(application.events || []), event] } : application) }));
    toast("Work submitted to the company");
  };

  const withdrawStudentApplication = (applicationId: string) => {
    const existing = store.applications.find((application) => application.id === applicationId);
    if (!existing || existing.studentId !== CURRENT_STUDENT_ID || !["applied", "interview-invited"].includes(existing.status)) {
      toast("This application can no longer be withdrawn", true);
      return;
    }
    const event = { id: "event-" + Date.now(), type: "withdrawn" as const, actor: "student" as const, description: "Student withdrew application", at: new Date().toISOString() };
    setStore((current) => ({ ...current, applications: current.applications.map((application) => application.id === applicationId ? { ...application, status: "withdrawn", events: [...(application.events || []), event] } : application) }));
    toast("Application withdrawn");
  };

  const recordApplicationPayment = (applicationId: string) => {
    const existing = store.applications.find((application) => application.id === applicationId);
    if (!existing || existing.status !== "completed" || existing.paymentRecordedAt) {
      toast("Payment can only be recorded for completed work", true);
      return;
    }
    const at = new Date().toISOString();
    const event = { id: "event-" + Date.now(), type: "payment-recorded" as const, actor: "company" as const, description: "Company recorded payment", at };
    setStore((current) => ({ ...current, applications: current.applications.map((application) => application.id === applicationId ? { ...application, paymentRecordedAt: at, events: [...(application.events || []), event] } : application) }));
    toast("Payment marked as recorded. No transfer was made by GradLink.");
  };

  const rateApplicant = (applicationId: string, rating: number) => {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    setStore((current) => ({
      ...current,
      applications: current.applications.map((application) => {
        if (application.id !== applicationId || application.status !== "completed") return application;
        const at = new Date().toISOString();
        const event = { id: "event-" + Date.now(), type: "reviewed" as const, actor: "company" as const, description: `Company left a ${rating}/5 review`, at };
        return { ...application, rating, events: [...(application.events || []), event] };
      })
    }));
    toast("Candidate rating saved");
  };

  const toggleHireAgain = (applicationId: string) => {
    const selected = store.applications.find((application) => application.id === applicationId);
    if (!selected || selected.status !== "completed") return;
    setStore((current) => ({
      ...current,
      applications: current.applications.map((application) => application.id === applicationId ? { ...application, hiredAgain: !selected.hiredAgain } : application)
    }));
    toast(selected.hiredAgain ? "Removed from preferred candidates" : "Candidate added to preferred candidates");
  };

  const inviteToInterview = (applicationId: string) => {
    const application = store.applications.find((item) => item.id === applicationId);
    const task = application ? store.tasks.find((item) => item.id === application.taskId) : undefined;
    if (!application || !task) {
      toast("Could not find the application or task", true);
      return;
    }
    const ownedTaskIds = new Set(store.tasks
      .filter((item) => item.mine && item.company.trim().toLowerCase() === companyName.trim().toLowerCase())
      .map((item) => item.id));
    if (!ownedTaskIds.has(task.id)) {
      toast("You can only invite candidates who applied to your company's tasks", true);
      return;
    }
    if (application.interviewInvited || application.status === "interview-invited") {
      toast("An interview invitation was already sent for this application", true);
      return;
    }
    if (application.status !== "applied") {
      toast("Interview invitations are only available for active applications", true);
      return;
    }
    const previousInvitation = store.applications.some((item) =>
      item.studentId === application.studentId
      && (item.interviewInvited || item.status === "interview-invited")
      && ownedTaskIds.has(item.taskId)
      && store.tasks.find((candidate) => candidate.id === item.taskId)?.skill === task.skill
    );
    if (previousInvitation) {
      toast("This candidate has already received an interview invitation for this field", true);
      return;
    }
    const completedTasks = new Set(store.applications
      .filter((item) => item.studentId === application.studentId && item.status === "completed")
      .filter((item) => store.tasks.find((candidate) => candidate.id === item.taskId)?.skill === task.skill)
      .map((item) => item.taskId)).size;
    const companyCompleted = new Set(store.applications
      .filter((item) => item.status === "completed" && ownedTaskIds.has(item.taskId))
      .filter((item) => {
        const completedTask = store.tasks.find((candidate) => candidate.id === item.taskId);
        return completedTask?.skill === task.skill;
      })
      .map((item) => item.taskId)).size;
    if (application.studentTrack !== "interview"
      || (task.level !== "Professional" && task.level !== "Advanced")
      || completedTasks < store.policy.studentCompletedTasks
      || companyCompleted < store.policy.companyFilledTasks) {
      toast("This applicant has not met the interview eligibility rules", true);
      return;
    }
    setStore((current) => ({
      ...current,
      applications: current.applications.map((item) => item.id === applicationId ? {
        ...item,
        status: "interview-invited",
        interviewInvited: true,
        events: [...(item.events || []), { id: "event-" + Date.now(), type: "interview-invited", actor: "company", description: "Company sent an interview invitation", at: new Date().toISOString() }]
      } : item)
    }));
    toast("Interview invitation sent");
  };

  const setTaskVerified = (taskId: string, verified: boolean) => {
    setStore((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, verified } : task)
    }));
    toast(verified ? "Task listing verified" : "Task listing verification removed");
  };

  const deleteTask = (taskId: string) => {
    setStore((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
      applications: current.applications.filter((application) => application.taskId !== taskId)
    }));
    toast("Task listing and its applications removed");
  };

  const savePolicy = (policy: InterviewPolicy) => {
    setStore((current) => ({ ...current, policy }));
    toast("Interview thresholds saved");
  };

  const saveCompanyVerification = (record: CompanyVerification) => setStore((current) => ({ ...current, companyVerifications: [...current.companyVerifications.filter((item) => item.companyName.trim().toLowerCase() !== record.companyName.trim().toLowerCase()), record] }));
  const saveCompanyVerificationDocument = async (file: File) => {
    const id = `company-document-${companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try { await saveCertificateFile(id, file); return id; }
    catch (error) { console.error("Could not store company verification document", error); toast("Could not upload the verification document", true); return null; }
  };
  const deleteCompanyProfileDocument = (fileId: string) => deleteCertificateFile(fileId);
  const downloadCompanyVerificationDocument = async (record: CompanyVerification) => {
    if (!record.documentFileId) { toast("No uploaded document is attached", true); return; }
    try {
      const file = await readCertificateFile(record.documentFileId);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = record.documentName || "company-verification-document"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { console.error("Could not retrieve company verification document", error); toast("Could not open the uploaded document", true); }
  };
  const setCompanyVerificationStatus = (name: string, status: CompanyVerificationStatus) => {
    setStore((current) => ({ ...current, companyVerifications: current.companyVerifications.map((record) => record.companyName.trim().toLowerCase() === name.trim().toLowerCase() ? { ...record, status } : record) }));
    toast(status === "verified" ? `${name} is now a verified company` : `${name} verification was rejected`);
  };

  const uploadCertificates = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: CertificateMeta[] = [];
    for (const file of Array.from(files)) {
      const extensionType: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const fileType = extensionType[extension] || "";
      if (!fileType || (Object.values(extensionType).includes(file.type) && file.type !== fileType) || file.size > 5 * 1024 * 1024) {
        toast(`${file.name}: choose a PDF, JPG or PNG up to 5 MB`, true);
        continue;
      }
      const certificate = {
        id: `certificate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        type: fileType,
        uploadedAt: new Date().toISOString()
      };
      try {
        await saveCertificateFile(certificate.id, file);
        accepted.push(certificate);
      } catch (error) {
        console.error("Could not store certificate file", error);
        toast(`Could not upload ${file.name}`, true);
      }
    }
    if (accepted.length) {
      setCertificates((current) => [...current, ...accepted]);
      toast(`${accepted.length} certificate${accepted.length === 1 ? "" : "s"} uploaded`);
    }
  };

  const removeCertificate = async (certificate: CertificateMeta) => {
    try {
      await deleteCertificateFile(certificate.id);
      setCertificates((current) => current.filter((item) => item.id !== certificate.id));
      toast("Certificate removed");
    } catch (error) {
      console.error("Could not remove certificate", error);
      toast("Could not remove the certificate file", true);
    }
  };

  const openCertificate = async (certificate: CertificateMeta) => {
    try {
      const file = await readCertificateFile(certificate.id);
      const url = URL.createObjectURL(file);
      setCertificatePreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { certificate, url };
      });
    } catch (error) {
      console.error("Could not open certificate", error);
      toast("Could not open the certificate file", true);
    }
  };

  const closeCertificatePreview = () => {
    setCertificatePreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const availableLevels = levels.filter((level) => studentPackage && taskLevelRank[level] <= packageRank[studentPackage]);
  const visibleTasks = useMemo(
    () =>
      store.tasks.filter((task) => {
        if (!studentPackage || !task.verified) return false;
        if (interviewLevels.includes(task.level) && !companyIsVerified(task.company, store.companyVerifications)) return false;
        if (taskLevelRank[task.level || "Intermediate"] > packageRank[studentPackage]) return false;
        const taskBudgetLimit = { general: 20, intermediate: 35, professional: 50, advanced: Number.POSITIVE_INFINITY }[studentPackage];
        if (task.budget > taskBudgetLimit) return false;
        const matchesField = filter === "All" || task.skill === filter;
        const matchesLevel = levelFilter === "All levels" || (task.level || "Intermediate") === levelFilter;
        const matchesQuery = `${task.title} ${task.company} ${task.description} ${task.skill}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesField && matchesLevel && matchesQuery;
      }).sort((a, b) => {
        const preferenceScore = (task: Task) => {
          const candidates = store.applications.filter((application) => application.hiredAgain && application.status === "completed");
          const taskPreference = candidates.filter((preferred) => {
            const completedTask = store.tasks.find((item) => item.id === preferred.taskId);
            return completedTask?.company === task.company && completedTask.skill === task.skill;
          });
          const preferredStudent = taskPreference.find((preferred) => preferred.studentId === CURRENT_STUDENT_ID);
          const avgRating = taskPreference.length ? taskPreference.reduce((total, item) => total + (item.rating || 0), 0) / taskPreference.length : 0;
          return (preferredStudent ? 1000 : 0) + avgRating * 10 + taskPreference.length;
        };
        return preferenceScore(b) - preferenceScore(a)
          || Number(b.skill === studentProfile.studyField) - Number(a.skill === studentProfile.studyField);
      }),
    [store.tasks, store.applications, store.companyVerifications, filter, levelFilter, query, studentProfile.studyField, studentPackage]
  );

  const detailId = page.startsWith("detail:") ? page.slice(7) : null;
  const detailTask = detailId ? store.tasks.find((task) => task.id === detailId) : null;
  const applied = detailTask ? store.applications.some((application) => application.taskId === detailTask.id && application.studentId === CURRENT_STUDENT_ID) : false;
  const workspaceHomePage = account === "student" ? "dashboard" : account === "company" ? "company-dashboard" : "admin-overview";
  const panelPages = account === "student"
    ? ["dashboard", "tasks", "applications", "reviews", "notifications", "badges", "profile"]
    : account === "company"
      ? ["company-dashboard", "company-jobs", "company-applicants", "company-candidates", "company-payouts", "company-profile"]
      : ["admin-overview", "admin-students", "admin-companies", "admin-moderation"];
  const isWorkspaceSubpage = page === "tasks-all" || !panelPages.includes(page);
  const workspaceBackTarget = detailTask ? "tasks" : workspaceHomePage;
  const workspaceBackLabel = detailTask ? "Back to tasks" : "Back to workspace";

  if (loading || authLoading) {
    return (
      <div className="splash">
        <div className="brand">GradLink <span>ZW</span></div>
        <div className="skeleton wide" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  const companyTasks = store.tasks.filter((task) => task.mine === true && task.company.trim().toLowerCase() === companyName.trim().toLowerCase());
  const unreadCandidateCount = store.applications.filter((application) => companyTasks.some((task) => task.id === application.taskId) && !readCompanyCandidateIds.includes(application.id)).length;
  const studentApplications = store.applications.filter((application) => application.studentId === CURRENT_STUDENT_ID);
  const studentNotifications = createStudentNotifications(studentApplications, store.tasks);
  const headerNotificationCount = account === "student"
    ? studentNotifications.filter((notification) => !readNotificationIds.includes(notification.id)).length
    : account === "company"
      ? store.applications.filter((application) => companyTasks.some((task) => task.id === application.taskId) && application.status === "applied").length
      : store.tasks.filter((task) => !task.verified).length;
  const markNotificationRead = (id: string) => {
    if (readNotificationIds.includes(id)) return;
    const updated = [...readNotificationIds, id];
    try {
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Could not save notification read state", error);
      setToastState({ m: "Could not save notification read state.", e: true });
    }
    setReadNotificationIds(updated);
  };
  const markAllNotificationsRead = () => {
    const updated = [...new Set([...readNotificationIds, ...studentNotifications.map((notification) => notification.id)])];
    try {
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Could not save notification read state", error);
      setToastState({ m: "Could not save notification read state.", e: true });
    }
    setReadNotificationIds(updated);
  };
  const completedByField = Object.fromEntries(SKILL_OPTIONS.map((skill) => [
    skill,
    new Set(store.applications
      .filter((application) => application.studentId === CURRENT_STUDENT_ID && application.status === "completed")
      .filter((application) => store.tasks.find((task) => task.id === application.taskId)?.skill === skill)
      .map((application) => application.taskId)).size
  ])) as Partial<Record<Skill, number>>;
  const companyCompletedByField = Object.fromEntries(SKILL_OPTIONS.map((skill) => [
    skill,
    new Set(store.applications
      .filter((application) => application.status === "completed")
      .filter((application) => {
        const task = store.tasks.find((item) => item.id === application.taskId);
        return task?.mine && task.skill === skill;
      })
      .map((application) => application.taskId)).size
  ])) as Partial<Record<Skill, number>>;
  const interviewFields = studentProfile.track === "interview"
    ? SKILL_OPTIONS.filter((skill) => (completedByField[skill] || 0) >= store.policy.studentCompletedTasks
      && (companyCompletedByField[skill] || 0) >= store.policy.companyFilledTasks)
    : [];

  if (adminLoginOpen) return <AdminLoginPage onBack={() => setAdminLoginOpen(false)} onSubmit={() => toast("Admin authentication is not connected yet.", true)} />;
  if (welcomePageOpen) return <WelcomePage themePreference={themePreference} onThemeChange={chooseTheme} onAdminLogoTap={handleAdminLogoTap} onContinue={(workspace) => {
    setAccessWorkspace(workspace);
    setWelcomePageOpen(false);
  }} />;
  if (accessWorkspace) return <AccountAccessPage workspace={accessWorkspace} onAuthenticate={authenticateWithEmailPassword} onGoogleSignIn={() => signInWithGoogle(accessWorkspace)} />;
  if (packageSetupTier) return <StudentPackageDetailsPage packageId={packageSetupTier} profile={studentProfile} onBack={() => { setPackageSetupTier(null); setPackageSelectionOpen(true); }} onSubmit={async (profile, cvFile) => {
    if (!supabase || !authUser) {
      setToastState({ m: "Sign in with Supabase before activating a package.", e: true });
      return;
    }
    const needsCv = packageSetupTier === "professional" || packageSetupTier === "advanced";
    let uploadedObjectPath: string | undefined;
    let previousCvId: string | undefined;
    try {
      const { data: existing, error: lookupError } = await supabase.from("profiles").select("id").eq("id", authUser.id).maybeSingle();
      if (lookupError) throw lookupError;
      const profileRow = {
        role: "student",
        full_name: profile.name,
        location: profile.location,
        study_field: profile.studyField,
        student_track: profile.track,
        package_tier: packageSetupTier,
        interview_track_enabled: needsCv,
        email: profile.email,
        phone: profile.phone,
        profile_visibility: "private"
      };
      if (existing) {
        const { role: _role, ...profileUpdate } = profileRow;
        const { error } = await supabase.from("profiles").update(profileUpdate).eq("id", authUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").insert({ id: authUser.id, ...profileRow });
        if (error) throw error;
      }

      if (needsCv) {
        if (!cvFile) throw new Error("Upload a PDF or DOCX CV to activate this package.");
        const extension = cvFile.name.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
        const cvId = crypto.randomUUID();
        uploadedObjectPath = `${authUser.id}/${cvId}.${extension}`;
        const { data: previous } = await supabase.from("student_cvs").select("id").eq("student_id", authUser.id).eq("is_current", true).maybeSingle();
        const { data: latest } = await supabase.from("student_cvs").select("version").eq("student_id", authUser.id).order("version", { ascending: false }).limit(1).maybeSingle();
        previousCvId = previous?.id;
        const nextVersion = (latest?.version || 0) + 1;
        const { error: archiveError } = await supabase.from("student_cvs").update({ is_current: false }).eq("student_id", authUser.id).eq("is_current", true);
        if (archiveError) throw archiveError;
        const { error: uploadError } = await supabase.storage.from("student-cvs").upload(uploadedObjectPath, cvFile, { contentType: cvFile.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: recordError } = await supabase.from("student_cvs").insert({
          id: cvId,
          student_id: authUser.id,
          object_path: uploadedObjectPath,
          file_name: cvFile.name,
          content_type: cvFile.type,
          file_size_bytes: cvFile.size,
          version: nextVersion,
          is_current: true
        });
        if (recordError) throw recordError;
      }

      setStudentProfile(profile);
      setStudentPackage(packageSetupTier);
      setLevelFilter((current) => current === "All levels" || taskLevelRank[current] <= packageRank[packageSetupTier] ? current : "All levels");
      setPackageSetupTier(null);
      setAccount("student");
      setPage("dashboard");
      setToastState({ m: needsCv ? "Profile and CV saved to Supabase." : "Profile saved to Supabase." });
    } catch (error) {
      if (uploadedObjectPath) await supabase.storage.from("student-cvs").remove([uploadedObjectPath]);
      if (previousCvId) await supabase.from("student_cvs").update({ is_current: true }).eq("id", previousCvId);
      console.error("Could not save the student package to Supabase", error);
      setToastState({ m: error instanceof Error ? error.message : "Could not save your profile to Supabase.", e: true });
    }
  }} />;
  if (packageSelectionOpen) return <StudentPackagePage onBack={() => {
    setPackageSelectionOpen(false);
    setAccount("student");
    setPage("dashboard");
  }} onContinue={(packageId) => {
    setPackageSelectionOpen(false);
    setPackageSetupTier(packageId);
  }} />;

  return (
    <div className={`app-shell account-${account} panel-page-${page}`}>
      <header className="topbar">
        <div className="topbar-brand-group">
          <button type="button" className={`side-panel-toggle ${sidePanelOpen ? "is-open" : ""}`} aria-label={sidePanelOpen ? "Close side panel" : "Open side panel"} aria-expanded={sidePanelOpen} aria-controls="workspace-side-panel" onClick={() => setSidePanelOpen((value) => !value)}><Menu size={21} /></button>
          <button className="brand-btn" onClick={(event) => {
            if ((event.target as HTMLElement).closest(".brand-mark")) { handleAdminLogoTap(); return; }
            go(account === "student" ? "dashboard" : account === "company" ? "company-dashboard" : "admin-overview");
          }}>
            <span className="brand-mark"><GraduationCap size={27} strokeWidth={2.4} /></span>
            <span className="brand-name">GradLink ZW</span>
          </button>
        </div>

        <div className="top-actions">
          <span className="account-label">{account === "student" ? "Student account" : account === "company" ? "Company account" : "Admin account"}</span>
          <button className="header-notification-button" type="button" aria-label={headerNotificationCount ? `Notifications, ${headerNotificationCount} unread` : "Notifications"} onClick={() => {
            if (account === "student") {
              go("notifications");
              return;
            }
            const updates = account === "company"
              ? store.applications.filter((application) => companyTasks.some((task) => task.id === application.taskId) && application.status === "applied").length
              : store.tasks.filter((task) => !task.verified).length;
            toast(account === "company" ? `${updates} application${updates === 1 ? "" : "s"} waiting for review.` : `${updates} task listing${updates === 1 ? "" : "s"} waiting for verification.`);
          }}><Bell size={20} />{headerNotificationCount > 0 && <span className="header-notification-count" aria-hidden="true">{headerNotificationCount > 99 ? "99+" : headerNotificationCount}</span>}</button>
          {isWorkspaceSubpage && <WorkspaceBackButton inHeader label={workspaceBackLabel} onClick={() => go(workspaceBackTarget)} />}
          {authUser && <button type="button" className="signout-action" onClick={signOut} title={`Sign out ${authUser.email || "of GradLink"}`}><LogOut size={17} /><span>Sign out</span></button>}
          <Avatar initials={account === "student" ? initialsFromName(studentProfile.name) : account === "company" ? initialsFromName(companyName) : "AD"} src={account === "student" ? studentProfile.avatarDataUrl : undefined} />
        </div>
      </header>

      {account === "student" && (
        <>
          {page === "dashboard" && <StudentDashboard profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} packageTier={studentPackage} isCompanyVerified={(name) => companyIsVerified(name, store.companyVerifications)} go={go} />}
          {page === "reviews" && <StudentReviews applications={studentApplications} tasks={store.tasks} />}
          {page === "applications" && <StudentSidePanel page="applications" profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} notifications={studentNotifications} readNotificationIds={readNotificationIds} onMarkNotificationRead={markNotificationRead} onMarkAllNotificationsRead={markAllNotificationsRead} go={go} onSubmitWork={submitStudentWork} onWithdraw={withdrawStudentApplication} />}
          {page === "notifications" && <StudentSidePanel page="notifications" profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} notifications={studentNotifications} readNotificationIds={readNotificationIds} onMarkNotificationRead={markNotificationRead} onMarkAllNotificationsRead={markAllNotificationsRead} go={go} onSubmitWork={submitStudentWork} onWithdraw={withdrawStudentApplication} />}
          {page === "badges" && <StudentSidePanel page="badges" profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} notifications={studentNotifications} readNotificationIds={readNotificationIds} onMarkNotificationRead={markNotificationRead} onMarkAllNotificationsRead={markAllNotificationsRead} go={go} onSubmitWork={submitStudentWork} onWithdraw={withdrawStudentApplication} />}
          {(page === "tasks" || page === "tasks-all") && (
            <main className="page feed-page">
              <div className="search-box">
                <Search size={19} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks by title, company or skill..." />
                {query && <button type="button" onClick={() => setQuery("")}><X size={16} /></button>}
              </div>

              <div className="filter-scroll">
                {fieldOptions.map((item) => (
                  <button key={item} type="button" className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="field-selector">
                <label>Work level
                  <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as "All levels" | WorkLevel)}>
                    <option>All levels</option>
                    {availableLevels.map((level) => <option key={level}>{level}</option>)}
                  </select>
                </label>
              </div>

              <div className="feed-heading">
                <div>
                  <span className="eyebrow">LIVE MARKETPLACE</span>
                  <h1>Find your next task</h1>
                </div>
                <span className="count">{visibleTasks.length}</span>
              </div>

              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={() => go(`detail:${task.id}`)}
                    onApply={() => apply(task)}
                    onView={() => go(`detail:${task.id}`)}
                    applyDisabled={store.applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID) || (studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced")}
                    applyLabel={store.applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID) ? "Applied" : studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced" ? "Earn only" : "Apply"}
                  />
                ))
              ) : (
                <div className="empty">
                  <Search size={28} />
                  <h2>{studentPackage ? `No tasks in ${filter}` : "Choose an earning package"}</h2>
                  <p>{studentPackage ? "Try a different field or clear your search to see more opportunities." : "Select a package to see tasks available at your tier."}</p>
                  {studentPackage ? <button className="primary" onClick={() => { setFilter("All"); setQuery(""); }}>Show all tasks</button> : <button className="primary" onClick={() => setPackageSelectionOpen(true)}>Choose package</button>}
                </div>
              )}
            </main>
          )}

          {page === "search" && (
            <main className="page">
              <div className="page-title">
                <span className="eyebrow">SEARCH</span>
                <h1>Search by field</h1>
                <p>Select a skill category and browse tasks designed for that field.</p>
              </div>
              <div className="search-box">
                <Search size={19} />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by keyword..." />
              </div>
              <div className="field-selector">
                <label>
                  Select field
                  <select value={filter} onChange={(e) => setFilter(e.target.value as "All" | Skill)}>
                    {fieldOptions.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-selector">
                <label>Work level
                  <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as "All levels" | WorkLevel)}>
                    <option>All levels</option>
                    {availableLevels.map((level) => <option key={level}>{level}</option>)}
                  </select>
                </label>
              </div>
              <div className="section">
                {visibleTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onOpen={() => go(`detail:${task.id}`)} onApply={() => apply(task)} onView={() => go(`detail:${task.id}`)}
                    applyDisabled={store.applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID) || (studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced")}
                    applyLabel={store.applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID) ? "Applied" : studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced" ? "Earn only" : "Apply"} />
                ))}
                {!visibleTasks.length && <div className="empty"><Search size={28} /><h2>{studentPackage ? "No matching tasks" : "Choose an earning package"}</h2><p>{studentPackage ? "Change your search or filters to see more verified opportunities." : "Select a package to see tasks available at your tier."}</p>{studentPackage ? <button className="primary" onClick={() => { setFilter("All"); setLevelFilter("All levels"); setQuery(""); }}>Clear search and filters</button> : <button className="primary" onClick={() => setPackageSelectionOpen(true)}>Choose package</button>}</div>}
              </div>
            </main>
          )}

          {page === "profile" && (
            <>
              <StudentProfile
                toast={toast}
                profile={studentProfile}
                applications={studentApplications}
                tasks={store.tasks}
                policy={store.policy}
                completedByField={completedByField}
                interviewFields={interviewFields}
                certificates={certificates}
                canInterview={studentPackage === "professional" || studentPackage === "advanced"}
                onSave={saveStudentProfile}
                onUploadCertificate={uploadCertificates}
                onRemoveCertificate={removeCertificate}
                onOpenCertificate={openCertificate}
                go={go}
              />
            </>
          )}
          {detailTask && <Detail task={detailTask} applied={applied} interviewTrack={studentProfile.track === "interview"} onApply={() => apply(detailTask)} />}
        </>
      )}

      {account === "company" && (
        <>
          {page === "company-dashboard" && <CompanyDashboard tasks={companyTasks} applications={store.applications} companyName={companyName} go={go} />}
          {page === "company-jobs" && (
            <CompanyJobs
              tasks={companyTasks}
              applications={store.applications}
              companyName={companyName}
              onCompanyName={setCompanyName}
              onCreateTask={createCompanyTask}
              companyVerified={companyIsVerified(companyName, store.companyVerifications)}
              go={go}
            />
          )}
          {page === "company-applicants" && (
            <CompanyApplicants
              tasks={companyTasks}
              allTasks={store.tasks}
              applications={store.applications}
              policy={store.policy}
              isCompanyVerified={(name) => companyIsVerified(name, store.companyVerifications)}
              onSetStatus={setApplicationStatus}
              onInviteInterview={inviteToInterview}
              onRateApplicant={rateApplicant}
              onHireAgain={toggleHireAgain}
              onRecordPayment={recordApplicationPayment}
              go={go}
            />
          )}
          {page === "company-candidates" && <CompanyCandidates tasks={companyTasks} allTasks={store.tasks} applications={store.applications} policy={store.policy} onInviteInterview={inviteToInterview} go={go} />}
          {page === "company-profile" && <CompanyProfile key={companyName} companyName={companyName} verification={store.companyVerifications.find((record) => record.companyName.trim().toLowerCase() === companyName.trim().toLowerCase())} tasks={companyTasks} applications={store.applications} onSubmit={saveCompanyVerification} onUploadDocument={saveCompanyVerificationDocument} onDeleteDocument={deleteCompanyProfileDocument} onReadDocument={readCertificateFile} go={go} toast={toast} />}
          {page === "company-payouts" && <CompanyPayouts tasks={companyTasks} applications={store.applications} />}
        </>
      )}

      {account === "admin" && (
        <>
          {page === "admin-overview" && <AdminDashboard tasks={store.tasks} applications={store.applications} policy={store.policy} companyVerifications={store.companyVerifications} onSetCompanyVerification={setCompanyVerificationStatus} onDownloadVerificationDocument={downloadCompanyVerificationDocument} onSetPolicy={savePolicy} onSetVerified={setTaskVerified} onDeleteTask={deleteTask} go={go} />}
          {page === "admin-students" && (
            <main className="page">
              <div className="page-title"><span className="eyebrow">STUDENTS</span><h1>Student overview</h1><p>Track student performance, reputation and activity.</p></div>
              <div className="jobs-panel">
                {[...new Set(store.applications.map((application) => application.studentName || "Student"))].map((name) => (
                  <div className="job-row" key={name}><div><strong>{name}</strong><small>{store.applications.filter((application) => application.studentName === name).length} applications submitted</small></div><span className="status-pill open">Student</span></div>
                ))}
              </div>
            </main>
          )}
          {page === "admin-companies" && (
            <main className="page">
              <div className="page-title"><span className="eyebrow">COMPANIES</span><h1>Company directory</h1><p>Review verified organisations and hiring activity.</p></div>
              <div className="jobs-panel">
                {[...new Set(store.tasks.map((task) => task.company))].map((name) => {
                  const companyTasks = store.tasks.filter((task) => task.company === name);
                  return <div className="job-row" key={name}><div><strong>{name}</strong><small>{companyTasks.length} task listings · {companyTasks.filter((task) => task.verified).length} verified</small></div><span className={`status-pill ${companyTasks.every((task) => task.verified) ? "open" : "review"}`}>{companyTasks.every((task) => task.verified) ? "Verified" : "Review"}</span></div>;
                })}
              </div>
            </main>
          )}
          {page === "admin-moderation" && (
            <main className="page">
              <div className="page-title"><span className="eyebrow">MODERATION</span><h1>Listing verification</h1><p>Review new task listings before they appear in the student marketplace.</p></div>
              <ModerationQueue tasks={store.tasks} onSetVerified={setTaskVerified} onDeleteTask={deleteTask} />
            </main>
          )}
        </>
      )}

      {!detailTask && <DashboardNavigation account={account} page={page} go={go} candidateCount={account === "company" ? unreadCandidateCount : 0} notificationCount={account === "student" ? studentNotifications.filter((notification) => !readNotificationIds.includes(notification.id)).length : 0} open={sidePanelOpen} onToggle={() => setSidePanelOpen((value) => !value)} themePreference={themePreference} onThemeChange={chooseTheme} profileName={studentProfile.name} profilePicture={studentProfile.avatarDataUrl} />}

      <AnimatePresence>{modal && <SignupPromptModal task={modal} onClose={() => setModal(null)} onSignup={() => { setModal(null); setAccessWorkspace("student"); }} />}</AnimatePresence>
      {certificatePreview && <CertificatePreview certificate={certificatePreview.certificate} url={certificatePreview.url} onClose={closeCertificatePreview} />}
      <AnimatePresence>{toastState && <Toast message={toastState.m} error={toastState.e} onClose={() => setToastState(null)} />}</AnimatePresence>
    </div>
  );
}
