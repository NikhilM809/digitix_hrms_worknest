"use client";

import { setActiveTimeZone } from "@/lib/format";

export function TimezoneSync({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  setActiveTimeZone(timeZone);
  return children;
}
