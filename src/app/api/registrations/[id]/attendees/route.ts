// src/app/api/registrations/[id]/attendees/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // ⬅️ params is async
) {
  const { id } = await ctx.params; // ⬅️ await it

  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "Not signed in" },
      { status: 401 }
    );

  const { data: reg, error: regErr } = await supabase
    .from("registrations")
    .select("id, created_by")
    .eq("id", id) // ⬅️ use resolved id
    .single();

  if (regErr || !reg)
    return NextResponse.json(
      { ok: false, error: "Registration not found" },
      { status: 404 }
    );
  if (reg.created_by !== user.id)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const { data: attendees, error } = await supabase
    .from("attendees")
    .select("id, full_name, department_code")
    .eq("registration_id", reg.id)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, attendees });
}
