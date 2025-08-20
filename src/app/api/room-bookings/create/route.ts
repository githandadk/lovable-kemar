import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
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

  const body = await req.json();
  const {
    registrationId,
    lodging_option_id,
    checkin_date,
    checkout_date,
    num_keys,
    key_deposit_per_key,
  } = body;
  if (!registrationId || !checkin_date || !checkout_date) {
    return NextResponse.json(
      { ok: false, error: "Missing fields" },
      { status: 400 }
    );
  }

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
    .eq("id", registrationId)
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

  const { data: booking, error: insErr } = await supabase
    .from("room_bookings")
    .insert({
      registration_id: reg.id,
      event_id: reg.event_id,
      lodging_option_id: lodging_option_id || null,
      checkin_date,
      checkout_date,
      num_keys: Math.max(0, Math.min(2, Number(num_keys ?? 1))),
      key_deposit_per_key: Number(key_deposit_per_key ?? 0),
    })
    .select("id")
    .single();

  if (insErr || !booking) {
    return NextResponse.json(
      { ok: false, error: insErr?.message ?? "Create failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, roomBookingId: booking.id });
}
