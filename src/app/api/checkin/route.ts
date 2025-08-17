import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { data, error } = await supabaseAdmin.functions.invoke('checkin', { body })

    if (error) {
      // expose as much as possible to debug
      return NextResponse.json(
        {
          ok: false,
          where: 'invoke',
          code: error.name,
          message: error.message,
          details: (error as any)?.context ?? null
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, where: 'route', message: e?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
