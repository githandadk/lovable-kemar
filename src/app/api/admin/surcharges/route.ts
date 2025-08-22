// GET /api/admin/surcharges
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
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user?.id)
    .single();
  if (!user || !me || (me.role !== "admin" && me.role !== "staff"))
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const { data, error } = await supabase
    .from("event_department_surcharges")
    .select("event_id, department_code, surcharge, events(name)")
    .order("event_id")
    .order("department_code");
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );

  const rows = (data ?? []).map((r: any) => ({
    event_id: r.event_id,
    event_name: r.events?.name ?? "",
    department_code: r.department_code,
    surcharge: Number(r.surcharge),
  }));
  return NextResponse.json({ ok: true, rows });
}
export async function POST(req: Request) {
  const { event_id, department_code, surcharge } = await req.json();
  if (!event_id || !department_code || surcharge == null)
    return NextResponse.json(
      { ok: false, error: "Missing fields" },
      { status: 400 }
    );

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
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user?.id)
    .single();
  if (!user || !me || (me.role !== "admin" && me.role !== "staff"))
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  // Upsert by (event_id, department_code)
  const { error } = await supabase
    .from("event_department_surcharges")
    .upsert(
      { event_id, department_code, surcharge },
      { onConflict: "event_id,department_code" }
    );

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}
