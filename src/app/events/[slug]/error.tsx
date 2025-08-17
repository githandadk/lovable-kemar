'use client';
export default function Error({ error }: { error: Error }) {
  return <main className="p-6 text-red-600">Error: {error.message}</main>;
}
