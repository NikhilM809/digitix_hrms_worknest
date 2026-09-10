import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";

const hrmsRoot = "D:/work/Digitixlabs/digitixlabs";
const destRoot = "D:/work/Digitixlabs/digitix_flow";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rewrite(content) {
  let next = content;
  next = next.replaceAll("@/lib/prisma", "@hrms/lib/prisma");
  next = next.replaceAll("@/lib/auth", "@hrms/lib/auth");
  next = next.replaceAll('from "next-auth/react"', 'from "@hrms/lib/hrms-session"');
  next = next.replaceAll("from 'next-auth/react'", "from '@hrms/lib/hrms-session'");
  next = next.replaceAll("@prisma/client", "@prisma/hrms-client");
  next = next.replaceAll('"@/', '"@hrms/');
  next = next.replaceAll("'@/", "'@hrms/");

  const routes = [
    "employee-documents",
    "org-hierarchy",
    "work-schedules",
    "my-documents",
    "my-team",
    "settings/roles",
    "notifications",
    "organization",
    "designations",
    "departments",
    "attendance",
    "employees",
    "dashboard",
    "payslips",
    "policies",
    "profile",
    "reports",
    "settings",
    "leave",
    "kra",
  ];
  for (const route of routes) {
    for (const quote of ['"', "'", "`"]) {
      next = next.split(`${quote}/${route}`).join(`${quote}/hr/${route}`);
    }
  }
  next = next.split("/hr/hr/").join("/hr/");
  return next;
}

function copyDir(from, to, skip = []) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (skip.includes(name)) continue;
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyDir(src, dst, skip);
    else cpSync(src, dst);
  }
}

const schema = readFileSync(join(hrmsRoot, "prisma/schema.prisma"), "utf8")
  .replace(
    `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}`,
    `generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/@prisma/hrms-client"
}

datasource db {
  provider = "postgresql"
  url      = env("HRMS_DATABASE_URL")
}`,
  );

mkdirSync(join(destRoot, "prisma-hrms"), { recursive: true });
writeFileSync(join(destRoot, "prisma-hrms/schema.prisma"), schema);

rmSync(join(destRoot, "src/hrms"), { recursive: true, force: true });
copyDir(join(hrmsRoot, "src/lib"), join(destRoot, "src/hrms/lib"), [
  "auth.ts",
  "auth.config.ts",
  "auth-constants.ts",
  "prisma.ts",
]);
copyDir(join(hrmsRoot, "src/components"), join(destRoot, "src/hrms/components"), [
  "layout",
  "providers.tsx",
]);
copyDir(join(hrmsRoot, "src/hooks"), join(destRoot, "src/hrms/hooks"));

const pagesFrom = join(hrmsRoot, "src/app/(dashboard)");
const pagesTo = join(destRoot, "src/app/(app)/hr");
rmSync(pagesTo, { recursive: true, force: true });
copyDir(pagesFrom, pagesTo, ["layout.tsx"]);

const apiFrom = join(hrmsRoot, "src/app/api");
const apiTo = join(destRoot, "src/app/api/hr");
rmSync(apiTo, { recursive: true, force: true });
copyDir(apiFrom, apiTo, ["auth"]);

const rewriteRoots = [
  join(destRoot, "src/hrms"),
  join(destRoot, "src/app/(app)/hr"),
  join(destRoot, "src/app/api/hr"),
];

for (const root of rewriteRoots) {
  for (const file of walk(root)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const original = readFileSync(file, "utf8");
    const updated = rewrite(original);
    if (updated !== original) writeFileSync(file, updated);
  }
}

console.log("Imported HRMS sources into Worknest under /hr and @hrms/*");
console.log("pages", walk(pagesTo).length, "api", walk(apiTo).length, "hrms", walk(join(destRoot, "src/hrms")).length);
