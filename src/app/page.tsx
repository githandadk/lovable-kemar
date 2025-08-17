import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default async function HomePage() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, slug, start_date, end_date, location")
    .order("start_date", { ascending: true });

  if (error) {
    console.error("Error loading events:", error.message);
    return <main className="p-6">Error loading events</main>;
  }

  if (!events?.length) {
    return <main className="p-6">No events found</main>;
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Available Events</h1>
      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="border rounded p-4">
            <div className="font-medium">{e.name}</div>
            <div className="text-sm text-gray-600">
              {e.start_date} – {e.end_date}
              {e.location ? ` · ${e.location}` : ""}
            </div>
            <div className="mt-2">
              <Link className="underline" href={`/events/${e.slug}`}>
                View details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
