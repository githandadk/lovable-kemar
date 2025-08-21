import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await ctx.params;
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

  // booking + registration
  const { data: booking, error: bErr } = await supabase
    .from("room_bookings")
    .select("id, registration_id, event_id, lodging_option_id")
    .eq("id", bookingId)
    .single();
  if (bErr || !booking)
    return NextResponse.json(
      { ok: false, error: "Booking not found" },
      { status: 404 }
    );

  const { data: reg, error: rErr } = await supabase
    .from("registrations")
    .select("id, created_by")
    .eq("id", booking.registration_id)
    .single();
  if (rErr || !reg || reg.created_by !== user.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  // capacity from assigned room (if any) else lodging option default
  const { data: link } = await supabase
    .from("room_booking_rooms")
    .select("room_id")
    .eq("room_booking_id", booking.id)
    .maybeSingle();

  let capacity = 0;
  if (link?.room_id) {
    const { data: room } = await supabase
      .from("rooms")
      .select("capacity")
      .eq("id", link.room_id)
      .single();
    capacity = room?.capacity ?? 0;
  } else if (booking.lodging_option_id) {
    const { data: lo } = await supabase
      .from("lodging_options")
      .select("capacity_per_room")
      .eq("id", booking.lodging_option_id)
      .single();
    capacity = lo?.capacity_per_room ?? 0;
  }

  const { data: currentGuests } = await supabase
    .from("room_booking_guests")
    .select("id, attendee_id")
    .eq("room_booking_id", booking.id);

  const currentIds = new Set((currentGuests ?? []).map((g) => g.attendee_id));

  // eligible attendees = from same registration, active tickets, not already assigned
  const { data: attendees } = await supabase
    .from("attendees")
    .select("id, full_name, department_code, ticket_status")
    .eq("registration_id", booking.registration_id)
    .order("created_at");

  const eligible = (attendees ?? []).filter(
    (a) => a.ticket_status === "active" && !currentIds.has(a.id)
  );

  return NextResponse.json({
    ok: true,
    bookingId: booking.id,
    capacity,
    occupants: currentGuests?.length ?? 0,
    guests: currentGuests ?? [],
    eligible,
  });
}
