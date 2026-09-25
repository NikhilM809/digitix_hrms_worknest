import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Digitix Labs"
      className={cn("h-8 w-auto max-w-[4.5rem] bg-white object-contain", className)}
    />
  );
}
