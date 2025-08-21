import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ bookingId: string; guestId: string }> }
) {
  const { bookingId, guestId } = await ctx.params;
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

  // Ensure the guest row belongs to a booking under this user's registration
  const { data: row, error: rowErr } = await supabase
    .from("room_booking_guests")
    .select("id, room_booking_id")
    .eq("id", guestId)
    .single();
  if (rowErr || !row)
    return NextResponse.json(
      { ok: false, error: "Guest not found" },
      { status: 404 }
    );

  const { data: booking } = await supabase
    .from("room_bookings")
    .select("id, registration_id")
    .eq("id", row.room_booking_id)
    .single();

  const { data: reg } = await supabase
    .from("registrations")
    .select("created_by")
    .eq("id", booking?.registration_id)
    .single();

  if (
    !booking ||
    !reg ||
    reg.created_by !== user.id ||
    booking.id !== bookingId
  ) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  const { error: delErr } = await supabase
    .from("room_booking_guests")
    .delete()
    .eq("id", guestId);

  if (delErr)
    return NextResponse.json(
      { ok: false, error: delErr.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}
