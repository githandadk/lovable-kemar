import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function supa() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

async function requireAdmin(sc: ReturnType<typeof createServerClient>) {
  const {
    data: { user },
  } = await (await sc).auth.getUser();
  const { data: me } = await (await sc)
    .from("profiles")
    .select("role")
    .eq("user_id", user?.id)
    .single();
  if (!user || !me || (me.role !== "admin" && me.role !== "staff"))
    return false;
  return true;
}

export async function GET(req: Request) {
  const sc = supa();
  if (!(await requireAdmin(sc)))
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId)
    return NextResponse.json(
      { ok: false, error: "Missing eventId" },
      { status: 400 }
    );

  const { data, error } = await (await sc)
    .from("event_discounts")
    .select(
      "id, event_id, label, scope, kind, value, starts_at, ends_at, requires_role, min_attendees, max_amount, is_stackable, code, priority"
    )
    .eq("event_id", eventId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, discounts: data ?? [] });
}

export async function POST(req: Request) {
  const sc = supa();
  if (!(await requireAdmin(sc)))
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const body = await req.json();
  const payload = {
    id: body.id,
    event_id: body.event_id,
    label: body.label,
    scope: body.scope,
    kind: body.kind,
    value: Number(body.value ?? 0),
    starts_at: body.starts_at ?? null,
    ends_at: body.ends_at ?? null,
    requires_role: body.requires_role ?? null,
    min_attendees: body.min_attendees ?? null,
    max_amount: body.max_amount ?? null,
    is_stackable: !!body.is_stackable,
    code: body.code ?? null,
    priority: body.priority ?? null,
  };
  if (!payload.event_id || !payload.label || !payload.scope || !payload.kind) {
    return NextResponse.json(
      { ok: false, error: "Missing fields" },
      { status: 400 }
    );
  }

  // upsert by id if present, else insert
  if (payload.id) {
    const id = payload.id;
    delete (payload as any).id;
    const { error } = await (await sc)
      .from("event_discounts")
      .update(payload)
      .eq("id", id);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
  } else {
    const { error } = await (await sc).from("event_discounts").insert(payload);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sc = supa();
  if (!(await requireAdmin(sc)))
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 403 }
    );

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { ok: false, error: "Missing id" },
      { status: 400 }
    );

  const { error } = await (await sc)
    .from("event_discounts")
    .delete()
    .eq("id", id);
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}
