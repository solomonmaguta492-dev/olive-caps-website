import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE || join(here, "data", "db.json");
const SEED_FILE = join(here, "data", "seed.json");

// Simple JSON file database. Swap for MongoDB/PostgreSQL as the shop grows.
function ensureDb() {
  if (!existsSync(DB_FILE)) {
    mkdirSync(dirname(DB_FILE), { recursive: true });
    copyFileSync(SEED_FILE, DB_FILE);
  }
}

export function readDb() {
  ensureDb();
  return JSON.parse(readFileSync(DB_FILE, "utf8"));
}

export function writeDb(data) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Read, change and save in one step.
export function updateDb(change) {
  const data = readDb();
  const result = change(data);
  writeDb(data);
  return result;
}
