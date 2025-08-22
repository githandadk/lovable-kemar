"use client";
import { useEffect, useState } from "react";

type Row = {
  event_id: string;
  event_name: string;
  department_code: string;
  surcharge: number;
};

export default function SurchargesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/surcharges");
    const json = await res.json();
    if (!json.ok) {
      setMsg(json.error || "Failed to load");
      return;
    }
    setRows(json.rows || []);
  }

  async function save(
    event_id: string,
    department_code: string,
    surcharge: number
  ) {
    const res = await fetch("/api/admin/surcharges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id, department_code, surcharge }),
    });
    const json = await res.json();
    if (!json.ok) setMsg(json.error || "Save failed");
    else setMsg("Saved");
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Department Surcharges</h1>
      {msg && <p className="text-sm">{msg}</p>}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Event</th>
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-left">Surcharge</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.event_name}</td>
                <td className="p-2">{r.department_code}</td>
                <td className="p-2">
                  <input
                    type="number"
                    defaultValue={r.surcharge}
                    className="border rounded p-1 w-28"
                    onBlur={(e) =>
                      save(
                        r.event_id,
                        r.department_code,
                        Number(e.target.value)
                      )
                    }
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => load()}
                    className="rounded border px-3 py-1 hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-2">No rows.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
