"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { Button, Input } from "@/components/ui";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="grid gap-5">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="h-11"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Password</span>
        <div className="relative">
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="h-11 pr-11"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
        <Lock className="h-3 w-3 shrink-0" aria-hidden />
        Your information is securely protected
      </p>
      <p className="text-center text-xs">
        <a href="/forgot-password" className="text-muted hover:text-ink hover:underline">
          Forgot password?
        </a>
      </p>
    </form>
  );
}
