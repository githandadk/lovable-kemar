import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Params = { params: { slug: string } };

export default async function EventDetailPage({ params }: Params) {
  const { slug } = params;

  const { data: event, error } = await supabase
    .from("events")
    .select("id, name, slug, timezone, start_date, end_date, location, description")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error(error);
    notFound();
  }
  if (!event) notFound();

  // Optional: pull some related data (buildings or meals) to show context
  const { data: buildings } = await supabase
    .from("campus_buildings")
    .select("code, name, gender_policy, is_accessible")
    .eq("event_id", event.id)
    .order("code");

  const { data: meals } = await supabase
    .from("meal_sessions")
    .select("meal_date, meal_type, price")
    .eq("event_id", event.id)
    .order("meal_date");

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <div className="text-sm text-gray-600">
          {event.start_date} – {event.end_date} ({event.timezone})
          {event.location ? ` · ${event.location}` : ""}
        </div>
        {event.description && (
          <p className="mt-2 text-gray-800">{event.description}</p>
        )}
      </div>

      <div>
        <Link
          href={`/events/${event.slug}/register`}
          className="inline-block rounded border px-4 py-2 hover:bg-gray-50"
        >
          Start registration
        </Link>
      </div>

      {buildings?.length ? (
        <section>
          <h2 className="text-lg font-medium mb-2">Buildings</h2>
          <ul className="space-y-1">
            {buildings.map((b) => (
              <li key={b.code} className="text-sm">
                <span className="font-medium">{b.code}</span> – {b.name}
                {b.gender_policy ? ` · ${b.gender_policy}` : ""}
                {b.is_accessible ? " · accessible" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {meals?.length ? (
        <section>
          <h2 className="text-lg font-medium mb-2">Sample Meals</h2>
          <ul className="space-y-1 text-sm">
            {meals.map((m, i) => (
              <li key={i}>
                {m.meal_date}: {m.meal_type} (${m.price})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export async function generateStaticParams() {
  // Only slugs; keep anon key usage minimal
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events?select=slug`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
    // Revalidate at build or use cache: 'no-store' for dynamic
    cache: "no-store" // or remove to allow caching
  });

  const events = (await res.json()) as { slug: string }[];
  return events.map((e) => ({ slug: e.slug }));
}
