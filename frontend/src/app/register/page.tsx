"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await register(email, password);
      router.push("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not register");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="font-heading text-xl font-semibold text-ink">Create an account</h1>
        <p className="mt-1 text-sm text-ink-muted">Start building interview prep kits.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="-mt-2 text-xs text-ink-faint">At least 8 characters.</p>
          {formError && (
            <p role="alert" className="text-sm text-coral">
              {formError}
            </p>
          )}
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-amber hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
