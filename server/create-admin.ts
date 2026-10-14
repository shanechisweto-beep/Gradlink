import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "./db.js";

const email = z.string().email().max(254).parse(process.env.ADMIN_EMAIL);
const password = z.string().min(12).max(128).parse(process.env.ADMIN_PASSWORD);
const name = z.string().trim().min(2).max(100).parse(process.env.ADMIN_NAME || "GradLink Administrator");

try {
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, 'admin', $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', name = EXCLUDED.name`,
    [email.toLowerCase(), passwordHash, name]
  );
  console.log(`Admin account provisioned for ${email.toLowerCase()}.`);
} catch (error) {
  console.error("Could not provision the admin account", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
