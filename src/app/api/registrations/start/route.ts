import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  // Next 15: cookies() is async
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
  const { eventSlug } = body;
  if (!eventSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing eventSlug" },
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

  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("id")
    .eq("slug", eventSlug)
    .single();
  if (evErr || !event) {
    return NextResponse.json(
      { ok: false, error: "Event not found" },
      { status: 404 }
    );
  }

  const { data: existing, error: findErr } = await supabase
    .from("registrations")
    .select("id, status")
    .eq("event_id", event.id)
    .eq("created_by", user.id)
    .in("status", ["pending", "draft"])
    .maybeSingle();
  if (findErr) {
    return NextResponse.json(
      { ok: false, error: findErr.message },
      { status: 400 }
    );
  }

  if (existing) {
    return NextResponse.json({ ok: true, registrationId: existing.id });
  }

  const { data: created, error: insErr } = await supabase
    .from("registrations")
    .insert({
      event_id: event.id,
      created_by: user.id,
      status: "pending",
      amount_total: 0,
    })
    .select("id")
    .single();
  if (insErr || !created) {
    return NextResponse.json(
      { ok: false, error: insErr?.message ?? "Create failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, registrationId: created.id });
}
