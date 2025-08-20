import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
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

  const { data: reg, error: regErr } = await supabase
    .from("registrations")
    .select("id, event_id, created_by")
    .eq("id", id)
    .single();
  if (regErr || !reg)
    return NextResponse.json(
      { ok: false, error: "Registration not found" },
      { status: 404 }
    );
  if (reg.created_by !== user.id)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const [{ data: buildings }, { data: lodging }] = await Promise.all([
    supabase
      .from("campus_buildings")
      .select("id, code, name")
      .eq("event_id", reg.event_id)
      .order("code"),
    supabase
      .from("lodging_options")
      .select("id, name, ac, nightly_rate")
      .eq("event_id", reg.event_id)
      .order("name"),
  ]);

  return NextResponse.json({
    ok: true,
    eventId: reg.event_id,
    buildings: buildings ?? [],
    lodging: lodging ?? [],
  });
}
