import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { SKILL_OPTIONS, type Application, type Task } from "../src/types.js";
import { pool } from "./db.js";

type AccountRole = "student" | "company" | "admin";
type SessionUser = {
  id: string;
  email: string;
  role: AccountRole;
  name: string;
  school: string | null;
  location: string | null;
  studyField: string | null;
  track: "earning" | "interview" | null;
};
type AuthRequest = Request & { user?: SessionUser };
type DbTask = {
  id: string; owner_user_id: string | null; company: string; title: string; description: string;
  budget: string | number; payment: "USD" | "EcoCash"; skill: Task["skill"]; level: Task["level"];
  deadline: string; applicants: number; match: number; rating: string | number; verified: boolean;
};
type DbApplication = {
  id: string; task_id: string; student_id: string; student_name: string; student_track: "earning" | "interview";
  student_study_field: Task["skill"]; proposal: string; delivery_days: number; portfolio: string;
  created_at: Date; status: Application["status"]; interview_invited: boolean;
};

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const sessionCookie = "gradlink_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 14;
const skillSchema = z.enum(SKILL_OPTIONS);
const levelSchema = z.enum(["Entry level", "Intermediate", "Professional", "Advanced"]);
const roleSchema = z.enum(["student", "company"]);
const policySchema = z.object({
  studentCompletedTasks: z.number().int().min(1).max(1000),
  companyFilledTasks: z.number().int().min(1).max(1000),
  minimumInterviewInvites: z.number().int().min(1).max(1000)
});

app.disable("x-powered-by");
if (isProduction) app.set("trust proxy", 1);
app.use(express.json({ limit: "8mb", type: "application/json" }));
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." }
});

function fail(status: number, message: string): never {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  throw error;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail(400, result.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "));
  }
  return result.data;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAge?: number) {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(isProduction ? ["Secure"] : []),
    ...(maxAge === undefined ? [] : [`Max-Age=${Math.floor(maxAge / 1000)}`])
  ].join("; ");
}

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

function requireUser(request: AuthRequest): SessionUser {
  if (!request.user) fail(401, "Sign in to continue.");
  return request.user;
}

function requireRole(request: AuthRequest, ...roles: AccountRole[]): SessionUser {
  const user = requireUser(request);
  if (!roles.includes(user.role)) fail(403, "Your account does not have permission to do that.");
  return user;
}

async function authenticate(request: AuthRequest, _response: Response, next: NextFunction) {
  const token = getCookie(request, sessionCookie);
  if (!token) return next();
  const result = await pool.query<{
    id: string; email: string; role: AccountRole; name: string; school: string | null;
    location: string | null; study_field: string | null; track: "earning" | "interview" | null;
  }>(
    `SELECT u.id, u.email, u.role, u.name, u.school, u.location, u.study_field, u.track
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  const row = result.rows[0];
  if (row) {
    request.user = {
      id: row.id, email: row.email, role: row.role, name: row.name, school: row.school,
      location: row.location, studyField: row.study_field, track: row.track
    };
  }
  return next();
}

app.use("/api", authenticate);

async function createSession(userId: string, response: Response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), userId, expiresAt]
  );
  response.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; ${cookieOptions(sessionDurationMs)}`);
}

function safeUser(user: SessionUser) {
  return user;
}

function mapTask(row: DbTask, user?: SessionUser): Task {
  return {
    id: row.id, company: row.company, title: row.title, description: row.description,
    budget: Number(row.budget), payment: row.payment, skill: row.skill, level: row.level,
    deadline: row.deadline, applicants: row.applicants, match: row.match, rating: Number(row.rating),
    verified: row.verified, mine: Boolean(user && row.owner_user_id === user.id)
  };
}

function mapApplication(row: DbApplication): Application {
  return {
    id: row.id, taskId: row.task_id, studentId: row.student_id, studentName: row.student_name,
    studentTrack: row.student_track, studentStudyField: row.student_study_field, proposal: row.proposal,
    deliveryDays: row.delivery_days, portfolio: row.portfolio, createdAt: row.created_at.toISOString(),
    status: row.status, interviewInvited: row.interview_invited
  };
}

const publicTaskSelect = `SELECT id, owner_user_id, company, title, description, budget, payment,
  skill, level, deadline, applicants, match, rating, verified FROM tasks`;
const applicationSelect = `SELECT a.id, a.task_id, a.student_id, u.name AS student_name,
  u.track AS student_track, COALESCE(u.study_field, 'Coding') AS student_study_field,
  a.proposal, a.delivery_days, a.portfolio, a.created_at, a.status, a.interview_invited
  FROM applications a JOIN users u ON u.id = a.student_id`;

app.get("/api/health", async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ status: "ok" });
});

app.get("/api/bootstrap", async (request: AuthRequest, response) => {
  const user = request.user;
  const taskResult = await pool.query<DbTask>(`${publicTaskSelect} ORDER BY created_at DESC, id`);
  let applicationResult;
  if (!user) {
    applicationResult = { rows: [] as DbApplication[] };
  } else if (user.role === "student") {
    applicationResult = await pool.query<DbApplication>(`${applicationSelect} WHERE a.student_id = $1 ORDER BY a.created_at DESC`, [user.id]);
  } else if (user.role === "company") {
    applicationResult = await pool.query<DbApplication>(
      `${applicationSelect} JOIN tasks t ON t.id = a.task_id WHERE t.owner_user_id = $1 ORDER BY a.created_at DESC`,
      [user.id]
    );
  } else {
    applicationResult = await pool.query<DbApplication>(`${applicationSelect} ORDER BY a.created_at DESC`);
  }
  const policyResult = await pool.query<{
    student_completed_tasks: number; company_filled_tasks: number; minimum_interview_invites: number;
  }>("SELECT student_completed_tasks, company_filled_tasks, minimum_interview_invites FROM interview_policy WHERE singleton = TRUE");
  const certificateResult = user?.role === "student"
    ? await pool.query<{ id: string; name: string; content_type: string; size: number; uploaded_at: Date }>(
      "SELECT id, name, content_type, octet_length(content) AS size, created_at AS uploaded_at FROM certificates WHERE student_id = $1 ORDER BY created_at DESC",
      [user.id]
    )
    : { rows: [] };
  const policy = policyResult.rows[0];
  response.json({
    user: user ? safeUser(user) : null,
    tasks: taskResult.rows.map((row) => mapTask(row, user)),
    applications: applicationResult.rows.map(mapApplication),
    policy: policy ? {
      studentCompletedTasks: policy.student_completed_tasks,
      companyFilledTasks: policy.company_filled_tasks,
      minimumInterviewInvites: policy.minimum_interview_invites
    } : { studentCompletedTasks: 10, companyFilledTasks: 10, minimumInterviewInvites: 5 },
    profile: user?.role === "student" ? {
      name: user.name, school: user.school || "", location: user.location || "",
      studyField: user.studyField || "Coding", track: user.track || "earning"
    } : null,
    companyName: user?.role === "company" ? user.name : null,
    certificates: certificateResult.rows.map((row) => ({
      id: row.id, name: row.name, type: row.content_type, size: row.size, uploadedAt: row.uploaded_at.toISOString()
    }))
  });
});

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  role: roleSchema,
  name: z.string().trim().min(2).max(100),
  school: z.string().trim().max(160).optional(),
  location: z.string().trim().max(100).optional(),
  studyField: skillSchema.optional(),
  track: z.enum(["earning", "interview"]).optional()
});

app.post("/api/auth/register", authRateLimit, async (request, response) => {
  const input = parse(registerSchema, request.body);
  if (input.role === "student" && (!input.school || !input.location || !input.studyField || !input.track)) {
    fail(400, "Student registration requires school, location, field of study, and account goal.");
  }
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, name, school, location, study_field, track)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [email, passwordHash, input.role, input.name, input.school || null, input.location || null, input.studyField || null, input.track || null]
    );
    const id = created.rows[0].id;
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + sessionDurationMs);
    await client.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [hashToken(token), id, expiresAt]);
    await client.query("COMMIT");
    response.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; ${cookieOptions(sessionDurationMs)}`);
    response.status(201).json({ user: { id, email, role: input.role, name: input.name, school: input.school || null, location: input.location || null, studyField: input.studyField || null, track: input.track || null } });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") fail(409, "An account with that email already exists.");
    throw error;
  } finally {
    client.release();
  }
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

app.post("/api/auth/login", authRateLimit, async (request, response) => {
  const input = parse(loginSchema, request.body);
  const result = await pool.query<{
    id: string; email: string; password_hash: string; role: AccountRole; name: string;
    school: string | null; location: string | null; study_field: string | null; track: "earning" | "interview" | null;
  }>("SELECT id, email, password_hash, role, name, school, location, study_field, track FROM users WHERE email = $1", [input.email.toLowerCase()]);
  const row = result.rows[0];
  if (!row || !(await bcrypt.compare(input.password, row.password_hash))) fail(401, "Email or password is incorrect.");
  await createSession(row.id, response);
  response.json({ user: { id: row.id, email: row.email, role: row.role, name: row.name, school: row.school, location: row.location, studyField: row.study_field, track: row.track } });
});

app.post("/api/auth/logout", async (request, response) => {
  const token = getCookie(request, sessionCookie);
  if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  response.setHeader("Set-Cookie", `${sessionCookie}=; ${cookieOptions(0)}`);
  response.status(204).end();
});

app.patch("/api/profile", async (request: AuthRequest, response) => {
  const user = requireRole(request, "student");
  const input = parse(z.object({
    name: z.string().trim().min(2).max(100),
    school: z.string().trim().min(2).max(160),
    location: z.string().trim().min(2).max(100),
    studyField: skillSchema,
    track: z.enum(["earning", "interview"])
  }), request.body);
  const result = await pool.query(
    `UPDATE users SET name = $1, school = $2, location = $3, study_field = $4, track = $5
     WHERE id = $6 RETURNING id, email, role, name, school, location, study_field, track`,
    [input.name, input.school, input.location, input.studyField, input.track, user.id]
  );
  const row = result.rows[0];
  request.user = { id: row.id, email: row.email, role: row.role, name: row.name, school: row.school, location: row.location, studyField: row.study_field, track: row.track };
  response.json({ profile: input, user: safeUser(request.user) });
});

const taskInputSchema = z.object({
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(10).max(5000),
  budget: z.number().positive().max(10000000),
  payment: z.enum(["USD", "EcoCash"]),
  skill: skillSchema,
  level: levelSchema,
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    return !Number.isNaN(parsed.valueOf()) && date >= new Date().toISOString().slice(0, 10);
  }, "Deadline must be today or later.")
});

app.post("/api/tasks", async (request: AuthRequest, response) => {
  const user = requireRole(request, "company");
  const input = parse(taskInputSchema, request.body);
  const id = `task-${randomBytes(12).toString("hex")}`;
  const created = await pool.query<DbTask>(
    `INSERT INTO tasks (id, owner_user_id, company, title, description, budget, payment, skill, level, deadline, applicants, match, rating, verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 80, 0, FALSE)
     RETURNING id, owner_user_id, company, title, description, budget, payment, skill, level, deadline, applicants, match, rating, verified`,
    [id, user.id, user.name, input.title, input.description, input.budget, input.payment, input.skill, input.level, input.deadline]
  );
  response.status(201).json({ task: mapTask(created.rows[0], user) });
});

const applicationInputSchema = z.object({
  proposal: z.string().trim().min(20).max(5000),
  deliveryDays: z.number().int().min(1).max(30),
  portfolio: z.string().trim().max(2048).refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Portfolio must use HTTP or HTTPS.")
});

app.post("/api/tasks/:taskId/applications", async (request: AuthRequest, response) => {
  const user = requireRole(request, "student");
  const input = parse(applicationInputSchema, request.body);
  const taskId = z.string().min(1).max(100).parse(request.params.taskId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const taskResult = await client.query<{ id: string; level: Task["level"]; verified: boolean }>(
      "SELECT id, level, verified FROM tasks WHERE id = $1 FOR UPDATE", [taskId]
    );
    const task = taskResult.rows[0];
    if (!task || !task.verified) fail(404, "That task is not currently available.");
    if (user.track === "interview" && !["Professional", "Advanced"].includes(task.level)) {
      fail(400, "Interview-pathway applications require Professional or Advanced work.");
    }
    const inserted = await client.query<{ id: string }>(
      "INSERT INTO applications (task_id, student_id, proposal, delivery_days, portfolio) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [taskId, user.id, input.proposal, input.deliveryDays, input.portfolio]
    );
    await client.query("UPDATE tasks SET applicants = applicants + 1 WHERE id = $1", [taskId]);
    await client.query("COMMIT");
    response.status(201).json({ id: inserted.rows[0].id, taskId, studentId: user.id });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") fail(409, "You have already applied for this task.");
    throw error;
  } finally {
    client.release();
  }
});

const statusSchema = z.object({ status: z.enum(["accepted", "rejected", "completed"]) });

app.patch("/api/applications/:applicationId/status", async (request: AuthRequest, response) => {
  const user = requireRole(request, "company", "admin");
  const applicationId = z.string().uuid().parse(request.params.applicationId);
  const { status } = parse(statusSchema, request.body);
  const current = await pool.query<{ status: Application["status"]; owner_user_id: string | null }>(
    `SELECT a.status, t.owner_user_id FROM applications a JOIN tasks t ON t.id = a.task_id WHERE a.id = $1`,
    [applicationId]
  );
  const row = current.rows[0];
  if (!row || (user.role === "company" && row.owner_user_id !== user.id)) fail(404, "Application not found.");
  const valid = (["accepted", "rejected"].includes(status) && row.status === "applied")
    || (status === "completed" && row.status === "accepted");
  if (!valid) fail(409, "That application status change is not available.");
  const updated = await pool.query(
    "UPDATE applications SET status = $1 WHERE id = $2 AND status = $3 RETURNING id",
    [status, applicationId, row.status]
  );
  if (!updated.rowCount) fail(409, "The application changed while you were reviewing it. Refresh and try again.");
  response.json({ id: applicationId, status });
});

app.post("/api/applications/:applicationId/interview-invitation", async (request: AuthRequest, response) => {
  const user = requireRole(request, "company");
  const applicationId = z.string().uuid().parse(request.params.applicationId);
  const eligibility = await pool.query<{
    task_id: string; skill: string; level: Task["level"]; track: string; student_id: string;
    owner_user_id: string | null; student_count: string; company_count: string;
    student_threshold: number; company_threshold: number;
  }>(
    `SELECT a.task_id, t.skill, t.level, u.track, a.student_id, t.owner_user_id,
      (SELECT COUNT(DISTINCT a2.task_id)::text FROM applications a2
       JOIN tasks t2 ON t2.id = a2.task_id
       WHERE a2.student_id = a.student_id AND a2.status = 'completed' AND t2.skill = t.skill) AS student_count,
      (SELECT COUNT(DISTINCT a3.task_id)::text FROM applications a3
       JOIN tasks t3 ON t3.id = a3.task_id
       WHERE t3.owner_user_id = $2 AND a3.status = 'completed' AND t3.skill = t.skill) AS company_count,
      p.student_completed_tasks AS student_threshold, p.company_filled_tasks AS company_threshold
     FROM applications a
     JOIN tasks t ON t.id = a.task_id
     JOIN users u ON u.id = a.student_id
     CROSS JOIN interview_policy p
     WHERE a.id = $1`,
    [applicationId, user.id]
  );
  const item = eligibility.rows[0];
  if (!item || item.owner_user_id !== user.id) fail(404, "Application not found.");
  if (item.track !== "interview" || !["Professional", "Advanced"].includes(item.level)
    || Number(item.student_count) < item.student_threshold || Number(item.company_count) < item.company_threshold) {
    fail(409, "This applicant has not met the interview eligibility rules.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [item.student_id, item.skill]);
    const invited = await client.query(
      `SELECT 1 FROM applications a JOIN tasks t ON t.id = a.task_id
       WHERE a.student_id = $1 AND a.interview_invited = TRUE AND t.skill = $2 LIMIT 1`,
      [item.student_id, item.skill]
    );
    if (invited.rowCount) fail(409, "An interview invitation has already been sent for this field.");
    const updated = await client.query(
      "UPDATE applications SET interview_invited = TRUE WHERE id = $1 AND interview_invited = FALSE RETURNING id",
      [applicationId]
    );
    if (!updated.rowCount) fail(409, "An interview invitation has already been sent.");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.status(201).json({ id: applicationId, interviewInvited: true });
});

app.patch("/api/admin/policy", async (request: AuthRequest, response) => {
  requireRole(request, "admin");
  const policy = parse(policySchema, request.body);
  await pool.query(
    `UPDATE interview_policy SET student_completed_tasks = $1, company_filled_tasks = $2,
     minimum_interview_invites = $3 WHERE singleton = TRUE`,
    [policy.studentCompletedTasks, policy.companyFilledTasks, policy.minimumInterviewInvites]
  );
  response.json({ policy });
});

app.patch("/api/admin/tasks/:taskId/verification", async (request: AuthRequest, response) => {
  requireRole(request, "admin");
  const taskId = z.string().min(1).max(100).parse(request.params.taskId);
  const { verified } = parse(z.object({ verified: z.boolean() }), request.body);
  const result = await pool.query("UPDATE tasks SET verified = $1 WHERE id = $2 RETURNING id", [verified, taskId]);
  if (!result.rowCount) fail(404, "Task listing not found.");
  response.json({ id: taskId, verified });
});

app.delete("/api/admin/tasks/:taskId", async (request: AuthRequest, response) => {
  requireRole(request, "admin");
  const taskId = z.string().min(1).max(100).parse(request.params.taskId);
  const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [taskId]);
  if (!result.rowCount) fail(404, "Task listing not found.");
  response.status(204).end();
});

const certificateInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  data: z.string().min(1).max(7_000_000)
});

app.post("/api/certificates", async (request: AuthRequest, response) => {
  const user = requireRole(request, "student");
  const input = parse(certificateInputSchema, request.body);
  const content = Buffer.from(input.data, "base64");
  if (!content.length || content.length > 5 * 1024 * 1024 || content.toString("base64") !== input.data) {
    fail(400, "Certificate must be a valid PDF, JPG or PNG up to 5 MB.");
  }
  const hasValidSignature = input.type === "application/pdf"
    ? content.subarray(0, 5).toString("ascii") === "%PDF-"
    : input.type === "image/jpeg"
      ? content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
      : content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!hasValidSignature) fail(400, "The file contents do not match the selected certificate type.");
  const result = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO certificates (student_id, name, content_type, content) VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [user.id, input.name, input.type, content]
  );
  response.status(201).json({
    certificate: {
      id: result.rows[0].id, name: input.name, type: input.type, size: content.length,
      uploadedAt: result.rows[0].created_at.toISOString()
    }
  });
});

app.get("/api/certificates/:certificateId", async (request: AuthRequest, response) => {
  const user = requireRole(request, "student");
  const certificateId = z.string().uuid().parse(request.params.certificateId);
  const result = await pool.query<{ name: string; content_type: string; content: Buffer }>(
    "SELECT name, content_type, content FROM certificates WHERE id = $1 AND student_id = $2",
    [certificateId, user.id]
  );
  const certificate = result.rows[0];
  if (!certificate) fail(404, "Certificate not found.");
  response.setHeader("Content-Type", certificate.content_type);
  response.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(certificate.name)}`);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.send(certificate.content);
});

app.delete("/api/certificates/:certificateId", async (request: AuthRequest, response) => {
  const user = requireRole(request, "student");
  const certificateId = z.string().uuid().parse(request.params.certificateId);
  const result = await pool.query("DELETE FROM certificates WHERE id = $1 AND student_id = $2 RETURNING id", [certificateId, user.id]);
  if (!result.rowCount) fail(404, "Certificate not found.");
  response.status(204).end();
});

app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));

if (isProduction) {
  const { default: path } = await import("node:path");
  const staticRoot = path.resolve("dist");
  app.use(express.static(staticRoot));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(staticRoot, "index.html")));
}

app.use((error: Error & { status?: number; code?: string }, _request: Request, response: Response, _next: NextFunction) => {
  if (error.code === "23505") {
    response.status(409).json({ error: "That record already exists." });
    return;
  }
  const status = error.status || 500;
  if (status >= 500) console.error("API request failed", error);
  response.status(status).json({ error: status >= 500 ? "The request could not be completed." : error.message });
});

const port = Number(process.env.PORT || 3001);
const server = app.listen(port, () => console.log(`GradLink API listening on port ${port}`));

function shutdown() {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
