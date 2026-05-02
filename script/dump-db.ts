/**
 * Dumps the PostgreSQL database referenced by DATABASE_URL to back.sql (plain SQL).
 * Requires PostgreSQL client tools: pg_dump on PATH.
 *
 * Usage:
 *   npm run db:dump                 → writes back.sql (schema + data)
 *   npm run db:dump -- --data-only  → data only (use if VPS already ran npm run db:push)
 *
 * Security: back.sql can contain PII and credential hashes. Think twice before committing to Git.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env in the project root.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dataOnly = args.includes("--data-only");
const outArg = args.find((a) => !a.startsWith("--"));
const outFile = resolve(process.cwd(), outArg || "back.sql");

const pgArgs = [url, "-f", outFile, "-F", "p", "--no-owner", "--no-acl"];
if (dataOnly) pgArgs.push("--data-only");

console.log(`Running pg_dump → ${outFile}${dataOnly ? " (data only)" : " (schema + data)"}...`);

const result = spawnSync("pg_dump", pgArgs, { stdio: "inherit", shell: false });

if (result.error) {
  console.error(
    "\npg_dump failed to start. Install PostgreSQL client tools and ensure pg_dump is on your PATH.\n" +
      "Windows: https://www.postgresql.org/download/windows/ (Command Line Tools)\n"
  );
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Done.");
