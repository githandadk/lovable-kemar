import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type Discount = {
  id?: string;
  code: string | null;
  label: string;
  scope: "room" | "meal" | "all";
  kind: "percent" | "fixed" | "comp";
  value: number; // percent e.g. 10, or fixed dollars; comp == 100
  starts_at: string | null;
  ends_at: string | null;
  requires_role: "volunteer" | "presenter" | null;
  min_attendees: number | null;
  bulk_rate_multiplier: number | null; // unused here
  is_stackable: boolean;
  priority: number | null;
  max_amount: number | null;
};

export async function POST(
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

  // Auth + ownership
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
    .select("id, event_id, created_by, created_at")
    .eq("id", registrationId)
    .single();
  if (!reg || reg.created_by !== user.id)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  // ------- Wipe old items and rebuild base charges -------
  await supabase
    .from("registration_items")
    .delete()
    .eq("registration_id", registrationId);

  // Attendees (with role & surcharge)
  const { data: attendees } = await supabase
    .from("attendees")
    .select("id, full_name, role, department_surcharge, ticket_status")
    .eq("registration_id", registrationId);

  const attendeeIds = (attendees ?? []).map((a) => a.id);

  // Room bookings
  const { data: bookings } = await supabase
    .from("room_bookings")
    .select(
      "id, lodging_option_id, checkin_date, checkout_date, num_keys, key_deposit_per_key"
    )
    .eq("registration_id", registrationId);

  // Lodging options (rates)
  const loIds = [
    ...new Set(
      (bookings ?? []).map((b) => b.lodging_option_id).filter(Boolean)
    ),
  ] as string[];
  const loMap = new Map<string, number>();
  if (loIds.length) {
    const { data: los } = await supabase
      .from("lodging_options")
      .select("id, nightly_rate")
      .in("id", loIds);
    (los ?? []).forEach((lo) => loMap.set(lo.id, Number(lo.nightly_rate)));
  }

  // Assigned rooms per booking
  const { data: rbr } = await supabase
    .from("room_booking_rooms")
    .select("room_booking_id, room_id")
    .in(
      "room_booking_id",
      (bookings ?? []).map((b) => b.id)
    );
  const roomsPerBooking = new Map<string, number>();
  (rbr ?? []).forEach((row) => {
    roomsPerBooking.set(
      row.room_booking_id,
      (roomsPerBooking.get(row.room_booking_id) ?? 0) + 1
    );
  });

  // Guests per booking (so we can compute per-guest share)
  const { data: guestsRows } = await supabase
    .from("room_booking_guests")
    .select("room_booking_id, attendee_id")
    .in(
      "room_booking_id",
      (bookings ?? []).map((b) => b.id)
    );
  const guestsByBooking = new Map<string, string[]>();
  (guestsRows ?? []).forEach((g) => {
    const arr = guestsByBooking.get(g.room_booking_id) ?? [];
    arr.push(g.attendee_id);
    guestsByBooking.set(g.room_booking_id, arr);
  });

  // Base items accumulator
  const baseItems: any[] = [];

  // Room nights + keys
  let roomTotal = 0;
  type BookingCost = { total: number; perGuest: Map<string, number> };
  const bookingCosts = new Map<string, BookingCost>();

  for (const b of bookings ?? []) {
    const nights = Math.max(
      0,
      Math.ceil(
        (Date.parse(String(b.checkout_date)) -
          Date.parse(String(b.checkin_date))) /
          86_400_000
      )
    );
    const numRooms = roomsPerBooking.get(b.id) ?? 0;
    const rate = b.lodging_option_id ? loMap.get(b.lodging_option_id) ?? 0 : 0;
    const totalForBooking =
      nights > 0 && numRooms > 0 && rate > 0 ? nights * numRooms * rate : 0;

    if (totalForBooking > 0) {
      baseItems.push({
        registration_id: registrationId,
        kind: "room_night",
        ref_table: "room_bookings",
        ref_id: b.id,
        qty: nights * numRooms,
        unit_price: rate,
        description: `Room nights (${numRooms} room${
          numRooms > 1 ? "s" : ""
        } × ${nights} night${nights > 1 ? "s" : ""})`,
      });
      roomTotal += totalForBooking;

      // compute per-guest share for this booking (equal split among current guests)
      const guests = guestsByBooking.get(b.id) ?? [];
      const perGuest = new Map<string, number>();
      const share = guests.length ? totalForBooking / guests.length : 0;
      guests.forEach((attId) => perGuest.set(attId, share));
      bookingCosts.set(b.id, { total: totalForBooking, perGuest });
    }

    // Keys (deposits)
    const keys = Math.max(0, Math.min(2, Number(b.num_keys ?? 0)));
    const dep = Number(b.key_deposit_per_key ?? 0);
    if (keys > 0 && dep > 0) {
      baseItems.push({
        registration_id: registrationId,
        kind: "key_deposit",
        ref_table: "room_bookings",
        ref_id: b.id,
        qty: keys,
        unit_price: dep,
        description: `Room key deposit`,
      });
    }
  }

  // Department surcharges
  for (const a of attendees ?? []) {
    const amt = Number(a.department_surcharge ?? 0);
    if (amt > 0) {
      baseItems.push({
        registration_id: registrationId,
        kind: "department_surcharge",
        ref_table: "attendees",
        ref_id: a.id,
        qty: 1,
        unit_price: amt,
        description: `Department surcharge — ${a.full_name}`,
      });
    }
  }

  // Meals (existing passes)
  const { data: passes } = await supabase
    .from("attendee_meal_passes")
    .select(
      "attendee_id, meal_session_id, purchased, meal_sessions(price, meal_date, meal_type), attendees(full_name)"
    )
    .eq("purchased", true)
    .in("attendee_id", attendeeIds);

  let mealTotal = 0;
  const mealTotalsByAttendee = new Map<string, number>();

  (passes ?? []).forEach((p) => {
    const price = Number((p as any).meal_sessions?.price ?? 0);
    if (price > 0) {
      baseItems.push({
        registration_id: registrationId,
        kind: "meal",
        ref_table: "attendee_meal_passes",
        ref_id: p.meal_session_id,
        qty: 1,
        unit_price: price,
        description: `Meal — ${(p as any).attendees?.full_name ?? ""} @ ${
          (p as any).meal_sessions?.meal_date ?? ""
        } ${(p as any).meal_sessions?.meal_type ?? ""}`,
      });
      mealTotal += price;
      const attId = p.attendee_id;
      mealTotalsByAttendee.set(
        attId,
        (mealTotalsByAttendee.get(attId) ?? 0) + price
      );
    }
  });

  // Insert base items
  if (baseItems.length) {
    const { error: baseErr } = await supabase
      .from("registration_items")
      .insert(baseItems);
    if (baseErr)
      return NextResponse.json(
        { ok: false, error: baseErr.message },
        { status: 400 }
      );
  }

  // ------- Load event_discounts and apply -------
  const { data: discounts } = await supabase
    .from("event_discounts")
    .select(
      "code, label, scope, kind, value, starts_at, ends_at, requires_role, min_attendees, is_stackable, priority, max_amount"
    )
    .eq("event_id", reg.event_id);

  const now = new Date();

  function isActive(d: Discount) {
    if (d.starts_at && new Date(d.starts_at) > now) return false;
    if (d.ends_at && new Date(d.ends_at) < now) return false;
    return true;
  }

  // Prepare to add negative discount items
  const discountItems: any[] = [];

  // Helpers
  const activeAttendees = (attendees ?? []).filter(
    (a) => a.ticket_status === "active"
  );
  const hasRole = (role: "volunteer" | "presenter") =>
    activeAttendees.some((a) => a.role === role);

  function clampMax(amount: number, d: Discount) {
    if (d.max_amount != null) return Math.min(amount, Number(d.max_amount));
    return amount;
  }

  // A) Role-based ROOM discounts (comp/percent) — per guest share
  for (const d of (discounts ?? []).filter(
    (d) => d.scope === "room" && isActive(d)
  )) {
    if (d.requires_role && !hasRole(d.requires_role)) continue;

    // collect attendees matching the role (or all, if no role)
    const targetAtts = d.requires_role
      ? activeAttendees.filter((a) => a.role === d.requires_role)
      : activeAttendees;

    // compute total of their room shares across all bookings
    let targetRoomTotal = 0;
    for (const b of bookings ?? []) {
      const bc = bookingCosts.get(b.id);
      if (!bc) continue;
      for (const ta of targetAtts) {
        targetRoomTotal += bc.perGuest.get(ta.id) ?? 0;
      }
    }
    if (targetRoomTotal <= 0) continue;

    let discountAmt = 0;
    if (d.kind === "comp") discountAmt = targetRoomTotal; // 100%
    else if (d.kind === "percent")
      discountAmt = (d.value / 100) * targetRoomTotal;
    else if (d.kind === "fixed") discountAmt = d.value;

    discountAmt = clampMax(discountAmt, d);
    if (discountAmt > 0) {
      discountItems.push({
        registration_id: registrationId,
        kind: "discount",
        ref_table: "event_discounts",
        ref_id: null,
        qty: 1,
        unit_price: -Number(discountAmt.toFixed(2)),
        description: d.label || `Room discount`,
      });
    }
  }

  // B) Role-based MEAL discounts (presenter comp meals, etc.)
  for (const d of (discounts ?? []).filter(
    (d) => d.scope === "meal" && isActive(d)
  )) {
    if (d.requires_role && !hasRole(d.requires_role)) continue;

    const targetAtts = d.requires_role
      ? activeAttendees.filter((a) => a.role === d.requires_role)
      : activeAttendees;

    let targetMeals = 0;
    for (const ta of targetAtts) {
      targetMeals += mealTotalsByAttendee.get(ta.id) ?? 0;
    }
    if (targetMeals <= 0) continue;

    let discountAmt = 0;
    if (d.kind === "comp") discountAmt = targetMeals;
    else if (d.kind === "percent") discountAmt = (d.value / 100) * targetMeals;
    else if (d.kind === "fixed") discountAmt = d.value;

    discountAmt = clampMax(discountAmt, d);
    if (discountAmt > 0) {
      discountItems.push({
        registration_id: registrationId,
        kind: "discount",
        ref_table: "event_discounts",
        ref_id: null,
        qty: 1,
        unit_price: -Number(discountAmt.toFixed(2)),
        description: d.label || `Meal discount`,
      });
    }
  }

  // C) Group meals discount (scope=meal + min_attendees)
  for (const d of (discounts ?? []).filter(
    (d) => d.scope === "meal" && isActive(d) && (d.min_attendees ?? 0) > 0
  )) {
    const count = activeAttendees.length;
    if (count < (d.min_attendees ?? 0)) continue;

    // apply % or fixed to total meal spend
    if (mealTotal > 0) {
      let discountAmt = 0;
      if (d.kind === "percent") discountAmt = (d.value / 100) * mealTotal;
      else if (d.kind === "fixed") discountAmt = d.value;
      else if (d.kind === "comp") discountAmt = mealTotal;

      discountAmt = clampMax(discountAmt, d);
      if (discountAmt > 0) {
        discountItems.push({
          registration_id: registrationId,
          kind: "discount",
          ref_table: "event_discounts",
          ref_id: null,
          qty: 1,
          unit_price: -Number(discountAmt.toFixed(2)),
          description: d.label || `Group meal discount`,
        });
      }
    }
  }

  // D) Early bird (scope=all; date-bound)
  for (const d of (discounts ?? []).filter(
    (d) => d.scope === "all" && isActive(d)
  )) {
    // early-bird usually checks reg.created_at within window; isActive already filters by now,
    // but often early-bird applies if registration was CREATED in window.
    if (d.starts_at && new Date(reg.created_at) < new Date(d.starts_at))
      continue;
    if (d.ends_at && new Date(reg.created_at) > new Date(d.ends_at)) continue;

    // compute current subtotal (base items + earlier discounts we’ve added so far stay separate)
    const { data: current } = await supabase
      .from("registration_items")
      .select("amount")
      .eq("registration_id", registrationId);
    const baseSubtotal =
      (current ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0) +
      discountItems.reduce(
        (s, it: any) => s + Number(it.qty) * Number(it.unit_price),
        0
      );

    if (baseSubtotal <= 0) continue;

    let discountAmt = 0;
    if (d.kind === "percent") discountAmt = (d.value / 100) * baseSubtotal;
    else if (d.kind === "fixed") discountAmt = d.value;
    else if (d.kind === "comp") discountAmt = baseSubtotal;

    discountAmt = clampMax(discountAmt, d);
    if (discountAmt > 0) {
      discountItems.push({
        registration_id: registrationId,
        kind: "discount",
        ref_table: "event_discounts",
        ref_id: null,
        qty: 1,
        unit_price: -Number(discountAmt.toFixed(2)),
        description: d.label || `Early-bird discount`,
      });
    }
  }

  // Insert discounts
  if (discountItems.length) {
    const { error: dErr } = await supabase
      .from("registration_items")
      .insert(discountItems);
    if (dErr)
      return NextResponse.json(
        { ok: false, error: dErr.message },
        { status: 400 }
      );
  }

  // Final total -> registrations.amount_total
  const { data: itemsForTotal } = await supabase
    .from("registration_items")
    .select("amount")
    .eq("registration_id", registrationId);

  const total = (itemsForTotal ?? []).reduce(
    (s, r: any) => s + Number(r.amount ?? 0),
    0
  );
  await supabase
    .from("registrations")
    .update({ amount_total: total })
    .eq("id", registrationId);

  return NextResponse.json({ ok: true, total });
}
