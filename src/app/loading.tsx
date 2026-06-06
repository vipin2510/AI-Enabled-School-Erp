// Root-level loading skeleton. Inherited by any route that doesn't define its
// own loading.tsx — gives every click immediate feedback while the server
// runs guards + Supabase queries.
export default function RootLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-56 rounded-md bg-stone-200/70 animate-pulse" />
      <div className="h-4 w-80 rounded-md bg-stone-200/60 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-stone-200/50 animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-stone-200/40 animate-pulse mt-2" />
    </div>
  );
}
