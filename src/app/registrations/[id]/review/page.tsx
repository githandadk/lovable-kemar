"use client";

import { useEffect, useState, use } from "react";

type Item = {
  id: string;
  kind: string;
  qty: number;
  unit_price: number;
  amount: number;
  description: string;
};

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const [items, setItems] = useState<Item[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/registrations/${resolvedParams.id}/review`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!json.ok) {
      setMsg(json.error || "Failed to load");
      return;
    }
    setItems(json.items || []);
    setSubtotal(json.subtotal || 0);
    setTotal(json.amount_total || json.subtotal || 0);
  }

  useEffect(() => {
    load();
  }, [resolvedParams.id]);

  async function rebuild() {
    setBusy(true);
    setMsg("");
    await fetch(`/api/registrations/${resolvedParams.id}/pricing/rebuild`, {
      method: "POST",
    });
    await load();
    setBusy(false);
  }

  const groups = items.reduce((acc: any, it) => {
    (acc[it.kind] ??= []).push(it);
    return acc;
  }, {});

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Review & Total</h1>
      <div className="flex gap-3">
        <a
          className="underline"
          href={`/registrations/${resolvedParams.id}/attendees`}
        >
          Attendees
        </a>
        <a
          className="underline"
          href={`/registrations/${resolvedParams.id}/rooms`}
        >
          Rooms
        </a>
        <a
          className="underline"
          href={`/registrations/${resolvedParams.id}/meals`}
        >
          Meals
        </a>
      </div>

      <button
        onClick={rebuild}
        disabled={busy}
        className="rounded border px-4 py-2 hover:bg-gray-50"
      >
        {busy ? "Rebuilding…" : "Rebuild pricing"}
      </button>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {Object.keys(groups).map((kind) => (
        <section key={kind} className="border rounded p-4">
          <h2 className="font-medium mb-2">{label(kind)}</h2>
          <ul className="space-y-2">
            {groups[kind].map((it: Item) => (
              <li key={it.id} className="flex justify-between text-sm">
                <span>{it.description}</span>
                <span>
                  {it.qty} × ${it.unit_price.toFixed(2)} ={" "}
                  <b>${Number(it.amount).toFixed(2)}</b>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="text-right">
        <div className="text-lg">
          Subtotal: <b>${subtotal.toFixed(2)}</b>
        </div>
        {/* Discounts & taxes can be shown here later */}
        <div className="text-xl">
          Total: <b>${total.toFixed(2)}</b>
        </div>
      </div>
    </main>
  );
}

function label(kind: string) {
  switch (kind) {
    case "room_night":
      return "Rooms";
    case "key_deposit":
      return "Key Deposits";
    case "meal":
      return "Meals";
    case "department_surcharge":
      return "Department Surcharges";
    default:
      return kind;
  }
}
