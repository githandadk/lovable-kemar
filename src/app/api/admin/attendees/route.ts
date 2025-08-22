// GET /api/admin/attendees
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: (n, v, o) => cookieStore.set({ name: n, value: v, ...o }),
        remove: (n, o) =>
          cookieStore.set({ name: n, value: "", ...o, maxAge: 0 }),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "Not signed in" },
      { status: 401 }
    );

  // verify admin/staff
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!me || (me.role !== "admin" && me.role !== "staff"))
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const { data, error } = await supabase
    .from("attendees")
    .select(
      "id, full_name, role, registration_id, registrations(event_id, events(name))"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );

  const rows = (data ?? []).map((a: any) => ({
    id: a.id,
    full_name: a.full_name,
    role: a.role,
    registration_id: a.registration_id,
    event_name: a.registrations?.events?.name ?? "",
  }));
  return NextResponse.json({ ok: true, rows });
}
