import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: registrationId } = await ctx.params;
  const body = await req.json(); // { selections: { [attendeeId]: { [mealSessionId]: boolean } } }

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

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, created_by")
    .eq("id", registrationId)
    .single();
  if (!reg || reg.created_by !== user.id)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const selections = body?.selections || {};

  // For simplicity: delete existing passes for attendees in this registration, then reinsert selected ones
  const { data: attIds } = await supabase
    .from("attendees")
    .select("id")
    .eq("registration_id", registrationId);
  const ids = (attIds ?? []).map((a) => a.id);

  if (ids.length) {
    await supabase.from("attendee_meal_passes").delete().in("attendee_id", ids);
  }

  const inserts: any[] = [];
  for (const attendeeId of Object.keys(selections)) {
    const map = selections[attendeeId] || {};
    for (const msId of Object.keys(map)) {
      if (map[msId]) {
        inserts.push({
          attendee_id: attendeeId,
          meal_session_id: msId,
          purchased: true,
        });
      }
    }
  }
  if (inserts.length) {
    const { error: insErr } = await supabase
      .from("attendee_meal_passes")
      .insert(inserts);
    if (insErr)
      return NextResponse.json(
        { ok: false, error: insErr.message },
        { status: 400 }
      );
  }

  // Rebuild pricing
  await fetch(
    new URL(
      `/api/registrations/${registrationId}/pricing/rebuild`,
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
    ),
    {
      method: "POST",
      headers: { cookie: cookieStore.toString() as any }, // local call in dev; in prod you can call supabase directly or refactor into a function
    }
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
