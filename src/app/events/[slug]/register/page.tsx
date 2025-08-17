import { supabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";

export default async function RegisterPage({ params }: { params: { slug: string } }) {
  const { data: event, error } = await supabase
    .from("events")
    .select("id, name, slug, start_date, end_date")
    .eq("slug", params.slug)
    .single();

  if (error || !event) notFound();

  // Later: render a multi-step wizard (attendees → lodging → meals → shuttle)
  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Register: {event.name}</h1>
      <p className="text-sm text-gray-600">
        Dates: {event.start_date} – {event.end_date}
      </p>

      <div className="border rounded p-4">
        <p>This is a placeholder registration page.</p>
        <p className="text-sm text-gray-600">
          Next: add a wizard with steps for attendee info, lodging, and meals.
        </p>
      </div>
    </main>
  );
}
