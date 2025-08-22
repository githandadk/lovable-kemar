import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supaFromCookies = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name: string, options: any) =>
          cookieStore.set({ name, value: "", ...options, maxAge: 0 }),
      },
    }
  );
};

async function checkUserAuth(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const supabase = await supaFromCookies();
    const user = await checkUserAuth(supabase);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("events")
      .select(
        "id, name, event_settings:event_settings(currency, default_meals_per_day, room_key_deposit, notes)"
      )
      .order("start_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    const rows = (data ?? []).map((e: any) => ({
      event_id: e.id,
      event_name: e.name,
      currency: e.event_settings?.currency ?? "USD",
      default_meals_per_day: e.event_settings?.default_meals_per_day ?? 3,
      room_key_deposit: Number(e.event_settings?.room_key_deposit ?? 0),
      notes: e.event_settings?.notes
        ? JSON.stringify(e.event_settings.notes)
        : "{}",
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supaFromCookies();
    const user = await checkUserAuth(supabase);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      event_id,
      currency,
      default_meals_per_day,
      room_key_deposit,
      notes,
    } = body || {};

    if (!event_id) {
      return NextResponse.json(
        { ok: false, error: "Missing event_id" },
        { status: 400 }
      );
    }

    // Parse notes if valid JSON string
    let notesJson: any = {};
    try {
      notesJson = notes ? JSON.parse(notes) : {};
    } catch {
      notesJson = {};
    }

    const { error } = await supabase.from("event_settings").upsert(
      {
        event_id,
        currency: currency ?? "USD",
        default_meals_per_day: Number(default_meals_per_day ?? 3),
        room_key_deposit: Number(room_key_deposit ?? 0),
        notes: notesJson,
      },
      { onConflict: "event_id" }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
