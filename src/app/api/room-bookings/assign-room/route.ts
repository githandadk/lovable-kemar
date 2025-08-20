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
          cookieStore
            .set({ name, value: "", ...o, maxAge: 0 })
            .replace({ name: "", value: "" }), // (ignore)
      } as any, // quick fix for TS; cookieStore.set form is correct above
    }
  );

  const body = await req.json();
  const { room_booking_id, room_id } = body;
  if (!room_booking_id || !room_id) {
    return NextResponse.json(
      { ok: false, error: "Missing fields" },
      { status: 400 }
    );
  }

  // Verify booking & ownership via registration
  const { data: booking, error: bErr } = await supabase
    .from("room_bookings")
    .select("id, registration_id, event_id")
    .eq("id", room_booking_id)
    .single();
  if (bErr || !booking)
    return NextResponse.json(
      { ok: false, error: "Booking not found" },
      { status: 404 }
    );

  const { data: reg } = await supabase
    .from("registrations")
    .select("created_by")
    .eq("id", booking.registration_id)
    .single();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || reg?.created_by !== user.id)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  // Check room belongs to same event
  const { data: room, error: rErr } = await supabase
    .from("rooms")
    .select("id, event_id")
    .eq("id", room_id)
    .single();
  if (rErr || !room || room.event_id !== booking.event_id) {
    return NextResponse.json(
      { ok: false, error: "Room not valid for this event" },
      { status: 400 }
    );
  }

  // Link the room
  const { error: linkErr } = await supabase
    .from("room_booking_rooms")
    .insert({ room_booking_id, room_id });
  if (linkErr)
    return NextResponse.json(
      { ok: false, error: linkErr.message },
      { status: 400 }
    );

  return NextResponse.json({ ok: true });
}
