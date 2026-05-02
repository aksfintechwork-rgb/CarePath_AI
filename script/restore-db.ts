/**
 * Restores a plain-SQL backup into the database referenced by DATABASE_URL.
 * Requires: psql on PATH.
 *
 * Usage:
 *   npm run db:restore           → applies ./back.sql
 *   npm run db:restore -- other.sql
 *
 * For an empty Neon DB: prefer full dump (default db:dump). If tables already exist from drizzle push, use a data-only dump when restoring.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const rest = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sqlFile = resolve(process.cwd(), rest[0] || "back.sql");

console.log(`Running psql -f ${sqlFile} ...`);

const result = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error("\npsql failed to start. Install PostgreSQL client tools and ensure psql is on your PATH.\n");
  process.exit(1);
}

process.exit(result.status ?? 0);
