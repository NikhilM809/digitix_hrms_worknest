"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not submit the reset request");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <div className="pointer-events-none absolute -left-24 top-[-8rem] h-80 w-80 rounded-full bg-teal/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] right-[-4rem] h-72 w-72 rounded-full bg-gold/15 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <section className="w-full rounded-3xl border border-line bg-paper-card p-8 shadow-[0_24px_60px_-28px_rgba(21,32,46,0.35)]">
          <div className="mb-8 flex items-center gap-3">
            <BrandLogo className="h-10 w-10" />
            <div>
              <p className="font-display text-2xl text-ink">{APP_NAME}</p>
              <p className="text-sm text-muted">{APP_TAGLINE}</p>
            </div>
          </div>

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal/10">
                <ShieldCheck className="h-7 w-7 text-teal" />
              </div>
              <h1 className="font-display text-2xl text-ink">Request sent</h1>
              <p className="text-sm leading-6 text-muted">
                An admin has been notified to reset this account to the default password.
                You will be able to sign in after they complete the reset.
              </p>
              <Link href="/login">
                <Button variant="outline" className="mt-2 h-11 w-full">
                  <ArrowLeft size={16} />
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl text-ink">Forgot password?</h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Enter your work email. An admin will receive a request to reset your
                password to the default.
              </p>
              <form onSubmit={onSubmit} className="mt-8 grid gap-5">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Email</span>
                  <Input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="h-11"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                {error ? (
                  <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
                ) : null}
                <Button type="submit" disabled={pending} className="h-11">
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending request...
                    </>
                  ) : (
                    "Ask admin to reset password"
                  )}
                </Button>
              </form>
              <Link
                href="/login"
                className="mt-6 flex items-center justify-center gap-2 text-sm text-teal hover:underline"
              >
                <ArrowLeft size={16} />
                Back to sign in
              </Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
