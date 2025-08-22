"use client";

import { useEffect, useMemo, useState, use } from "react";

type Session = {
  id: string;
  meal_date: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  price: string;
};
type Att = { id: string; full_name: string; ticket_status: string };
type Pass = {
  attendee_id: string;
  meal_session_id: string;
  purchased: boolean;
};
type Stay = Record<string, { start: string; end: string }>;

export default function MealsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<Att[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [stay, setStay] = useState<Stay>({});
  const [sel, setSel] = useState<Record<string, Record<string, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(
        `/api/registrations/${resolvedParams.id}/meals/context`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.ok) {
        setMsg(json.error || "Failed to load");
        return;
      }
      setSessions(json.sessions || []);
      setAttendees(json.attendees || []);
      setPasses(json.passes || []);
      setStay(json.stay || {});
    })();
  }, [resolvedParams.id]);

  // Build initial selection: existing passes; if none, default to 3/day within stay window
  useEffect(() => {
    if (!sessions.length || !attendees.length) return;

    const grouped = new Map<string, Pass[]>();
    passes.forEach((p) => {
      const arr = grouped.get(p.attendee_id) ?? [];
      arr.push(p);
      grouped.set(p.attendee_id, arr);
    });

    const next: Record<string, Record<string, boolean>> = {};
    attendees.forEach((a) => {
      const cur: Record<string, boolean> = {};
      const existing = grouped.get(a.id) ?? [];
      if (existing.length) {
        existing.forEach((p) => {
          cur[p.meal_session_id] = !!p.purchased;
        });
      } else {
        // default: 3 meals per full day in stay; arrival/departure partials unchecked by default
        const window = stay[a.id];
        sessions.forEach((s) => {
          let on = false;
          if (window) {
            const day = s.meal_date;
            // full days = between (start+1) and (end-1); arrival/departure left false by default
            if (day > window.start && day < window.end) on = true;
          }
          cur[s.id] = on;
        });
      }
      next[a.id] = cur;
    });
    setSel(next);
  }, [sessions, attendees, passes, stay]);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/registrations/${resolvedParams.id}/meals/save`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ selections: sel }),
        }
      );
      const json = await res.json();
      if (!json.ok) setMsg(json.error || "Save failed");
      else setMsg("Saved!");
    } catch (e: any) {
      setMsg(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Meals</h1>
      <p className="text-sm text-gray-600">
        Defaults to 3 meals/day for full days of stay. You can select
        arrival/departure partials as needed.
      </p>

      {msg && <p className="text-sm">{msg}</p>}

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Attendee</th>
              {sessions.map((s) => (
                <th key={s.id} className="p-2 text-center whitespace-nowrap">
                  {s.meal_date}{" "}
                  <div className="text-[11px] text-gray-600">{s.meal_type}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attendees.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2 font-medium">{a.full_name}</td>
                {sessions.map((s) => (
                  <td key={s.id} className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!sel[a.id]?.[s.id]}
                      onChange={(e) => {
                        setSel((prev) => ({
                          ...prev,
                          [a.id]: {
                            ...(prev[a.id] || {}),
                            [s.id]: e.target.checked,
                          },
                        }));
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="rounded border px-4 py-2 hover:bg-gray-50"
      >
        {busy ? "Saving…" : "Save meals"}
      </button>
    </main>
  );
}
