"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StartRegistrationPage({
  params,
}: {
  params: { slug: string };
}) {
  // This is a Client Component, so params is synchronous here.
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function start() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/registrations/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventSlug: params.slug }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMsg(json.error || "Could not start registration");
        setBusy(false);
        return;
      }
      router.replace(`/registrations/${json.registrationId}/attendees`);
    } catch (e: any) {
      setMsg(e?.message ?? "Network error");
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Start registration</h1>
      <p>
        We’ll create a draft registration for you. You can add attendees next.
      </p>
      <button
        onClick={start}
        disabled={busy}
        className="rounded border px-4 py-2 hover:bg-gray-50"
      >
        {busy ? "Starting…" : "Start"}
      </button>
      {msg && <p className="text-red-600 text-sm">{msg}</p>}
    </main>
  );
}
