import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

try {
  const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
  console.log("GradLink PostgreSQL schema is up to date.");
} catch (error) {
  console.error("Could not apply the PostgreSQL schema", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
