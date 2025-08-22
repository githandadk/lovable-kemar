"use client";

import { useEffect, useState } from "react";

type Row = {
  event_id: string;
  event_name: string;
  currency: string;
  default_meals_per_day: number;
  room_key_deposit: number;
  notes: string; // JSON as string for simplicity
};

export default function AdminSettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) {
      setMsg(json.error || "Failed to load");
      return;
    }
    setRows(json.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(idx: number, patch: Partial<Row>) {
    const row = { ...rows[idx], ...patch };
    const body = {
      event_id: row.event_id,
      currency: row.currency,
      default_meals_per_day: Number(row.default_meals_per_day || 0),
      room_key_deposit: Number(row.room_key_deposit || 0),
      notes: row.notes,
    };
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) setMsg(json.error || "Save failed");
    else setMsg("Saved");
    await load();
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Event Settings</h1>
      {msg && <p className="text-sm">{msg}</p>}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Event</th>
              <th className="p-2 text-left">Currency</th>
              <th className="p-2 text-left">Default meals/day</th>
              <th className="p-2 text-left">Key deposit</th>
              <th className="p-2 text-left">Notes (JSON)</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.event_id} className="border-t">
                <td className="p-2">{r.event_name}</td>
                <td className="p-2">
                  <input
                    className="border rounded p-1 w-24"
                    value={r.currency}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, ix) =>
                          ix === i ? { ...x, currency: e.target.value } : x
                        )
                      )
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    className="border rounded p-1 w-28"
                    value={r.default_meals_per_day}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, ix) =>
                          ix === i
                            ? {
                                ...x,
                                default_meals_per_day: Number(
                                  e.target.value || 0
                                ),
                              }
                            : x
                        )
                      )
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    className="border rounded p-1 w-28"
                    value={r.room_key_deposit}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, ix) =>
                          ix === i
                            ? {
                                ...x,
                                room_key_deposit: Number(e.target.value || 0),
                              }
                            : x
                        )
                      )
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    className="border rounded p-1 w-80"
                    value={r.notes}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, ix) =>
                          ix === i ? { ...x, notes: e.target.value } : x
                        )
                      )
                    }
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => save(i, {})}
                    className="rounded border px-3 py-1 hover:bg-gray-50"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-2">No events found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
