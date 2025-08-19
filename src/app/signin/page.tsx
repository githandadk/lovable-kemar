"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMsg(error ? error.message : "Check your email for a sign-in link.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-80 space-y-3">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border px-3 py-2"
        />
        <button className="w-full rounded bg-blue-600 py-2 text-white">
          Send magic link
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </main>
  );
}
