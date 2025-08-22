import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(
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
    .select("id, created_by, amount_total")
    .eq("id", registrationId)
    .single();
  if (!reg || reg.created_by !== user.id)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const { data: items } = await supabase
    .from("registration_items")
    .select("id, kind, qty, unit_price, amount, description")
    .eq("registration_id", registrationId)
    .order("created_at");

  const subtotal = (items ?? []).reduce(
    (s, r: any) => s + Number(r.amount ?? 0),
    0
  );
  return NextResponse.json({
    ok: true,
    subtotal,
    amount_total: reg.amount_total,
    items: items ?? [],
  });
}
