"use client";

import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Role = "attendee" | "volunteer" | "presenter";
type Row = {
  id: string;
  full_name: string;
  role: Role;
  event_name: string;
  registration_id: string;
};

const PAGE_SIZE = 10;

export default function AdminAttendeesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/attendees", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load");
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      toast.error(e?.message ?? "Failed to load attendees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setLocalRole(id: string, role: Role) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role } : r)));
  }

  async function saveRole(id: string, role: Role) {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/attendees/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attendee_id: id, role }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Save failed");
      toast.success("Role updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
      // reload to undo optimistic update
      await load();
    } finally {
      setSavingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.event_name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const slice = filtered.slice(
    (pageClamped - 1) * PAGE_SIZE,
    pageClamped * PAGE_SIZE
  );

  return (
    <main className="p-6 space-y-6">
      {/* Sonner toaster — ideally put <Toaster /> once in src/app/layout.tsx, 
          but including here ensures it works immediately */}
      <Toaster richColors position="top-center" />

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Attendees — Set Role</h1>
          <p className="text-sm text-muted-foreground">
            Only admins/staff can view and edit this page. Changes save per row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, event, role…"
            className="w-[260px]"
          />
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Name</TableHead>
                <TableHead className="min-w-[160px]">Event</TableHead>
                <TableHead className="min-w-[160px]">Role</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell className="py-6">
                        <div className="h-4 w-48 bg-muted rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-32 bg-muted rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-9 w-40 bg-muted rounded" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="h-9 w-20 bg-muted rounded ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {!loading && slice.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {error
                      ? error
                      : query
                      ? "No attendees match your search."
                      : "No attendees found."}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                slice.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell>{r.event_name}</TableCell>
                    <TableCell>
                      <Select
                        value={r.role}
                        onValueChange={(val) => setLocalRole(r.id, val as Role)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="attendee">attendee</SelectItem>
                          <SelectItem value="volunteer">volunteer</SelectItem>
                          <SelectItem value="presenter">presenter</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => saveRole(r.id, r.role)}
                        disabled={savingId === r.id}
                      >
                        {savingId === r.id ? "Saving…" : "Save"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium">
                {(pageClamped - 1) * PAGE_SIZE + 1}
              </span>
              –{" "}
              <span className="font-medium">
                {Math.min(pageClamped * PAGE_SIZE, filtered.length)}
              </span>{" "}
              of <span className="font-medium">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageClamped <= 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page <span className="font-medium">{pageClamped}</span> /{" "}
                {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageClamped >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
