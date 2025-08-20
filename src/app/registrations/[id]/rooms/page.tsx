"use client";

import { useEffect, useState, use } from "react";

type Ctx = {
  ok: boolean;
  eventId?: string;
  buildings?: { id: string; code: string; name: string }[];
  lodging?: { id: string; name: string; ac: boolean; nightly_rate: string }[];
  error?: string;
};

type Room = {
  id: string;
  room_number: string;
  capacity: number;
  building_id: string | null;
  lodging_option_id: string;
};

export default function RoomsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const regId = resolvedParams.id;
  const [ctx, setCtx] = useState<Ctx>({ ok: false });
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [lodgingId, setLodgingId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [keys, setKeys] = useState(1);
  const [keyDeposit, setKeyDeposit] = useState(20);

  useEffect(() => {
    (async () => {
      setMsg("");
      const res = await fetch(`/api/registrations/${regId}/rooms/context`, {
        cache: "no-store",
      });
      const json = await res.json();
      setCtx(json);
    })();
  }, [regId]);

  async function search() {
    if (!ctx.ok || !ctx.eventId) return;
    if (!checkin || !checkout) {
      setMsg("Select check-in and check-out dates");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const q = new URLSearchParams({
        eventId: ctx.eventId,
        checkin,
        checkout,
        ...(buildingId ? { buildingId } : {}),
        ...(lodgingId ? { lodgingOptionId: lodgingId } : {}),
      });
      const res = await fetch(`/api/rooms/availability?${q.toString()}`);
      const json = await res.json();
      if (!json.ok) setMsg(json.error || "Failed to load availability");
      else setRooms(json.rooms);
    } catch (e: any) {
      setMsg(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function book(roomId: string) {
    if (!ctx.ok || !ctx.eventId) return;
    if (!checkin || !checkout) {
      setMsg("Select dates first");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const createRes = await fetch("/api/room-bookings/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          registrationId: regId,
          lodging_option_id: lodgingId || null,
          checkin_date: checkin,
          checkout_date: checkout,
          num_keys: keys,
          key_deposit_per_key: keyDeposit,
        }),
      });
      const created = await createRes.json();
      if (!created.ok) {
        setMsg(created.error || "Create booking failed");
        setBusy(false);
        return;
      }

      const assignRes = await fetch("/api/room-bookings/assign-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room_booking_id: created.roomBookingId,
          room_id: roomId,
        }),
      });
      const assigned = await assignRes.json();
      if (!assigned.ok) {
        setMsg(assigned.error || "Assign room failed");
      } else setMsg("Room booked!");
    } catch (e: any) {
      setMsg(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Room Booking</h1>

      {!ctx.ok ? (
        <p className="text-sm text-red-600">{ctx.error || "Loading…"}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border rounded p-4 space-y-2">
              <label className="block text-sm">Check-in</label>
              <input
                type="date"
                className="w-full border rounded p-2"
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
              />
              <label className="block text-sm">Check-out</label>
              <input
                type="date"
                className="w-full border rounded p-2"
                value={checkout}
                onChange={(e) => setCheckout(e.target.value)}
              />

              <label className="block text-sm mt-2">Building (optional)</label>
              <select
                className="w-full border rounded p-2"
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
              >
                <option value="">Any</option>
                {ctx.buildings?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>

              <label className="block text-sm mt-2">Room type (optional)</label>
              <select
                className="w-full border rounded p-2"
                value={lodgingId}
                onChange={(e) => setLodgingId(e.target.value)}
              >
                <option value="">Any</option>
                {ctx.lodging?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-sm"># Keys (0–2)</label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    className="w-full border rounded p-2"
                    value={keys}
                    onChange={(e) =>
                      setKeys(parseInt(e.target.value || "0", 10))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm">Deposit per key</label>
                  <input
                    type="number"
                    className="w-full border rounded p-2"
                    value={keyDeposit}
                    onChange={(e) =>
                      setKeyDeposit(parseFloat(e.target.value || "0"))
                    }
                  />
                </div>
              </div>

              <button
                onClick={search}
                disabled={busy}
                className="mt-3 rounded border px-4 py-2 hover:bg-gray-50"
              >
                {busy ? "Searching…" : "Search availability"}
              </button>
              {msg && <p className="text-sm mt-2">{msg}</p>}
            </div>

            <div className="border rounded p-4">
              <h2 className="font-medium mb-2">Available rooms</h2>
              <ul className="space-y-2">
                {rooms.map((r) => (
                  <li
                    key={r.id}
                    className="border rounded p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{r.room_number}</div>
                      <div className="text-sm text-gray-600">
                        Capacity {r.capacity}
                      </div>
                    </div>
                    <button
                      onClick={() => book(r.id)}
                      disabled={busy}
                      className="rounded border px-3 py-1 hover:bg-gray-50"
                    >
                      {busy ? "Booking…" : "Book"}
                    </button>
                  </li>
                ))}
                {!rooms.length && (
                  <li className="text-sm text-gray-600">
                    No results yet — search above.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
