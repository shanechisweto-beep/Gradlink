import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Copy,
  Grid2x2,
  Home,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";
import { api, fileToBase64, type AccountUser, type BootstrapData, type Certificate } from "./api";
import {
  SKILL_OPTIONS,
  type Application,
  type InterviewPolicy,
  type Skill,
  type StudentTrack,
  type Task,
  type WorkLevel
} from "./types";

const fieldOptions: Array<"All" | Skill> = ["All", ...SKILL_OPTIONS];
type AccountType = "student" | "company" | "admin";
type Store = { tasks: Task[]; applications: Application[]; policy: InterviewPolicy };
type StudentProfileData = { name: string; school: string; location: string; studyField: Skill; track: StudentTrack };
type CertificateMeta = Certificate;
const levels: WorkLevel[] = ["Entry level", "Intermediate", "Professional", "Advanced"];
const defaultPolicy: InterviewPolicy = { studentCompletedTasks: 10, companyFilledTasks: 10, minimumInterviewInvites: 5 };
const defaultStudentProfile: StudentProfileData = {
  name: "",
  school: "",
  location: "",
  studyField: "Coding",
  track: "earning"
};

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

function AuthForm({ onAuthenticate, toast }: {
  onAuthenticate: (mode: "login" | "register", values: Record<string, string>) => Promise<void>;
  toast: (message: string, error?: boolean) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"student" | "company">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [location, setLocation] = useState("");
  const [studyField, setStudyField] = useState<Skill>("Coding");
  const [track, setTrack] = useState<StudentTrack>("earning");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onAuthenticate(mode, {
        email: email.trim(),
        password,
        role,
        name: name.trim(),
        school: school.trim(),
        location: location.trim(),
        studyField,
        track
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not authenticate.", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page auth-page">
      <div className="page-title">
        <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN GRADLINK"}</span>
        <h1>{mode === "login" ? "Sign in to your account" : "Create your account"}</h1>
        <p>Student and company workspaces are protected by your account. Admin accounts are created by the platform owner.</p>
      </div>
      <form className="form-card" onSubmit={submit}>
        {mode === "register" && <>
          <label>Account type
            <select value={role} onChange={(event) => setRole(event.target.value as "student" | "company")}>
              <option value="student">Student</option>
              <option value="company">Company</option>
            </select>
          </label>
          <label>{role === "company" ? "Company name" : "Full name"}
            <input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {role === "student" && <>
            <label>School and course<input required maxLength={160} value={school} onChange={(event) => setSchool(event.target.value)} /></label>
            <label>Location<input required maxLength={100} value={location} onChange={(event) => setLocation(event.target.value)} /></label>
            <label>Field of study
              <select value={studyField} onChange={(event) => setStudyField(event.target.value as Skill)}>
                {SKILL_OPTIONS.map((field) => <option key={field}>{field}</option>)}
              </select>
            </label>
            <label>Account goal
              <select value={track} onChange={(event) => setTrack(event.target.value as StudentTrack)}>
                <option value="earning">Earn through tasks</option>
                <option value="interview">Earn and pursue interviews</option>
              </select>
            </label>
          </>}
        </>}
        <label>Email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input required type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="primary full" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        <p className="form-note">
          {mode === "login" ? "New to GradLink? " : "Already registered? "}
          <button type="button" className="text-btn" onClick={() => setMode((current) => current === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Sign in instead"}
          </button>
        </p>
      </form>
    </main>
  );
}

function Avatar({ initials = "TM", size = 34 }: { initials?: string; size?: number }) {
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>;
}

function BottomNav({ account, page, go }: { account: AccountType; page: string; go: (p: string) => void }) {
  const items: Array<[string, string, LucideIcon]> =
    account === "student"
      ? [
          ["tasks", "Tasks", Home],
          ["search", "Search", Search],
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

  return (
    <nav className="bottom-nav">
      {items.map(([id, label, Icon]) => (
        <button key={id} className={page === id ? "active" : ""} onClick={() => go(id)}>
          <Icon size={21} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
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
      if (e.key === "Enter") onOpen();
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
        <span className="match"><Zap size={13} /> AI Match {task.match}%</span>
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
        <small>${Math.round(task.budget * 0.9)} You Get + ${Math.round(task.budget * 0.1)} Platform Fee (EcoCash Escrow Secured)</small>
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

function ApplyModal({ task, onClose, onSubmit }: { task: Task; onClose: () => void; onSubmit: (proposal: string, days: number, portfolio: string) => void }) {
  const [proposal, setProposal] = useState("");
  const [days, setDays] = useState(1);
  const [portfolio, setPortfolio] = useState("");
  const valid = proposal.trim().length >= 20;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="modal">
        <div className="modal-head">
          <div><span className="eyebrow">APPLYING TO</span><h2>{task.title}</h2></div>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>

        <label>
          Your proposal <span>(min 20 chars)</span>
          <textarea value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Tell the company how you will complete the task..." />
        </label>

        <div className="char-count">{proposal.length} characters</div>

        <label>
          Delivery time
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>1 day</option>
            <option value={2}>2 days</option>
            <option value={3}>3 days</option>
            <option value={5}>5 days</option>
          </select>
        </label>

        <label>
          Portfolio link <span>(optional)</span>
          <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://..." />
        </label>

        <button className="primary full" disabled={!valid} onClick={() => onSubmit(proposal.trim(), days, portfolio.trim())}>
          SUBMIT APPLICATION
        </button>
      </motion.div>
    </div>
  );
}

function StudentProfile({ toast, profile, applications, tasks, policy, completedByField, interviewFields, certificates, onSave, onUploadCertificate, onRemoveCertificate, onOpenCertificate }: {
  toast: (m: string) => void;
  profile: StudentProfileData;
  applications: Application[];
  tasks: Task[];
  policy: InterviewPolicy;
  completedByField: Partial<Record<Skill, number>>;
  interviewFields: Skill[];
  certificates: CertificateMeta[];
  onSave: (profile: StudentProfileData) => void;
  onUploadCertificate: (files: FileList | null) => void;
  onRemoveCertificate: (certificate: CertificateMeta) => void;
  onOpenCertificate: (certificate: CertificateMeta) => void;
}) {
  const [ai, setAi] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [school, setSchool] = useState(profile.school);
  const [location, setLocation] = useState(profile.location);
  const [studyField, setStudyField] = useState<Skill>(profile.studyField);
  const [track, setTrack] = useState<StudentTrack>(profile.track);
  const completedTasks = completedByField[profile.studyField] || 0;
  const totalCompletedTasks = new Set(applications
    .filter((application) => application.status === "completed")
    .map((application) => application.taskId)).size;
  const summary = "Tino delivers 1.2 days early avg, top 15% in Excel, 100% completion rate";

  return (
    <div className="page">
      <section className="profile-hero">
        <Avatar initials="TM" size={80} />
        <div>
          <h1>{profile.name}</h1>
          <p>{profile.school} • {profile.location}</p>
        </div>
        <button className="outline-btn" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "Edit profile"}</button>
      </section>
      {editing && (
        <form className="form-card profile-edit" onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || !school.trim() || !location.trim()) {
            toast("Complete all profile fields before saving");
            return;
          }
          onSave({ name: name.trim(), school: school.trim(), location: location.trim(), studyField, track });
          setEditing(false);
          toast("Profile saved");
        }}>
          <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>School and course<input required value={school} onChange={(event) => setSchool(event.target.value)} /></label>
          <label>Location<input required value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          <label>Field of study
            <select value={studyField} onChange={(event) => setStudyField(event.target.value as Skill)}>
              {SKILL_OPTIONS.map((field) => <option key={field} value={field}>{field}</option>)}
            </select>
          </label>
          <label>Account goal
            <select value={track} onChange={(event) => setTrack(event.target.value as StudentTrack)}>
              <option value="earning">Earn through tasks</option>
              <option value="interview">Earn and pursue interviews</option>
            </select>
          </label>
          <button className="primary" type="submit">Save profile</button>
        </form>
      )}

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
        <div className="ring"><strong>87</strong><span>/100</span></div>
        <div>
          <h3>Reputation</h3>
          <p>Strong student proof and reliable delivery history.</p>
        </div>
      </div>

      <div className="badge-scroll">
        <div className="badge">Python ✓<small>Verified by Dr Moyo</small></div>
        <div className="badge">{totalCompletedTasks} Tasks Completed</div>
        <div className="badge">4.8★ Rating</div>
        <div className="badge">Top 10% HIT</div>
      </div>

      <section className="section">
        <div className="section-title"><h2>Portfolio</h2></div>
        <div className="portfolio-grid">
          {[
            ["ZESA Watch", "Built at Eight2Five, 120 users", "map"],
            ["Excel Stock", "$30", "sheet"],
            ["Logo Design", "$20", "logo"]
          ].map(([title, sub, type]) => (
            <div className="portfolio-card" key={title}>
              <div className={`portfolio-image ${type}`}>{type === "map" ? "MAP" : type === "sheet" ? "XLS" : "LOGO"}</div>
              <strong>{title}</strong>
              <small>{sub}</small>
              <button className="text-btn" onClick={() => { navigator.clipboard?.writeText(title); toast("Portfolio link copied"); }}><Copy size={14} /> View</button>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Skills</h2>
        {[["Python", 90, "Verified ✓"], ["Excel", 95, "Verified by 3 clients"], ["Canva", 80, ""]].map(([name, val, sub]) => (
          <div className="skill-row" key={String(name)}>
            <div>
              <strong>{String(name)}</strong>
              {sub && <small>{String(sub)}</small>}
            </div>
            <strong>{String(val)}%</strong>
            <div className="progress"><span style={{ width: `${Number(val)}%` }} /></div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2>Reviews</h2>
        <div className="review">
          <div><Avatar initials="TP" /><strong>Tariro Pharmacy</strong><span>★★★★★</span></div>
          <p>Delivered 1 day early — Tariro Pharmacy</p>
        </div>
        <div className="review">
          <div><Avatar initials="EZ" /><strong>Eight2Five</strong><span>★★★★★</span></div>
          <p>Clear communication and excellent attention to detail.</p>
        </div>
      </section>

      <section className="section">
        <h2>My applications</h2>
        {applications.length ? applications.map((application) => {
          const task = tasks.find((item) => item.id === application.taskId);
          return (
            <div className="job-row" key={application.id}>
              <div>
                <strong>{task?.title || "Task no longer available"}</strong>
                <small>{task ? `${task.company} · ${new Date(application.createdAt).toLocaleDateString()}` : "Application record"}</small>
              </div>
              <span className={`status-pill ${application.status === "accepted" ? "open" : "review"}`}>{application.status || "applied"}</span>
            </div>
          );
        }) : <p>You have not applied to any tasks yet.</p>}
      </section>

      <section className="ai-box">
        <div>
          <Zap />
          <h3>AI Career Summary</h3>
          <p>{ai ? summary : "Turn your completed work into a concise proof statement."}</p>
        </div>
        <button className="primary" onClick={() => setAi(true)} disabled={ai}>{ai ? "Generated ✓" : "AI Generate Summary"}</button>
      </section>
    </div>
  );
}

function CompanyDashboard({ tasks, go }: { tasks: Task[]; go: (page: string) => void }) {
  const totalApplicants = tasks.reduce((sum, task) => sum + task.applicants, 0);
  const avgMatch = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.match, 0) / tasks.length) : 0;
  const activeJobs = tasks.filter((task) => task.applicants > 0).length;

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">COMPANY ACCOUNT</span>
        <h1>Company dashboard</h1>
        <p>Manage your listings, review applicants and track delivery.</p>
      </div>
      <button className="primary" type="button" onClick={() => go("company-jobs")}>Create a task listing</button>

      <div className="metrics-grid">
        <div className="metric-card">
          <span>Live tasks</span>
          <strong>{tasks.filter((task) => task.applicants > 0).length}</strong>
        </div>
        <div className="metric-card">
          <span>Applicants</span>
          <strong>{totalApplicants}</strong>
        </div>
        <div className="metric-card">
          <span>Avg. match</span>
          <strong>{avgMatch}%</strong>
        </div>
        <div className="metric-card">
          <span>Active jobs</span>
          <strong>{activeJobs}</strong>
        </div>
      </div>

      <section className="section">
        <div className="section-title"><h2>Recent job performance</h2></div>
        <div className="jobs-panel">
          {tasks.slice(0, 4).map((task) => (
            <div className="job-row" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <small>{task.skill} · {task.applicants} applicants</small>
              </div>
              <span className="status-pill open">{task.applicants ? "Open" : "Done"}</span>
            </div>
          ))}
          {!tasks.length && <div className="empty"><BriefcaseBusiness /><h2>No listings yet</h2><p>Create a task to start receiving student applications.</p></div>}
        </div>
      </section>
    </div>
  );
}

function CompanyJobs({ tasks, applications, companyName, onCreateTask }: {
  tasks: Task[];
  applications: Application[];
  companyName: string;
  onCreateTask: (task: Omit<Task, "id" | "applicants" | "match" | "rating" | "verified" | "mine">) => Promise<void>;
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
    void onCreateTask({
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
    <main className="page">
      <div className="page-title">
        <span className="eyebrow">COMPANY LISTINGS</span>
        <h1>Post and manage tasks</h1>
        <p>Listings are checked by the server and stored in PostgreSQL until an administrator verifies them.</p>
      </div>
      <form className="form-card" onSubmit={submit}>
        <label>Company name<input readOnly value={companyName} /></label>
        <label>Task title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Create a social media campaign" /></label>
        <label>Task brief<textarea required minLength={10} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the work and expected deliverables." /></label>
        <div className="two-col">
          <label>Budget<input required type="number" min="1" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
          <label>Payment method<select value={payment} onChange={(event) => setPayment(event.target.value as "USD" | "EcoCash")}><option value="USD">USD</option><option value="EcoCash">EcoCash</option></select></label>
        </div>
        <div className="two-col">
          <label>Field<select value={skill} onChange={(event) => setSkill(event.target.value as Skill)}>{SKILL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Required work level<select value={level} onChange={(event) => setLevel(event.target.value as WorkLevel)}>{levels.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
        <div className="two-col">
          <label>Deadline<input required type="date" min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="primary full" type="submit">Publish task listing</button>
        <p className="form-note">Task postings are saved in PostgreSQL. The platform does not collect or hold escrow funds.</p>
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
    </main>
  );
}

function CompanyApplicants({ tasks, allTasks, applications, policy, onSetStatus, onInviteInterview }: {
  tasks: Task[];
  allTasks: Task[];
  applications: Application[];
  policy: InterviewPolicy;
  onSetStatus: (applicationId: string, status: Application["status"]) => void;
  onInviteInterview: (applicationId: string) => void;
}) {
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
        <span className="eyebrow">APPLICATIONS</span>
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
          const interviewEligible = Boolean(task
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
              {application.portfolio && <a href={application.portfolio} target="_blank" rel="noreferrer">View portfolio</a>}
              <div className="application-actions">
                {status === "applied" && <>
                  <button type="button" className="primary" onClick={() => onSetStatus(application.id, "accepted")}>Accept</button>
                  <button type="button" className="secondary-btn" onClick={() => onSetStatus(application.id, "rejected")}>Reject</button>
                </>}
                {status === "accepted" && <button type="button" className="primary" onClick={() => onSetStatus(application.id, "completed")}>Mark work complete</button>}
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
  return (
    <section className="section">
      <div className="section-title"><h2>Task listing moderation</h2></div>
      <div className="jobs-panel">
        {tasks.map((task) => (
          <div className="job-row" key={task.id}>
            <div>
              <strong>{task.company}</strong>
              <small>{task.title}</small>
            </div>
            <div className="admin-actions">
              <button className={`status-pill ${task.verified ? "open" : "review"}`} onClick={() => onSetVerified(task.id, !task.verified)}>
                {task.verified ? "Unverify" : "Verify"}
              </button>
              <button className="danger-btn" onClick={() => {
                if (window.confirm(`Remove "${task.title}" and its applications?`)) onDeleteTask(task.id);
              }}>Remove</button>
            </div>
          </div>
        ))}
        {!tasks.length && <div className="empty"><ShieldCheck /><h2>No task listings to review</h2></div>}
      </div>
    </section>
  );
}

function AdminDashboard({ tasks, policy, onSetPolicy, onSetVerified, onDeleteTask }: {
  tasks: Task[];
  policy: InterviewPolicy;
  onSetPolicy: (policy: InterviewPolicy) => void;
  onSetVerified: (taskId: string, verified: boolean) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const totalApplicants = tasks.reduce((sum, task) => sum + task.applicants, 0);
  const verified = tasks.filter((task) => task.verified).length;
  const [thresholds, setThresholds] = useState(policy);

  useEffect(() => setThresholds(policy), [policy]);

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">ADMIN ACCOUNT</span>
        <h1>Platform overview</h1>
        <p>Monitor platform health, quality and moderation.</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <span>Total tasks</span>
          <strong>{tasks.length}</strong>
        </div>
        <div className="metric-card">
          <span>Applicants</span>
          <strong>{totalApplicants}</strong>
        </div>
        <div className="metric-card">
          <span>Verified listings</span>
          <strong>{verified}</strong>
        </div>
        <div className="metric-card">
          <span>Resolution rate</span>
          <strong>96%</strong>
        </div>
      </div>

      <section className="section">
        <div className="section-title"><h2>Interview pathway thresholds</h2></div>
        <form className="form-card policy-form" onSubmit={(event) => {
          event.preventDefault();
          onSetPolicy({
            studentCompletedTasks: Math.max(1, Math.floor(thresholds.studentCompletedTasks)),
            companyFilledTasks: Math.max(1, Math.floor(thresholds.companyFilledTasks)),
            minimumInterviewInvites: Math.max(1, Math.floor(thresholds.minimumInterviewInvites))
          });
        }}>
          <div className="two-col">
            <label>Student completed tasks per field
              <input type="number" min="1" step="1" required value={thresholds.studentCompletedTasks} onChange={(event) => setThresholds((current) => ({ ...current, studentCompletedTasks: Number(event.target.value) }))} />
            </label>
            <label>Company completed/filled tasks per field
              <input type="number" min="1" step="1" required value={thresholds.companyFilledTasks} onChange={(event) => setThresholds((current) => ({ ...current, companyFilledTasks: Number(event.target.value) }))} />
            </label>
          </div>
          <label>Minimum interview invitations after company threshold
            <input type="number" min="1" step="1" required value={thresholds.minimumInterviewInvites} onChange={(event) => setThresholds((current) => ({ ...current, minimumInterviewInvites: Number(event.target.value) }))} />
          </label>
          <button className="primary" type="submit">Save interview thresholds</button>
        </form>
      </section>

      <ModerationQueue tasks={tasks} onSetVerified={onSetVerified} onDeleteTask={onDeleteTask} />
    </div>
  );
}

export function App() {
  const [store, setStore] = useState<Store>({ tasks: [], applications: [], policy: defaultPolicy });
  const [studentProfile, setStudentProfile] = useState<StudentProfileData>(defaultStudentProfile);
  const [certificates, setCertificates] = useState<CertificateMeta[]>([]);
  const [companyName, setCompanyName] = useState("My Company");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [page, setPage] = useState("tasks");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | Skill>("All");
  const [levelFilter, setLevelFilter] = useState<"All levels" | WorkLevel>("All levels");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Task | null>(null);
  const [toastState, setToastState] = useState<{ m: string; e?: boolean } | null>(null);

  const toast = (m: string, e?: boolean) => setToastState({ m, e });
  const account: AccountType = user?.role || "student";

  const refreshData = useCallback(async () => {
    const data = await api<BootstrapData>("/api/bootstrap");
    setUser(data.user);
    setStore({ tasks: data.tasks, applications: data.applications, policy: data.policy });
    setCertificates(data.certificates);
    setCompanyName(data.companyName || "My Company");
    setStudentProfile(data.profile || defaultStudentProfile);
    return data;
  }, []);

  useEffect(() => {
    void refreshData()
      .catch((error: unknown) => {
        console.error("Could not load GradLink from PostgreSQL", error);
        toast(error instanceof Error ? error.message : "Could not load GradLink data.", true);
      })
      .finally(() => setLoading(false));
  }, [refreshData]);

  const go = (p: string) => {
    setModal(null);
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const authenticate = async (mode: "login" | "register", values: Record<string, string>) => {
    await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      body: JSON.stringify(mode === "login"
        ? { email: values.email, password: values.password }
        : values)
    });
    const data = await refreshData();
    const nextPage = data.user?.role === "company" ? "company-dashboard"
      : data.user?.role === "admin" ? "admin-overview" : "tasks";
    go(nextPage);
    toast(mode === "login" ? "Signed in successfully" : "Account created successfully");
  };

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      const data = await refreshData();
      go("tasks");
      toast("Signed out");
      return data;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not sign out.", true);
    }
  };

  const apply = (task: Task) => {
    if (!user) {
      toast("Sign in or create a student account to apply");
      go("auth");
      return;
    }
    if (user.role !== "student") {
      toast("Only student accounts can apply for tasks", true);
      return;
    }
    if (studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced") {
      toast("Interview-pathway applications require Professional or Advanced work", true);
      return;
    }
    if (store.applications.some((application) => application.taskId === task.id && application.studentId === user.id)) {
      toast("This student has already submitted an application for this task");
      return;
    }
    setModal(task);
  };

  const submitApplication = async (proposal: string, days: number, portfolio: string) => {
    if (!modal) return;
    try {
      await api(`/api/tasks/${encodeURIComponent(modal.id)}/applications`, {
        method: "POST", body: JSON.stringify({ proposal, deliveryDays: days, portfolio })
      });
      setModal(null);
      await refreshData();
      toast("Application submitted successfully");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not submit your application.", true);
    }
  };

  const createCompanyTask = async (task: Omit<Task, "id" | "applicants" | "match" | "rating" | "verified" | "mine">) => {
    try {
      await api("/api/tasks", { method: "POST", body: JSON.stringify(task) });
      await refreshData();
      toast("Task listing published and sent for admin verification");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not publish this task.", true);
    }
  };

  const setApplicationStatus = async (applicationId: string, status: Application["status"]) => {
    try {
      await api(`/api/applications/${applicationId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refreshData();
      toast(status === "completed" ? "Work marked complete" : `Application ${status.replace("-", " ")}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update application.", true);
    }
  };

  const inviteToInterview = async (applicationId: string) => {
    try {
      await api(`/api/applications/${applicationId}/interview-invitation`, { method: "POST" });
      await refreshData();
      toast("Interview invitation sent");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send the interview invitation.", true);
    }
  };

  const setTaskVerified = async (taskId: string, verified: boolean) => {
    try {
      await api(`/api/admin/tasks/${encodeURIComponent(taskId)}/verification`, { method: "PATCH", body: JSON.stringify({ verified }) });
      await refreshData();
      toast(verified ? "Task listing verified" : "Task listing verification removed");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update task verification.", true);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api(`/api/admin/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
      await refreshData();
      toast("Task listing and its applications removed");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not remove task listing.", true);
    }
  };

  const savePolicy = async (policy: InterviewPolicy) => {
    try {
      await api("/api/admin/policy", { method: "PATCH", body: JSON.stringify(policy) });
      await refreshData();
      toast("Interview thresholds saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save interview thresholds.", true);
    }
  };

  const uploadCertificates = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: CertificateMeta[] = [];
    for (const file of Array.from(files)) {
      if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        toast(`${file.name}: choose a PDF, JPG or PNG up to 5 MB`, true);
        continue;
      }
      try {
        const data = await fileToBase64(file);
        const result = await api<{ certificate: CertificateMeta }>("/api/certificates", {
          method: "POST", body: JSON.stringify({ name: file.name, type: file.type, data })
        });
        accepted.push(result.certificate);
      } catch (error) {
        console.error("Could not store certificate file", error);
        toast(error instanceof Error ? `${file.name}: ${error.message}` : `Could not upload ${file.name}`, true);
      }
    }
    if (accepted.length) {
      await refreshData();
      toast(`${accepted.length} certificate${accepted.length === 1 ? "" : "s"} uploaded`);
    }
  };

  const removeCertificate = async (certificate: CertificateMeta) => {
    try {
      await api(`/api/certificates/${certificate.id}`, { method: "DELETE" });
      await refreshData();
      toast("Certificate removed");
    } catch (error) {
      console.error("Could not remove certificate", error);
      toast(error instanceof Error ? error.message : "Could not remove the certificate file", true);
    }
  };

  const openCertificate = (certificate: CertificateMeta) => {
    window.open(`/api/certificates/${certificate.id}`, "_blank", "noopener,noreferrer");
  };

  const saveStudentProfile = async (profile: StudentProfileData) => {
    try {
      const result = await api<{ user: AccountUser }>("/api/profile", { method: "PATCH", body: JSON.stringify(profile) });
      setStudentProfile(profile);
      setUser(result.user);
      toast("Profile saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the profile.", true);
    }
  };

  const visibleTasks = useMemo(
    () =>
      store.tasks.filter((task) => {
        if (!task.verified) return false;
        const matchesField = filter === "All" || task.skill === filter;
        const matchesLevel = levelFilter === "All levels" || (task.level || "Intermediate") === levelFilter;
        const matchesQuery = `${task.title} ${task.company} ${task.description} ${task.skill}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesField && matchesLevel && matchesQuery;
      }).sort((a, b) => {
        if (filter !== "All") return 0;
        return Number(b.skill === studentProfile.studyField) - Number(a.skill === studentProfile.studyField);
      }),
    [store.tasks, filter, levelFilter, query, studentProfile.studyField]
  );

  const detailId = page.startsWith("detail:") ? page.slice(7) : null;
  const detailTask = detailId ? store.tasks.find((task) => task.id === detailId) : null;
  const applied = detailTask && user
    ? store.applications.some((application) => application.taskId === detailTask.id && application.studentId === user.id)
    : false;

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
  const studentApplications = user ? store.applications.filter((application) => application.studentId === user.id) : [];
  const completedByField = Object.fromEntries(SKILL_OPTIONS.map((skill) => [
    skill,
    new Set(store.applications
      .filter((application) => application.studentId === user?.id && application.status === "completed")
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
  const initials = (user?.name || "?").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-btn" onClick={() => go(account === "student" ? "tasks" : account === "company" ? "company-dashboard" : "admin-overview")}>
          GradLink <span>ZW</span><i /></button>

        <div className="top-actions">
          {user ? <>
            <span className="account-pill active">{user.role === "admin" ? "Admin" : user.role === "company" ? "Company" : "Student"}</span>
            <button type="button" className="text-btn" onClick={() => void logout()}>Sign out</button>
            <Avatar initials={initials} />
          </> : <button type="button" className="primary" onClick={() => go("auth")}>Sign in</button>}
        </div>
      </header>

      {page === "auth" && <AuthForm onAuthenticate={authenticate} toast={toast} />}

      {page !== "auth" && account === "student" && (
        <>
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
                    {levels.map((level) => <option key={level}>{level}</option>)}
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
                    applyDisabled={studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced"}
                    applyLabel={studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced" ? "Earn only" : "Apply"}
                  />
                ))
              ) : (
                <div className="empty">
                  <Search size={28} />
                  <h2>No tasks in {filter}</h2>
                  <p>Try a different field or clear your search to see more opportunities.</p>
                  <button className="primary" onClick={() => { setFilter("All"); setQuery(""); }}>Show all tasks</button>
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
                    {levels.map((level) => <option key={level}>{level}</option>)}
                  </select>
                </label>
              </div>
              <div className="section">
                {visibleTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onOpen={() => go(`detail:${task.id}`)} onApply={() => apply(task)} onView={() => go(`detail:${task.id}`)}
                    applyDisabled={studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced"}
                    applyLabel={studentProfile.track === "interview" && task.level !== "Professional" && task.level !== "Advanced" ? "Earn only" : "Apply"} />
                ))}
              </div>
            </main>
          )}

          {page === "profile" && (
            user
              ? <StudentProfile
                  toast={toast}
                  profile={studentProfile}
                  applications={studentApplications}
                  tasks={store.tasks}
                  policy={store.policy}
                  completedByField={completedByField}
                  interviewFields={interviewFields}
                  certificates={certificates}
                  onSave={(profile) => void saveStudentProfile(profile)}
                  onUploadCertificate={uploadCertificates}
                  onRemoveCertificate={removeCertificate}
                  onOpenCertificate={openCertificate}
                />
              : <main className="page"><div className="empty"><UserRound /><h2>Your student profile</h2><p>Sign in or create a student account to manage your profile and certificates.</p><button className="primary" onClick={() => go("auth")}>Sign in or register</button></div></main>
          )}
          {detailTask && <Detail task={detailTask} applied={applied} interviewTrack={studentProfile.track === "interview"} onBack={() => go("tasks")} onApply={() => apply(detailTask)} />}
        </>
      )}

      {page !== "auth" && account === "company" && (
        <>
          {page === "company-dashboard" && <CompanyDashboard tasks={companyTasks} go={go} />}
          {page === "company-jobs" && (
            <CompanyJobs
              tasks={companyTasks}
              applications={store.applications}
              companyName={companyName}
              onCreateTask={createCompanyTask}
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
            />
          )}
        </>
      )}

      {page !== "auth" && account === "admin" && (
        <>
          {page === "admin-overview" && <AdminDashboard tasks={store.tasks} policy={store.policy} onSetPolicy={savePolicy} onSetVerified={setTaskVerified} onDeleteTask={deleteTask} />}
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

      {page !== "auth" && !detailTask && account === "student" && !["tasks", "search", "profile"].includes(page) && <main className="page"><button className="back-btn" onClick={() => go("tasks")}><ArrowLeft /> Back</button></main>}
      {page !== "auth" && !detailTask && account === "company" && !["company-dashboard", "company-jobs", "company-applicants"].includes(page) && <main className="page"><button className="back-btn" onClick={() => go("company-dashboard")}><ArrowLeft /> Back</button></main>}
      {page !== "auth" && !detailTask && account === "admin" && !["admin-overview", "admin-students", "admin-companies", "admin-moderation"].includes(page) && <main className="page"><button className="back-btn" onClick={() => go("admin-overview")}><ArrowLeft /> Back</button></main>}

      {page !== "auth" && !detailTask && <BottomNav account={account} page={page} go={go} />}

      <AnimatePresence>{modal && <ApplyModal task={modal} onClose={() => setModal(null)} onSubmit={submitApplication} />}</AnimatePresence>
      <AnimatePresence>{toastState && <Toast message={toastState.m} error={toastState.e} onClose={() => setToastState(null)} />}</AnimatePresence>
    </div>
  );
}