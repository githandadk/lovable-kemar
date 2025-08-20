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
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

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

  // Load the registration & ensure ownership
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

  const qrUid = crypto.randomUUID(); // simple unique QR id

  const { data: inserted, error: insErr } = await supabase
    .from("attendees")
    .insert({
      registration_id: reg.id,
      event_id: reg.event_id,
      full_name,
      department_code,
      department_surcharge: dept.surcharge,
      qr_code_uid: qrUid,
      ticket_status: "active",
    })
    .select("id, full_name, department_code")
    .single();

  if (insErr) {
    return NextResponse.json(
      { ok: false, error: insErr.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, attendee: inserted });
}
