import fs from "fs";
import path from "path";
import { pool } from "../config/db";

async function migrate() {
  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log("Migration applied successfully.");
  await pool.end();
}

migrate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Migration failed:", err);
  process.exit(1);
});
