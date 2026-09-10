import { CalendarCheck, FolderKanban, Timer, Users } from "lucide-react";
import { BrandLogo } from "@/components/logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { LoginForm } from "./login-form";

const highlights = [
  { icon: Users, label: "People" },
  { icon: FolderKanban, label: "Projects" },
  { icon: Timer, label: "Time" },
  { icon: CalendarCheck, label: "Pay" },
];

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <div className="pointer-events-none absolute -left-24 top-[-8rem] h-80 w-80 rounded-full bg-teal/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] right-[-4rem] h-72 w-72 rounded-full bg-gold/15 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="flex items-center gap-4">
            <BrandLogo className="h-14 w-14" />
            <div>
              <p className="font-display text-4xl leading-tight text-ink">{APP_NAME}</p>
              <p className="mt-1 text-lg text-muted">{APP_TAGLINE}</p>
            </div>
          </div>
          <p className="mt-8 max-w-xl text-sm leading-6 text-muted">
            Hire, manage people, assign work, track time, run projects, and pay your team — all from
            one place.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-paper-card/80 px-4 py-3 text-sm text-ink shadow-[0_1px_0_rgba(27,36,48,0.04)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-white">
                    <Icon size={16} />
                  </span>
                  {item.label}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-line bg-paper-card p-8 shadow-[0_24px_60px_-28px_rgba(21,32,46,0.35)]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandLogo className="h-10 w-10" />
              <div>
                <p className="font-display text-2xl text-ink">{APP_NAME}</p>
                <p className="text-sm text-muted">{APP_TAGLINE}</p>
              </div>
            </div>
            <p className="font-display text-3xl text-ink">Welcome back</p>
            <p className="mt-2 text-sm text-muted">{APP_TAGLINE}</p>
            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted">© 2026 Digitix Labs. All rights reserved.</p>
        </section>
      </div>
    </div>
  );
}
