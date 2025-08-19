import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json();
  const { registrationId, full_name, department_code } = body;

  if (!registrationId || !full_name || !department_code) {
    return NextResponse.json(
      { ok: false, error: "Missing fields" },
      { status: 400 }
    );
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json(
      { ok: false, error: "Not signed in" },
      { status: 401 }
    );
  }

  // Load the registration & event
  const { data: reg, error: regErr } = await supabase
    .from("registrations")
    .select("id, event_id, created_by")
    .eq("id", registrationId)
    .single();

  if (regErr || !reg) {
    return NextResponse.json(
      { ok: false, error: "Registration not found" },
      { status: 404 }
    );
  }
  if (reg.created_by !== user.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  // Lookup department surcharge for this event
  const { data: dept, error: depErr } = await supabase
    .from("event_department_surcharges")
    .select("surcharge")
    .eq("event_id", reg.event_id)
    .eq("department_code", department_code)
    .single();

  if (depErr || !dept) {
    return NextResponse.json(
      { ok: false, error: "Department not configured" },
      { status: 400 }
    );
  }

  const { data: inserted, error: insErr } = await supabase
    .from("attendees")
    .insert({
      registration_id: reg.id,
      event_id: reg.event_id,
      full_name,
      department_code,
      department_surcharge: dept.surcharge,
      qr_code_uid: crypto.randomUUID(), // simple QR id; you can change later
      ticket_status: "active",
    })
    .select("id, full_name, department_code");

  if (insErr) {
    return NextResponse.json(
      { ok: false, error: insErr.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, attendee: inserted?.[0] });
}
