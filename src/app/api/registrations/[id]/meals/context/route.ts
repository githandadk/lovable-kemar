import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: registrationId } = await ctx.params;

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

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, event_id, created_by")
    .eq("id", registrationId)
    .single();
  if (!reg || reg.created_by !== user.id)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  // Event meal sessions
  const { data: sessions } = await supabase
    .from("meal_sessions")
    .select("id, meal_date, meal_type, price")
    .eq("event_id", reg.event_id)
    .order("meal_date, meal_type");

  // Attendees
  const { data: attendees } = await supabase
    .from("attendees")
    .select("id, full_name, ticket_status")
    .eq("registration_id", registrationId)
    .order("created_at");

  // Current passes
  const { data: passes } = await supabase
    .from("attendee_meal_passes")
    .select("attendee_id, meal_session_id, purchased");

  // Infer stay windows per attendee from room bookings they’re assigned to
  const { data: rbg } = await supabase
    .from("room_booking_guests")
    .select("attendee_id, room_booking_id")
    .in(
      "attendee_id",
      (attendees ?? []).map((a) => a.id)
    );

  const bookingIds = [...new Set((rbg ?? []).map((r) => r.room_booking_id))];
  const { data: bookings } = bookingIds.length
    ? await supabase
        .from("room_bookings")
        .select("id, checkin_date, checkout_date")
        .in("id", bookingIds)
    : { data: [] as any[] };

  const byBooking = new Map(bookings?.map((b) => [b.id, b]) as any);

  // Build stay window per attendee (min checkin .. max checkout)
  const stay: Record<string, { start: string; end: string }> = {};
  (rbg ?? []).forEach((row) => {
    const b = byBooking.get(row.room_booking_id);
    if (!b) return;
    const cur = stay[row.attendee_id];
    if (!cur)
      stay[row.attendee_id] = { start: b.checkin_date, end: b.checkout_date };
    else {
      if (b.checkin_date < cur.start) cur.start = b.checkin_date;
      if (b.checkout_date > cur.end) cur.end = b.checkout_date;
    }
  });

  return NextResponse.json({
    ok: true,
    sessions: sessions ?? [],
    attendees: attendees ?? [],
    passes: passes ?? [],
    stay,
  });
}
