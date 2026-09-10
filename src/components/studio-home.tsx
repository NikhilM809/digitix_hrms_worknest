import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  lilac: "bg-[#EDE4FB] text-[#5B3A8C] dark:bg-[#3D2A55] dark:text-[#E4D4FF]",
  peach: "bg-[#FBE6D4] text-[#8A4B1F] dark:bg-[#4A331F] dark:text-[#F3D2B0]",
  mint: "bg-[#D8F0E4] text-[#1F6B4A] dark:bg-[#1E3D30] dark:text-[#B8E6CF]",
  sky: "bg-[#D9E8F8] text-[#1E4E7A] dark:bg-[#1E3348] dark:text-[#C5DDF3]",
} as const;

export function dayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HighlightStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: keyof typeof tones;
}) {
  return (
    <div className={cn("flex min-h-[132px] flex-col justify-between rounded-3xl p-5", tones[tone])}>
      <Icon className="h-5 w-5 opacity-70" />
      <div>
        <p className="text-sm font-medium opacity-80">{label}</p>
        <p className="mt-1 font-display text-3xl leading-none">{value}</p>
      </div>
    </div>
  );
}
