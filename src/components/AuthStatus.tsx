// src/components/AuthStatus.tsx
"use client";
import { useUser } from "@supabase/auth-helpers-react";
export default function AuthStatus() {
  const user = useUser();
  return (
    <div style={{ fontSize: 12, opacity: 0.7 }}>
      {user ? `Signed in as ${user.email}` : "Not signed in"}
    </div>
  );
}
