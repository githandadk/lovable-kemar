import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await ctx.params;
  const { attendee_id } = await req.json();
  if (!attendee_id)
    return NextResponse.json(
      { ok: false, error: "Missing attendee_id" },
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
  if (!user)
    return NextResponse.json(
      { ok: false, error: "Not signed in" },
      { status: 401 }
    );

  // Verify booking + ownership
  const { data: booking } = await supabase
    .from("room_bookings")
    .select("id, registration_id, event_id, lodging_option_id")
    .eq("id", bookingId)
    .single();

  const { data: reg } = await supabase
    .from("registrations")
    .select("created_by")
    .eq("id", booking?.registration_id)
    .single();
  if (!booking || !reg || reg.created_by !== user.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  // Capacity calc (same as in context)
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

  const { count: currentCount } = await supabase
    .from("room_booking_guests")
    .select("*", { count: "exact", head: true })
    .eq("room_booking_id", booking.id);

  if ((currentCount ?? 0) >= capacity) {
    return NextResponse.json(
      { ok: false, error: "Room is at capacity" },
      { status: 400 }
    );
  }

  // Ensure attendee belongs to same registration and is active
  const { data: att } = await supabase
    .from("attendees")
    .select("id, registration_id, ticket_status")
    .eq("id", attendee_id)
    .single();

  if (
    !att ||
    att.registration_id !== booking.registration_id ||
    att.ticket_status !== "active"
  ) {
    return NextResponse.json(
      { ok: false, error: "Attendee not eligible" },
      { status: 400 }
    );
  }

  const { error: insErr } = await supabase
    .from("room_booking_guests")
    .insert({ room_booking_id: booking.id, attendee_id });

  if (insErr)
    return NextResponse.json(
      { ok: false, error: insErr.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}
