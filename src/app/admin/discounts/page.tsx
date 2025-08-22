"use client";

import { useEffect, useState } from "react";

type EventRow = { id: string; name: string };
type Disc = {
  id?: string;
  event_id: string;
  label: string;
  scope: "room" | "meal" | "all";
  kind: "percent" | "fixed" | "comp";
  value: number;
  starts_at?: string | null;
  ends_at?: string | null;
  requires_role?: "volunteer" | "presenter" | "" | null;
  min_attendees?: number | null;
  max_amount?: number | null;
  is_stackable?: boolean;
  code?: string | null;
  priority?: number | null;
};

export default function AdminDiscountsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [rows, setRows] = useState<Disc[]>([]);
  const [msg, setMsg] = useState("");
  const emptyNew: Disc = {
    event_id: "",
    label: "",
    scope: "all",
    kind: "percent",
    value: 10,
    is_stackable: true,
  };
  const [draft, setDraft] = useState<Disc>(emptyNew);

  useEffect(() => {
    (async () => {
      const ev = await fetch("/api/admin/discounts/events", {
        cache: "no-store",
      }).then((r) => r.json());
      if (ev.ok) {
        setEvents(ev.events || []);
        if (ev.events?.length) setEventId(ev.events[0].id);
      } else setMsg(ev.error || "Failed to load events");
    })();
  }, []);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const d = await fetch(`/api/admin/discounts?eventId=${eventId}`, {
        cache: "no-store",
      }).then((r) => r.json());
      if (d.ok) setRows(d.discounts || []);
      else setMsg(d.error || "Failed to load discounts");
      setDraft({ ...emptyNew, event_id: eventId });
    })();
    // eslint-disable-next-line
  }, [eventId]);

  async function save(row: Disc) {
    const res = await fetch("/api/admin/discounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
    });
    const json = await res.json();
    if (!json.ok) setMsg(json.error || "Save failed");
    else setMsg("Saved");
    await reload();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/discounts?id=${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!json.ok) setMsg(json.error || "Delete failed");
    else setMsg("Deleted");
    await reload();
  }

  async function reload() {
    const d = await fetch(`/api/admin/discounts?eventId=${eventId}`).then((r) =>
      r.json()
    );
    if (d.ok) setRows(d.discounts || []);
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Event Discounts</h1>
      {msg && <p className="text-sm">{msg}</p>}

      <div className="flex gap-2 items-center">
        <label>Event</label>
        <select
          className="border rounded p-1"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {/* New discount */}
      <section className="border rounded p-4 space-y-2">
        <h2 className="font-medium">Add discount</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <input
            className="border rounded p-2"
            placeholder="Label"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          />
          <select
            className="border rounded p-2"
            value={draft.scope}
            onChange={(e) =>
              setDraft((d) => ({ ...d, scope: e.target.value as any }))
            }
          >
            <option value="room">room</option>
            <option value="meal">meal</option>
            <option value="all">all</option>
          </select>
          <select
            className="border rounded p-2"
            value={draft.kind}
            onChange={(e) =>
              setDraft((d) => ({ ...d, kind: e.target.value as any }))
            }
          >
            <option value="percent">percent</option>
            <option value="fixed">fixed</option>
            <option value="comp">comp</option>
          </select>
          <input
            type="number"
            className="border rounded p-2"
            placeholder="Value"
            value={draft.value}
            onChange={(e) =>
              setDraft((d) => ({ ...d, value: Number(e.target.value || 0) }))
            }
          />
          <input
            className="border rounded p-2"
            placeholder="Starts at (YYYY-MM-DD)"
            value={draft.starts_at ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, starts_at: e.target.value || null }))
            }
          />
          <input
            className="border rounded p-2"
            placeholder="Ends at (YYYY-MM-DD)"
            value={draft.ends_at ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, ends_at: e.target.value || null }))
            }
          />
          <select
            className="border rounded p-2"
            value={draft.requires_role ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                requires_role: (e.target.value as any) || null,
              }))
            }
          >
            <option value="">requires_role (optional)</option>
            <option value="volunteer">volunteer</option>
            <option value="presenter">presenter</option>
          </select>
          <input
            type="number"
            className="border rounded p-2"
            placeholder="min_attendees"
            value={draft.min_attendees ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                min_attendees: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
          <input
            type="number"
            className="border rounded p-2"
            placeholder="max_amount"
            value={draft.max_amount ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                max_amount: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
          <input
            className="border rounded p-2"
            placeholder="code (optional)"
            value={draft.code ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, code: e.target.value || null }))
            }
          />
          <input
            type="number"
            className="border rounded p-2"
            placeholder="priority (optional)"
            value={draft.priority ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                priority: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!draft.is_stackable}
              onChange={(e) =>
                setDraft((d) => ({ ...d, is_stackable: e.target.checked }))
              }
            />
            Stackable
          </label>
        </div>
        <button
          className="rounded border px-3 py-1 hover:bg-gray-50"
          onClick={() => eventId && save({ ...draft, event_id: eventId })}
          disabled={!eventId || !draft.label}
        >
          Add
        </button>
      </section>

      {/* Existing */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Label</th>
              <th className="p-2">Scope</th>
              <th className="p-2">Kind</th>
              <th className="p-2">Value</th>
              <th className="p-2">Role</th>
              <th className="p-2">Min Att.</th>
              <th className="p-2">Max $</th>
              <th className="p-2">Start</th>
              <th className="p-2">End</th>
              <th className="p-2">Stack</th>
              <th className="p-2">Code</th>
              <th className="p-2">Pri</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i} className="border-t">
                <td className="p-1">
                  <input
                    className="border rounded p-1"
                    defaultValue={r.label}
                    onBlur={(e) => save({ ...r, label: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <select
                    defaultValue={r.scope}
                    onChange={(e) =>
                      save({ ...r, scope: e.target.value as any })
                    }
                  >
                    <option value="room">room</option>
                    <option value="meal">meal</option>
                    <option value="all">all</option>
                  </select>
                </td>
                <td className="p-1">
                  <select
                    defaultValue={r.kind}
                    onChange={(e) =>
                      save({ ...r, kind: e.target.value as any })
                    }
                  >
                    <option value="percent">percent</option>
                    <option value="fixed">fixed</option>
                    <option value="comp">comp</option>
                  </select>
                </td>
                <td className="p-1 w-24">
                  <input
                    type="number"
                    className="border rounded p-1 w-full"
                    defaultValue={r.value}
                    onBlur={(e) =>
                      save({ ...r, value: Number(e.target.value || 0) })
                    }
                  />
                </td>
                <td className="p-1">
                  <select
                    defaultValue={r.requires_role ?? ""}
                    onChange={(e) =>
                      save({
                        ...r,
                        requires_role: (e.target.value as any) || null,
                      })
                    }
                  >
                    <option value="">(none)</option>
                    <option value="volunteer">volunteer</option>
                    <option value="presenter">presenter</option>
                  </select>
                </td>
                <td className="p-1 w-20">
                  <input
                    type="number"
                    className="border rounded p-1 w-full"
                    defaultValue={r.min_attendees ?? ""}
                    onBlur={(e) =>
                      save({
                        ...r,
                        min_attendees: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </td>
                <td className="p-1 w-24">
                  <input
                    type="number"
                    className="border rounded p-1 w-full"
                    defaultValue={r.max_amount ?? ""}
                    onBlur={(e) =>
                      save({
                        ...r,
                        max_amount: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    className="border rounded p-1 w-32"
                    defaultValue={r.starts_at ?? ""}
                    onBlur={(e) =>
                      save({ ...r, starts_at: e.target.value || null })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    className="border rounded p-1 w-32"
                    defaultValue={r.ends_at ?? ""}
                    onBlur={(e) =>
                      save({ ...r, ends_at: e.target.value || null })
                    }
                  />
                </td>
                <td className="p-1 text-center">
                  <input
                    type="checkbox"
                    defaultChecked={!!r.is_stackable}
                    onChange={(e) =>
                      save({ ...r, is_stackable: e.target.checked })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    className="border rounded p-1 w-28"
                    defaultValue={r.code ?? ""}
                    onBlur={(e) => save({ ...r, code: e.target.value || null })}
                  />
                </td>
                <td className="p-1 w-16">
                  <input
                    type="number"
                    className="border rounded p-1 w-full"
                    defaultValue={r.priority ?? ""}
                    onBlur={(e) =>
                      save({
                        ...r,
                        priority: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </td>
                <td className="p-1 text-right">
                  {r.id && (
                    <button
                      onClick={() => remove(r.id!)}
                      className="rounded border px-3 py-1 hover:bg-gray-50"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-2">No discounts.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
