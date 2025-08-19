"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    (async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 1) Try the code-in-query flow (?code=...)
      const code = search.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // clean query from URL
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
        if (!error) {
          router.replace("/account/profile");
          return;
        }
        // if exchange failed, fall through to hash parsing as a safety net
        console.error("exchangeCodeForSession error:", error?.message);
      }

      // 2) Try the hash-based flow (#access_token=...&refresh_token=...)
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        // clean hash from URL
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
        if (!error) {
          router.replace("/account/profile");
          return;
        }
        console.error("setSession error:", error?.message);
      }

      // 3) Fallback: if nothing above worked, see if a session already exists
      await supabase.auth.getSession();
      router.replace("/account/profile");
    })();
  }, [router, search]);

  return <main style={{ padding: 24 }}>Signing you in…</main>;
}
