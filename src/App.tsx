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
  Clock3,
  Grid2x2,
  GraduationCap,
  Home,
  Link2,
  Layers3,
  Menu,
  MessageCircle,
  Moon,
  Monitor,
  Search,
  ShieldCheck,
  Shield,
  Sun,
  Star,
  Trash2,
  Target,
  UnlockKeyhole,
  UserRound,
  Users,
  X,
  Zap,
  Sparkles,
  Wallet,
  type LucideIcon
} from "lucide-react";
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
type Store = { tasks: Task[]; applications: Application[]; policy: InterviewPolicy };
type StudentProfileData = { name: string; school: string; location: string; studyField: Skill; track: StudentTrack; email?: string; phone?: string; avatarDataUrl?: string; paymentProvider?: "Inbucks" | "Omari" | "EcoCash"; paymentNumber?: string };
type CertificateMeta = { id: string; name: string; size: number; type: string; uploadedAt: string };
const workLevels: WorkLevel[] = ["Entry level", "Intermediate"];
const interviewLevels: WorkLevel[] = ["Professional", "Advanced"];
const levels: WorkLevel[] = [...workLevels, ...interviewLevels];
const defaultPolicy: InterviewPolicy = { studentCompletedTasks: 10, companyFilledTasks: 10, minimumInterviewInvites: 5 };
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
          policy: { ...defaultPolicy, ...parsed.policy }
        };
      }
    }
  } catch (error) {
    console.error("Could not load saved GradLink data", error);
  }
  return { tasks: seedTasks, applications: seedApplications, policy: defaultPolicy };
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

function DashboardNavigation({ account, page, go, notificationCount = 0, open, onToggle, themePreference, onThemeChange }: { account: AccountType; page: string; go: (p: string) => void; notificationCount?: number; open: boolean; onToggle: () => void; themePreference: ThemePreference; onThemeChange: (preference: ThemePreference) => void }) {
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
            ["company-applicants", "Applicants", Users]
          ]
        : [
            ["admin-overview", "Overview", Grid2x2],
            ["admin-students", "Students", CircleUserRound],
            ["admin-companies", "Companies", Building2],
            ["admin-moderation", "Moderation", ShieldCheck]
          ];

  return <>
    {open && <button type="button" className="nav-backdrop" aria-label="Close side panel" onClick={onToggle} />}
    {!open && <button type="button" className="side-panel-toggle" aria-label="Open side panel" aria-expanded={false} aria-controls="workspace-side-panel" onClick={onToggle}><Menu size={21} /></button>}
    <nav id="workspace-side-panel" className={`app-nav ${open ? "is-open" : "is-closed"}`} aria-label={`${account} navigation`} aria-hidden={!open}>
      <div className="nav-heading"><span>{account === "student" ? "STUDENT WORKSPACE" : account === "company" ? "COMPANY WORKSPACE" : "ADMIN CONSOLE"}</span><ThemeModeControl preference={themePreference} onChange={onThemeChange} /></div>
      {items.map(([id, label, Icon]) => (
        <button key={id} type="button" tabIndex={open ? 0 : -1} className={`${page === id ? "active" : ""} ${id === "profile" ? "nav-profile-bottom" : ""}`} aria-current={page === id ? "page" : undefined} onClick={() => { go(id); onToggle(); }}>
          <Icon size={21} />
          <span>{label}{id === "notifications" && notificationCount > 0 ? <small className="nav-count">{notificationCount}</small> : null}</span>
        </button>
      ))}
    </nav>
  </>;
}

function WelcomePage({ onBack, onContinue, onAdminLogoTap, themePreference, onThemeChange }: { onBack: () => void; onContinue: (workspace: "student" | "company") => void; onAdminLogoTap: () => void; themePreference: ThemePreference; onThemeChange: (preference: ThemePreference) => void }) {
  const [selected, setSelected] = useState<"student" | "company">("student");
  const workspaceLabel = selected === "student" ? "Student" : "Company";
  return <main className="login-preview-page">
    <div className="login-preview-top"><div className="login-brand-group"><button type="button" className="welcome-admin-logo" aria-label="GradLink logo" onClick={onAdminLogoTap}><GraduationCap size={30} /></button><span className="brand">GradLink <span>ZW</span></span><ThemeModeControl preference={themePreference} onChange={onThemeChange} className="login-theme-control" /></div><button className="secondary-btn" type="button" onClick={onBack}>Back to workspace</button></div>
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

function AccountAccessPage({ workspace, onBack, onComplete }: { workspace: "student" | "company"; onBack: () => void; onComplete: (workspace: "student" | "company", mode: "create" | "signin", name: string) => void }) {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const isStudent = workspace === "student";
  const role = isStudent ? "student" : "company";
  return <main className="login-preview-page account-access-page">
    <div className="login-preview-top"><div className="login-brand-group"><span className="brand"><GraduationCap size={30} /> GradLink <span>ZW</span></span></div><button className="secondary-btn" type="button" onClick={onBack}>Back</button></div>
    <section className="access-card" aria-labelledby="access-title">
      <span className="eyebrow">{isStudent ? "STUDENT ACCESS" : "COMPANY ACCESS"}</span>
      <h1 id="access-title">{mode === "create" ? "Create your account" : "Sign in to your account"}</h1>
      <p>{mode === "create" ? isStudent ? "Create an account to access GradLink. Choose an earning package after setup to start applying for paid work." : "Create an account to access your company workspace and post tasks." : "Enter your account details to continue to your workspace."}</p>
      <form onSubmit={(event) => { event.preventDefault(); if (mode === "create" && password !== confirmPassword) { setPasswordError("Passwords do not match."); return; } setPasswordError(""); onComplete(workspace, mode, name.trim()); }}>
        {mode === "create" && <label>{isStudent ? "Full name" : "Company name"}<input required autoComplete={isStudent ? "name" : "organization"} value={name} onChange={(event) => setName(event.target.value)} placeholder={isStudent ? "Your full name" : "Your company name"} /></label>}
        <label>{isStudent ? "Email address" : "Work email"}<input required type="email" autoComplete="email" placeholder="you@example.com" /></label>
        <label>Password<input required type="password" minLength={8} autoComplete={mode === "create" ? "new-password" : "current-password"} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {mode === "create" && <label>Confirm password<input required type="password" minLength={8} autoComplete="new-password" placeholder="Enter your password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
        {passwordError && <small className="form-error">{passwordError}</small>}
        <button className="primary full access-submit" type="submit">{mode === "create" ? "Create account" : "Sign in"} <ArrowRight size={16} /></button>
      </form>
      <p className="access-switch">{mode === "create" ? "Already have an account?" : "New to GradLink?"} <button type="button" onClick={() => setMode(mode === "create" ? "signin" : "create")}>{mode === "create" ? "Sign in" : "Create account"}</button></p>
      <small className="access-prototype-note">Account access is a prototype flow; authentication is not connected yet.</small>
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

function StudentPackageDetailsPage({ packageId, profile, onBack, onSubmit }: { packageId: typeof STUDENT_PACKAGES[number]["id"]; profile: StudentProfileData; onBack: () => void; onSubmit: (profile: StudentProfileData) => void }) {
  const packageInfo = STUDENT_PACKAGES.find((item) => item.id === packageId)!;
  const needsFormalDetails = packageId === "professional" || packageId === "advanced";
  const [name, setName] = useState(profile.name === defaultStudentProfile.name ? "" : profile.name);
  const [school, setSchool] = useState(profile.school === defaultStudentProfile.school ? "" : profile.school);
  const [location, setLocation] = useState(profile.location === defaultStudentProfile.location ? "" : profile.location);
  const [email, setEmail] = useState(profile.email || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [paymentProvider, setPaymentProvider] = useState<StudentProfileData["paymentProvider"]>(profile.paymentProvider);
  const [paymentNumber, setPaymentNumber] = useState(profile.paymentNumber || "");
  return <main className="login-preview-page package-access-page"><div className="login-preview-top"><span className="brand"><GraduationCap size={30} /> GradLink <span>ZW</span></span><button className="secondary-btn" type="button" onClick={onBack}>Back to packages</button></div>
    <section className="access-card package-details-card" aria-labelledby="package-details-title"><span className="eyebrow">{packageInfo.name.toUpperCase()} PACKAGE SETUP</span><h1 id="package-details-title">{needsFormalDetails ? "Complete your student details" : "Add your payment details"}</h1><p>{needsFormalDetails ? `Add the formal and payment details for your ${packageInfo.name} account.` : `General and Intermediate accounts only need payment details to receive earnings.`}</p><form onSubmit={(event) => { event.preventDefault(); onSubmit({ ...profile, ...(needsFormalDetails ? { name: name.trim(), school: school.trim(), location: location.trim(), email: email.trim(), phone: phone.trim() } : {}), paymentProvider, paymentNumber: paymentNumber.trim() }); }}>
      {needsFormalDetails && <><label>Full legal name<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label>Phone number<input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label><label>School and course<input required value={school} onChange={(event) => setSchool(event.target.value)} /></label><label>Location<input required value={location} onChange={(event) => setLocation(event.target.value)} /></label></>}
      <label>Payment method<select required value={paymentProvider || ""} onChange={(event) => setPaymentProvider((event.target.value || undefined) as StudentProfileData["paymentProvider"])}><option value="">Choose a method</option>{paymentOptions.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}</select></label><label>Payment account or phone number<input required value={paymentNumber} onChange={(event) => setPaymentNumber(event.target.value)} placeholder="Where you receive your earnings" /></label><div className="payment-provider-options" aria-label="Payment method icons">{paymentOptions.map((option) => <button type="button" className={paymentProvider === option.name ? "payment-provider selected" : "payment-provider"} key={option.name} onClick={() => setPaymentProvider(option.name)} aria-label={`Select ${option.name}`}><img src={option.logo} alt="" loading="lazy" /><span>{option.name}</span></button>)}</div><button className="primary full access-submit" type="submit">Save details and activate {packageInfo.name} <ArrowRight size={16} /></button></form><small className="access-prototype-note">Details are stored in this browser prototype. Payments are not connected.</small></section>
  </main>;
}

function StudentDashboard({ profile, applications, tasks, certificates, policy, interviewFields, packageTier, go }: {
  profile: StudentProfileData; applications: Application[]; tasks: Task[]; certificates: CertificateMeta[]; policy: InterviewPolicy; interviewFields: Skill[]; packageTier: typeof STUDENT_PACKAGES[number]["id"] | null; go: (page: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const completed = applications.filter((application) => application.status === "completed");
  const completedTaskCount = new Set(completed.map((application) => application.taskId)).size;
  const completedTaskValue = completed.reduce((value, application) => {
    const task = taskById.get(application.taskId);
    if (task) value[task.payment] += task.budget;
    return value;
  }, { USD: 0, EcoCash: 0 });
  const recommendedTasks = tasks.filter((task) => task.verified && packageTier && taskLevelRank[task.level || "Intermediate"] <= packageRank[packageTier] && task.budget <= ({ general: 20, intermediate: 35, professional: 50, advanced: Number.POSITIVE_INFINITY }[packageTier])).map((task) => {
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
      <motion.div className="metric-card stat-card" {...dashboardMotion(2)}><span className="stat-icon"><UnlockKeyhole /></span><div><span>Interview unlock</span><strong>{profile.track === "interview" ? `${interviewFields.length} fields` : "Not enabled"}</strong><small>{profile.track === "interview" ? `${interviewFields.length} skill fields qualified` : "Switch tracks in your profile"}</small></div></motion.div>
      <motion.div className="metric-card stat-card" {...dashboardMotion(3)}><span className="stat-icon"><CircleDollarSign /></span><div><span>Completed task value</span><strong>USD ${completedTaskValue.USD.toFixed(2)}</strong><small>EcoCash ${completedTaskValue.EcoCash.toFixed(2)} · estimated task value</small></div></motion.div>
    </section>
    <section className="dashboard-panel favorite-tasks-panel">
      <div className="section-title"><div><h2><Sparkles size={19} /> Best tasks for you</h2><p>Verified openings ranked by your field, company preferences, and task ratings.</p></div><button className="primary view-all-tasks" type="button" onClick={() => go("tasks")}>View all tasks <ChevronRight size={15} /></button></div>
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
        <div className="application-card-actions"><button className="secondary-btn" type="button" onClick={() => { setSelectedId(a.id); setWorkDraft(a.submittedWork || ""); }}>Track application</button>{a.status === "accepted" && <button className="primary" type="button" onClick={() => { setSelectedId(a.id); setWorkDraft(a.submittedWork || ""); }}>Submit work</button>}{a.status === "applied" && <button className="text-btn withdraw-application" type="button" onClick={() => { if (window.confirm("Withdraw this application? It will be closed and cannot be undone.")) onWithdraw(a.id); }}>Withdraw application</button>}</div>
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

function StudentSidePanel({ page, profile, applications, tasks, certificates, policy, interviewFields, go, onSubmitWork, onWithdraw }: {
  page: "applications" | "notifications" | "badges";
  profile: StudentProfileData;
  applications: Application[];
  tasks: Task[];
  certificates: CertificateMeta[];
  policy: InterviewPolicy;
  interviewFields: Skill[];
  go: (page: string) => void;
  onSubmitWork: (applicationId: string, work: string) => void;
  onWithdraw: (applicationId: string) => void;
}) {
  const [badgeFilter, setBadgeFilter] = useState<"all" | "earned" | "locked">("all");
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
  const recommendations = tasks.filter((task) => task.verified && !applications.some((application) => application.taskId === task.id && application.studentId === CURRENT_STUDENT_ID));
  const notifications = [
    ...invites.map((application) => ({ id: `invite-${application.id}`, icon: GraduationCap, title: `Interview invitation from ${taskById.get(application.taskId)?.company || "a company"}`, detail: taskById.get(application.taskId)?.title || "View your application", action: () => go("profile") })),
    ...applications.filter((application) => application.status === "accepted").map((application) => ({ id: `accepted-${application.id}`, icon: CircleCheck, title: "Your application was accepted", detail: taskById.get(application.taskId)?.title || "View your application", action: () => go("profile") })),
    ...recommendations.slice(0, 1).map((task) => ({ id: `task-${task.id}`, icon: Sparkles, title: "New verified task available", detail: task.title, action: () => go(`detail:${task.id}`) }))
  ];
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
  if (page === "notifications") return <main className="page student-side-page"><div className="page-title"><h1><BellRing size={22} /> Notifications</h1><p>Updates about your applications, interviews, and new tasks.</p></div>
    {notifications.length ? <div className="notification-list">{notifications.map(({ id, icon: Icon, title, detail, action }) => <button className="notification-row" key={id} type="button" onClick={action}><span className="notification-dot"><Icon size={15} /></span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={15} /></button>)}</div> : <div className="empty"><Bell /><h2>You’re all caught up</h2><p>New invitations and task matches will appear here.</p></div>}
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

function Detail({ task, applied, interviewTrack, onBack, onApply }: { task: Task; applied: boolean; interviewTrack: boolean; onBack: () => void; onApply: () => void }) {
  return (
    <div className="page detail-page">
      <button className="back-btn" onClick={onBack}><ArrowLeft size={19} /> Back</button>
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
      <button type="button" className="back-btn profile-subpage-back" onClick={() => setProfileView("overview")}><ArrowLeft size={18} /> Back to profile</button>
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

function CompanyJobs({ tasks, applications, companyName, onCompanyName, onCreateTask, embedded = false, go }: {
  tasks: Task[];
  applications: Application[];
  companyName: string;
  onCompanyName: (name: string) => void;
  onCreateTask: (task: Omit<Task, "id" | "applicants" | "match" | "rating" | "verified" | "mine">) => void;
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

function CompanyApplicants({ tasks, allTasks, applications, policy, onSetStatus, onInviteInterview, onRateApplicant, onHireAgain, onRecordPayment, go }: {
  tasks: Task[];
  allTasks: Task[];
  applications: Application[];
  policy: InterviewPolicy;
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
            && item.interviewInvited
            && taskById.get(item.taskId)?.skill === task?.skill
          );
          const candidateHistory = applications.filter((item) => item.studentId === application.studentId && item.status === "completed").map((item) => {
            const historyTask = taskByIdAll.get(item.taskId);
            return { application: item, task: historyTask };
          });
          const interviewEligible = Boolean(task
            && status !== "rejected"
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
              <details className="candidate-review"><summary>Review candidate profile and completed work ({candidateHistory.length})</summary>
                <div className="candidate-history">
                  <p><strong>Completed work:</strong> {candidateHistory.length} verified task{candidateHistory.length === 1 ? "" : "s"} in total</p>
                  {candidateHistory.length ? candidateHistory.map(({ application: historyItem, task: historyTask }) => <div className="job-row" key={historyItem.id}><div><strong>{historyTask?.title || "Completed task"}</strong><small>{historyTask?.skill || "Field unavailable"} · {historyTask?.company || "Company"} · {new Date(historyItem.createdAt).toLocaleDateString()}</small></div><span>{historyItem.rating ? `${historyItem.rating}/5 ★` : "No rating"}</span></div>) : <p>No completed work recorded yet.</p>}
                  <label>Rate completed work
                    <select aria-label={`Rate ${application.studentName}`} value={application.rating || ""} onChange={(event) => event.target.value && onRateApplicant(application.id, Number(event.target.value))}>
                      <option value="">Choose rating</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
                    </select>
                  </label>
                  {application.rating && <p className="form-note">Your rating: {application.rating}/5{application.ratingFeedback ? ` · ${application.ratingFeedback}` : ""}</p>}
                </div>
              </details>
              {application.portfolio && /^https?:\/\//i.test(application.portfolio) && <a href={application.portfolio} target="_blank" rel="noopener noreferrer">View portfolio</a>}
              <div className="application-actions">
                {status === "applied" && <>
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
function AdminDashboard({ tasks, applications, policy, onSetPolicy, onSetVerified, onDeleteTask, go }: {
  tasks: Task[];
  applications: Application[];
  policy: InterviewPolicy;
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
  const [studentProfile, setStudentProfile] = useState<StudentProfileData>(loadStudentProfile);
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
  const [studentPackage, setStudentPackage] = useState<typeof STUDENT_PACKAGES[number]["id"] | null>(() => {
    try { return (STUDENT_PACKAGES.some((item) => item.id === localStorage.getItem(`${KEY}-student-package`)) ? localStorage.getItem(`${KEY}-student-package`) : null) as typeof STUDENT_PACKAGES[number]["id"] | null; }
    catch { return null; }
  });
  const adminLogoClicks = useRef(0);
  const adminLogoResetTimer = useRef<number | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

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
      localStorage.setItem(`${KEY}-student-profile`, JSON.stringify(studentProfile));
    } catch (error) {
      console.error("Could not save the student profile", error);
      setToastState({ m: "Could not save the profile in this browser", e: true });
    }
  }, [studentProfile]);
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

  const go = (p: string) => {
    setModal(null);
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
    if (!studentPackageSelected) {
      setPackageSelectionOpen(true);
      return;
    }
    setModal(task);
  };

  const createCompanyTask = (task: Omit<Task, "id" | "applicants" | "match" | "rating" | "verified" | "mine">) => {
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
      ? existing.status === "applied"
      : status === "completed" && (existing.status === "submitted" || existing.status === "accepted");
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
    if (!existing || existing.studentId !== CURRENT_STUDENT_ID || existing.status !== "applied") {
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
    const completedTasks = new Set(store.applications
      .filter((item) => item.studentId === application.studentId && item.status === "completed")
      .filter((item) => store.tasks.find((candidate) => candidate.id === item.taskId)?.skill === task.skill)
      .map((item) => item.taskId)).size;
    const companyCompleted = new Set(store.applications
      .filter((item) => item.status === "completed")
      .filter((item) => {
        const completedTask = store.tasks.find((candidate) => candidate.id === item.taskId);
        return completedTask?.mine && completedTask.skill === task.skill;
      })
      .map((item) => item.taskId)).size;
    if (application.status === "rejected"
      || application.studentTrack !== "interview"
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
    [store.tasks, store.applications, filter, levelFilter, query, studentProfile.studyField, studentPackage]
  );

  const detailId = page.startsWith("detail:") ? page.slice(7) : null;
  const detailTask = detailId ? store.tasks.find((task) => task.id === detailId) : null;
  const applied = detailTask ? store.applications.some((application) => application.taskId === detailTask.id && application.studentId === CURRENT_STUDENT_ID) : false;

  if (loading) {
    return (
      <div className="splash">
        <div className="brand">GradLink <span>ZW</span></div>
        <div className="skeleton wide" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  const companyTasks = store.tasks.filter((task) => task.mine === true);
  const studentApplications = store.applications.filter((application) => application.studentId === CURRENT_STUDENT_ID);
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
  if (welcomePageOpen) return <WelcomePage themePreference={themePreference} onThemeChange={chooseTheme} onAdminLogoTap={handleAdminLogoTap} onBack={() => setWelcomePageOpen(false)} onContinue={(workspace) => {
    setAccessWorkspace(workspace);
    setWelcomePageOpen(false);
  }} />;
  if (accessWorkspace) return <AccountAccessPage workspace={accessWorkspace} onBack={() => { setAccessWorkspace(null); setWelcomePageOpen(true); }} onComplete={(workspace, mode, name) => {
    setAccessWorkspace(null);
    if (workspace === "student") {
      if (mode === "signin" && studentPackage) {
        setAccount("student");
        setPage("dashboard");
        return;
      }
      setPackageSelectionOpen(true);
      return;
    }
    if (mode === "create" && name) setCompanyName(name);
    setAccount("company");
    setPage("company-dashboard");
  }} />;
  if (packageSetupTier) return <StudentPackageDetailsPage packageId={packageSetupTier} profile={studentProfile} onBack={() => { setPackageSetupTier(null); setPackageSelectionOpen(true); }} onSubmit={(profile) => {
    setStudentProfile(profile);
    setStudentPackage(packageSetupTier);
    setLevelFilter((current) => current === "All levels" || taskLevelRank[current] <= packageRank[packageSetupTier] ? current : "All levels");
    try { localStorage.setItem(`${KEY}-student-package`, packageSetupTier); } catch { /* package remains active for this session */ }
    setPackageSetupTier(null);
    setAccount("student");
    setPage("dashboard");
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
        <button className="brand-btn" onClick={(event) => {
          if ((event.target as HTMLElement).closest(".brand-mark")) { handleAdminLogoTap(); return; }
          go(account === "student" ? "dashboard" : account === "company" ? "company-dashboard" : "admin-overview");
        }}>
          <span className="brand-mark"><GraduationCap size={27} strokeWidth={2.4} /></span>
          <span className="brand-name">GradLink ZW</span>
        </button>

        <div className="top-actions">
          <span className="account-label">{account === "student" ? "Student account" : account === "company" ? "Company account" : "Admin account"}</span>
          <button className="login-preview-link" type="button" onClick={() => setWelcomePageOpen(true)}>Welcome page</button>
          <button aria-label="Notifications" onClick={() => {
            const updates = account === "student"
              ? studentApplications.filter((application) => application.status !== "applied" || application.interviewInvited).length
              : account === "company"
                ? store.applications.filter((application) => companyTasks.some((task) => task.id === application.taskId) && application.status === "applied").length
                : store.tasks.filter((task) => !task.verified).length;
            toast(account === "student" ? `${updates} application update${updates === 1 ? "" : "s"}. Open your profile to review.` : account === "company" ? `${updates} application${updates === 1 ? "" : "s"} waiting for review.` : `${updates} task listing${updates === 1 ? "" : "s"} waiting for verification.`);
          }}><Bell size={20} /></button>
          <Avatar initials={account === "student" ? initialsFromName(studentProfile.name) : account === "company" ? initialsFromName(companyName) : "AD"} src={account === "student" ? studentProfile.avatarDataUrl : undefined} />
        </div>
      </header>

      {account === "student" && (
        <>
          {page === "dashboard" && <StudentDashboard profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} packageTier={studentPackage} go={go} />}
          {page === "reviews" && <StudentReviews applications={studentApplications} tasks={store.tasks} />}
          {page === "applications" && <StudentSidePanel page="applications" profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} go={go} onSubmitWork={submitStudentWork} onWithdraw={withdrawStudentApplication} />}
          {page === "notifications" && <StudentSidePanel page="notifications" profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} go={go} onSubmitWork={submitStudentWork} onWithdraw={withdrawStudentApplication} />}
          {page === "badges" && <StudentSidePanel page="badges" profile={studentProfile} applications={studentApplications} tasks={store.tasks} certificates={certificates} policy={store.policy} interviewFields={interviewFields} go={go} onSubmitWork={submitStudentWork} onWithdraw={withdrawStudentApplication} />}
          {page === "tasks" && (
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
                onSave={setStudentProfile}
                onUploadCertificate={uploadCertificates}
                onRemoveCertificate={removeCertificate}
                onOpenCertificate={openCertificate}
                go={go}
              />
            </>
          )}
          {detailTask && <Detail task={detailTask} applied={applied} interviewTrack={studentProfile.track === "interview"} onBack={() => go("tasks")} onApply={() => apply(detailTask)} />}
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
              go={go}
            />
          )}
          {page === "company-applicants" && (
            <CompanyApplicants
              tasks={companyTasks}
              allTasks={store.tasks}
              applications={store.applications}
              policy={store.policy}
              onSetStatus={setApplicationStatus}
              onInviteInterview={inviteToInterview}
              onRateApplicant={rateApplicant}
              onHireAgain={toggleHireAgain}
              onRecordPayment={recordApplicationPayment}
              go={go}
            />
          )}
        </>
      )}

      {account === "admin" && (
        <>
          {page === "admin-overview" && <AdminDashboard tasks={store.tasks} applications={store.applications} policy={store.policy} onSetPolicy={savePolicy} onSetVerified={setTaskVerified} onDeleteTask={deleteTask} go={go} />}
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

      {!detailTask && account === "student" && !["dashboard", "tasks", "search", "profile", "applications", "reviews", "notifications", "badges"].includes(page) && <main className="page"><button className="back-btn" onClick={() => go("dashboard")}><ArrowLeft /> Back</button></main>}
      {!detailTask && account === "company" && !["company-dashboard", "company-jobs", "company-applicants"].includes(page) && <main className="page"><button className="back-btn" onClick={() => go("company-dashboard")}><ArrowLeft /> Back</button></main>}
      {!detailTask && account === "admin" && !["admin-overview", "admin-students", "admin-companies", "admin-moderation"].includes(page) && <main className="page"><button className="back-btn" onClick={() => go("admin-overview")}><ArrowLeft /> Back</button></main>}

      {!detailTask && <DashboardNavigation account={account} page={page} go={go} notificationCount={store.applications.filter((application) => application.studentId === CURRENT_STUDENT_ID && (application.interviewInvited || application.status === "accepted")).length} open={sidePanelOpen} onToggle={() => setSidePanelOpen((value) => !value)} themePreference={themePreference} onThemeChange={chooseTheme} />}

      <AnimatePresence>{modal && <SignupPromptModal task={modal} onClose={() => setModal(null)} onSignup={() => { setModal(null); setAccessWorkspace("student"); }} />}</AnimatePresence>
      {certificatePreview && <CertificatePreview certificate={certificatePreview.certificate} url={certificatePreview.url} onClose={closeCertificatePreview} />}
      <AnimatePresence>{toastState && <Toast message={toastState.m} error={toastState.e} onClose={() => setToastState(null)} />}</AnimatePresence>
    </div>
  );
}
