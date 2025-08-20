import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const checkin = url.searchParams.get("checkin");
  const checkout = url.searchParams.get("checkout");
  const buildingId = url.searchParams.get("buildingId");
  const lodgingOptionId = url.searchParams.get("lodgingOptionId");

  if (!eventId || !checkin || !checkout) {
    return NextResponse.json(
      { ok: false, error: "Missing eventId/checkin/checkout" },
      { status: 400 }
    );
  }

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

  // 1) Pull candidate rooms
  let query = supabase
    .from("rooms")
    .select("id, room_number, capacity, building_id, lodging_option_id")
    .eq("event_id", eventId);

  if (buildingId) query = query.eq("building_id", buildingId);
  if (lodgingOptionId) query = query.eq("lodging_option_id", lodgingOptionId);

  const { data: rooms, error: roomErr } = await query;
  if (roomErr)
    return NextResponse.json(
      { ok: false, error: roomErr.message },
      { status: 400 }
    );

  if (!rooms?.length) return NextResponse.json({ ok: true, rooms: [] });

  // 2) Which rooms are booked overlapping [checkin, checkout)
  const { data: bookedRows, error: bookedErr } = await supabase
    .from("room_bookings")
    .select("id")
    .eq("event_id", eventId)
    .lt("checkin_date", checkout) // overlap condition
    .gt("checkout_date", checkin); // overlap condition

  if (bookedErr)
    return NextResponse.json(
      { ok: false, error: bookedErr.message },
      { status: 400 }
    );

  let bookedRoomIds: string[] = [];
  if (bookedRows?.length) {
    const bookingIds = bookedRows.map((b) => b.id);
    const { data: rbr, error: rbrErr } = await supabase
      .from("room_booking_rooms")
      .select("room_id")
      .in("room_booking_id", bookingIds);
    if (rbrErr)
      return NextResponse.json(
        { ok: false, error: rbrErr.message },
        { status: 400 }
      );
    bookedRoomIds = (rbr ?? [])
      .map((x) => x.room_id)
      .filter(Boolean) as string[];
  }

  // 3) Filter available rooms = candidates minus booked
  const available = rooms.filter((r) => !bookedRoomIds.includes(r.id));
  return NextResponse.json({ ok: true, rooms: available });
}
