"use client";

import { useEffect, useState, use } from "react";
import { set } from "zod";

type Attendee = { id: string; full_name: string; department_code: string };
type Dept = { department_code: string; surcharge: number };

export default function AttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const [list, setList] = useState<Attendee[]>([]);
  const [fullName, setFullName] = useState("");
  const [dept, setDept] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAttendees() {
    setMsg("");
    try {
      const res = await fetch(
        `/api/registrations/${resolvedParams.id}/attendees`,
        {
          cache: "no-store",
        }
      );
      const json = await res.json();
      if (json.ok) setList(json.attendees);
      else setMsg(json.error || "Failed to load attendees");
    } catch (e: any) {
      setMsg(e?.message ?? "Network error");
    }
  }

  async function loadDepartments() {
    const res = await fetch(
      `/api/registrations/${resolvedParams.id}/departments`,
      {
        cache: "no-store",
      }
    );
    const json = await res.json();
    if (json.ok) {
      setDepartments(json.departments);
      if (!dept && json.departments.length)
        setDept(json.departments[0].department_code);
    }
  }

  useEffect(() => {
    loadAttendees();
    loadDepartments(); /* eslint-disable-next-line */
  }, []);

  // Provide a tiny read route *inline* using route segment config:
  // Create file: src/app/registrations/[id]/attendees/route.ts for GET
  // (See below)

  async function add() {
    console.log("Starting add function...");
    console.log("Params:", {
      registrationId: resolvedParams.id,
      full_name: fullName,
      department_code: dept,
    });

    if (!dept) {
      setMsg("Please choose a department");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/attendees/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          registrationId: resolvedParams.id,
          full_name: fullName,
          department_code: dept,
        }),
      });
      console.log("Response status:", res.status);
      console.log("Response ok:", res.ok);

      const json = await res.json();

      console.log("Response JSON:", json);

      if (json.ok) {
        console.log("Success! Clearing form and reloading");
        setFullName("");
        await loadAttendees();
      } else {
        console.log("API returned Error:", json.error);
        setMsg(json.error || "Add failed");
      }
    } catch (e: any) {
      console.log("Caught error:", e);
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
            {departments.map((d) => (
              <option key={d.department_code} value={d.department_code}>
                {d.department_code}
              </option>
            ))}
          </select>
          {!departments.length && (
            <p className="text-xs text-gray-600">
              No departments configured for this event. Ask an admin to add
              surcharges.
            </p>
          )}
        </div>

        <button
          onClick={add}
          disabled={busy || !departments.length}
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
