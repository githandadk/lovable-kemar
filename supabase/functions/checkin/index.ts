// Deno runtime (Supabase Edge Functions)
// @ts-nocheck

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { event_id, qr_code_uid, station, action, meal_session_id, schedule_session_id } = await req.json()
    if (!event_id || !qr_code_uid || !station || !action) return resp({ error: 'Missing fields' }, 400)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1) Lookup attendee by QR + event
    const { data: attendee, error: aerr } = await supabase
      .from('attendees')
      .select('id, full_name, department_code, ticket_status, event_id')
      .eq('qr_code_uid', qr_code_uid)
      .eq('event_id', event_id)
      .single()

    if (aerr || !attendee) return resp({ status: 'NOT_FOUND' }, 404)
    if (attendee.ticket_status !== 'active') return resp({ status: 'VOID' }, 400)

    // 2) Optional eligibility checks
    if (station === 'dining' && meal_session_id) {
      const { data: pass } = await supabase
        .from('attendee_meal_passes')
        .select('id, purchased')
        .eq('attendee_id', attendee.id)
        .eq('meal_session_id', meal_session_id)
        .maybeSingle()
      if (!pass || !pass.purchased) return resp({ status: 'NOT_ELIGIBLE_MEAL' }, 403)
    }

    if (station === 'seminar' && schedule_session_id) {
      const { data: sess } = await supabase
        .from('schedule_sessions')
        .select('id')
        .eq('id', schedule_session_id)
        .eq('event_id', event_id)
        .maybeSingle()
      if (!sess) return resp({ status: 'NOT_ELIGIBLE_SESSION' }, 403)
    }

    // 3) Idempotency (avoid duplicates within last 30s)
    const since = new Date(Date.now() - 30_000).toISOString()
    const { data: dup } = await supabase
      .from('checkins')
      .select('id')
      .eq('attendee_id', attendee.id)
      .eq('event_id', event_id)
      .eq('station', station)
      .eq('action', action)
      .gte('scanned_at', since)
      .limit(1)

    if (dup && dup.length) return resp({ status: 'DUPLICATE', attendee: summary(attendee) }, 200)

    const { error: ierr } = await supabase.from('checkins').insert({
      event_id,
      attendee_id: attendee.id,
      station,
      action,
      meal_session_id: meal_session_id ?? null,
      schedule_session_id: schedule_session_id ?? null,
    })
    if (ierr) return resp({ status: 'ERROR', message: ierr.message }, 500)

    return resp({ status: 'OK', attendee: summary(attendee) }, 200)
  } catch (e) {
    return resp({ status: 'ERROR', message: String(e) }, 500)
  }
})

function resp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
function summary(a: any) {
  return { id: a.id, name: a.full_name, department: a.department_code }
}
