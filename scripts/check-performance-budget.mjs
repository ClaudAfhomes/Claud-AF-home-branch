import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
const limits = { ".js": 350_000, ".css": 120_000, ".png": 500_000, ".jpg": 500_000, ".jpeg": 500_000, ".webp": 500_000 };
const failures = [];
async function walk(directory) { for (const name of await readdir(directory)) { const path = join(directory, name); const details = await stat(path); if (details.isDirectory()) await walk(path); else { const extension = Object.keys(limits).find((item) => name.endsWith(item)); if (extension && details.size > limits[extension]) failures.push(`${path}: ${details.size} bytes exceeds ${limits[extension]}`); } } }
await walk("dist");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Performance budgets passed.");
