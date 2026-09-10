import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

for (const file of walk("src/app/api/hr")) {
  const original = readFileSync(file, "utf8");
  const updated = original.replaceAll(".error.errors", ".error.issues");
  if (updated !== original) writeFileSync(file, updated);
}
console.log("updated zod issues");
