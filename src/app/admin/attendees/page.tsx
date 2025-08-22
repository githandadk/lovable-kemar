"use client";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  full_name: string;
  role: "attendee" | "volunteer" | "presenter";
  event_name: string;
  registration_id: string;
};
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AttendeesTable({ attendees }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attendees.map((a: any) => (
          <TableRow key={a.id}>
            <TableCell>{a.name}</TableCell>
            <TableCell>{a.email}</TableCell>
            <TableCell>{a.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AdminAttendees() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const res = await fetch("/api/admin/attendees");
    const json = await res.json();
    if (!json.ok) {
      setMsg(json.error || "Failed to load");
      return;
    }
    setRows(json.rows || []);
  }

  async function setRole(id: string, role: Row["role"]) {
    setMsg("");
    await fetch("/api/admin/attendees/role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attendee_id: id, role }),
    });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Attendees — Set Role</h1>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Event</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.full_name}</td>
                <td className="p-2">{r.event_name}</td>
                <td className="p-2">
                  <select
                    value={r.role}
                    onChange={(e) => setRole(r.id, e.target.value as any)}
                    className="border rounded p-1"
                  >
                    <option value="attendee">attendee</option>
                    <option value="volunteer">volunteer</option>
                    <option value="presenter">presenter</option>
                  </select>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => setRole(r.id, r.role)}
                    className="rounded border px-3 py-1 hover:bg-gray-50"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-2">No attendees.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
