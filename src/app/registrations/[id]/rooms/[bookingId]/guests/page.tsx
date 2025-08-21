"use client";

import { useEffect, useState, use } from "react";

type Eligible = { id: string; full_name: string; department_code: string };
type GuestRow = { id: string; attendee_id: string };

export default function RoomGuestsPage({
  params,
}: {
  params: Promise<{ id: string; bookingId: string }>;
}) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const { id: registrationId, bookingId } = resolvedParams;
  const [capacity, setCapacity] = useState(0);
  const [occupants, setOccupants] = useState(0);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, capacity - occupants);

  async function load() {
    setMsg("");
    const res = await fetch(`/api/room-bookings/${bookingId}/guests/context`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!json.ok) {
      setMsg(json.error || "Failed to load");
      return;
    }
    setCapacity(json.capacity || 0);
    setOccupants(json.occupants || 0);
    setGuests(json.guests || []);
    setEligible(json.eligible || []);
  }

  useEffect(() => {
    load();
  }, [bookingId]);

  async function add(attendee_id: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/room-bookings/${bookingId}/guests/add`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attendee_id }),
    });
    const json = await res.json();
    if (!json.ok) setMsg(json.error || "Add failed");
    await load();
    setBusy(false);
  }

  async function remove(guest_id: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch(
      `/api/room-bookings/${bookingId}/guests/${guest_id}`,
      { method: "DELETE" }
    );
    const json = await res.json();
    if (!json.ok) setMsg(json.error || "Remove failed");
    await load();
    setBusy(false);
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Assign Guests to Room</h1>

      <div className="text-sm">
        Capacity: <b>{capacity}</b> · Occupants: <b>{occupants}</b> · Remaining:{" "}
        <b>{remaining}</b>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <h2 className="font-medium mb-2">Eligible attendees</h2>
          <ul className="space-y-2">
            {eligible.map((a) => (
              <li
                key={a.id}
                className="border rounded p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{a.full_name}</div>
                  <div className="text-sm text-gray-600">
                    {a.department_code}
                  </div>
                </div>
                <button
                  disabled={busy || remaining <= 0}
                  onClick={() => add(a.id)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-60"
                >
                  Add
                </button>
              </li>
            ))}
            {!eligible.length && (
              <li className="text-sm text-gray-600">No eligible attendees.</li>
            )}
          </ul>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-medium mb-2">Current guests</h2>
          <ul className="space-y-2">
            {guests.map((g) => (
              <GuestItem
                key={g.id}
                guest={g}
                onRemove={() => remove(g.id)}
                busy={busy}
              />
            ))}
            {!guests.length && (
              <li className="text-sm text-gray-600">No guests yet.</li>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}

function GuestItem({
  guest,
  onRemove,
  busy,
}: {
  guest: GuestRow;
  onRemove: () => void;
  busy: boolean;
}) {
  // We only have attendee_id; keep it simple — show the id or extend API to include names if desired.
  return (
    <li className="border rounded p-3 flex items-center justify-between">
      <div className="text-sm">Attendee ID: {guest.attendee_id}</div>
      <button
        onClick={onRemove}
        disabled={busy}
        className="rounded border px-3 py-1 hover:bg-gray-50"
      >
        Remove
      </button>
    </li>
  );
}
