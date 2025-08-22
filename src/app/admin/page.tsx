import Link from "next/link";

export default function AdminHome() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <Link className="underline" href="/admin/attendees">
            Attendees: set role
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/surcharges">
            Department surcharges
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/settings">
            Event settings
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/discounts">
            Event discounts
          </Link>
        </li>
        {/* Optional */}
        <li>
          <Link className="underline" href="/admin/rooms">
            Buildings & Rooms
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/meals">
            Meal sessions
          </Link>
        </li>
      </ul>
    </main>
  );
}
