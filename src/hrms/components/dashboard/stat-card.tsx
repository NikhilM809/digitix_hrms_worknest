"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@hrms/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient: "blue" | "purple" | "green" | "orange";
  delay?: number;
}

const accents = {
  blue: "bg-navy/10 text-navy dark:bg-white/10 dark:text-white",
  purple: "bg-teal/10 text-teal",
  green: "bg-teal/10 text-teal",
  orange: "bg-gold/15 text-gold",
};

export function StatCard({ title, value, subtitle, icon: Icon, gradient, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl border border-line bg-paper-card p-6 text-ink shadow-[0_1px_0_rgba(27,36,48,0.04)]"
    >
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
          <p className="mt-2 font-display text-3xl text-ink">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
        </div>
        <div className={cn("rounded-xl p-3", accents[gradient])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
