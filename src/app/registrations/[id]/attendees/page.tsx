"use client";

import { useEffect, useState } from "react";

type Attendee = { id: string; full_name: string; department_code: string };

export default function AttendeesPage({ params }: { params: { id: string } }) {
  const [list, setList] = useState<Attendee[]>([]);
  const [fullName, setFullName] = useState("");
  const [dept, setDept] = useState("EM_Adult");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setMsg("");
    try {
      const res = await fetch(`/api/registrations/${params.id}/attendees`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) setList(json.attendees);
      else setMsg(json.error || "Failed to load attendees");
    } catch (e: any) {
      setMsg(e?.message ?? "Network error");
    }
  }

  // Provide a tiny read route *inline* using route segment config:
  // Create file: src/app/registrations/[id]/attendees/route.ts for GET
  // (See below)
  useEffect(() => {
    load();
  }, []);

  async function add() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/attendees/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          registrationId: params.id,
          full_name: fullName,
          department_code: dept,
        }),
      });
      const json = await res.json();
      if (!json.ok) setMsg(json.error || "Add failed");
      setFullName("");
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Attendees</h1>

      <div className="border rounded p-4 space-y-2">
        <div>
          <label className="block text-sm font-medium">Full name</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Department</label>
          <select
            className="mt-1 w-full border rounded p-2"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            <option>EM_Adult</option>
            <option>EM_YA</option>
            <option>EM_College</option>
            <option>EM_HS</option>
            <option>EM_JR</option>
            <option>EM_Teen</option>
            <option>EM_VBS</option>
            <option>EM_Cradle</option>
          </select>
        </div>
        <button
          onClick={add}
          disabled={busy}
          className="rounded border px-4 py-2 hover:bg-gray-50"
        >
          {busy ? "Adding…" : "Add attendee"}
        </button>
        {msg && <p className="text-red-600 text-sm">{msg}</p>}
      </div>

      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.id} className="border rounded p-3">
            <div className="font-medium">{a.full_name}</div>
            <div className="text-sm text-gray-600">{a.department_code}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
