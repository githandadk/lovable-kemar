import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only key; RLS still applies, but we can upsert safely
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      user_id, // required
      first_name,
      last_name,
      korean_name,
      email,
      phone,
      age_years,
      home_church,
    } = body;

    if (!user_id) {
      return NextResponse.json(
        { ok: false, error: "Missing user_id" },
        { status: 400 }
      );
    }

    // Ensure a row exists, then update
    const { error: upsertErr } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id,
        first_name,
        last_name,
        korean_name,
        email,
        phone,
        age_years,
        home_church,
        full_name: [first_name, last_name].filter(Boolean).join(" "),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: upsertErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
