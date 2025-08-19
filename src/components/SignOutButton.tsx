"use client";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function SignOutButton() {
  const supabase = useSupabaseClient();
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="text-sm underline"
    >
      Sign out
    </button>
  );
}
