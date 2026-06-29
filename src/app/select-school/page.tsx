import Image from "next/image";
import { requireProfile, getCurrentGroup } from "@/lib/auth";
import { allowedSchools } from "@/lib/access";
import { setSchool } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Leaders (admin / manager) land here right after login when they have
// access to more than one school. Staff never reach this page — they are
// pinned to a single school by their profile and the proxy/layout send them
// straight to a department screen.
export default async function SelectSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const profile = await requireProfile();
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/";

  // Staff or single-school profile: nothing to choose, send them on.
  if (profile.role === "staff") redirect(target);
  const group = getCurrentGroup(profile);
  const schools = allowedSchools(profile.role, profile.school_ids, profile.group_id);
  if (schools.length <= 1) {
    // No choice to make — but we still want to set the cookie so subsequent
    // requests don't bounce back here. Fall through to render a one-card
    // "Enter" so the cookie gets written via the form submit.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-8">
          <Image
            src={group.logoPath}
            alt={group.shortName}
            width={56}
            height={56}
            className="rounded-full object-contain"
          />
          <h1 className="mt-3 text-lg font-semibold">Select your {group.unitLabel.toLowerCase()}</h1>
          <p className="text-sm text-stone-500">
            Welcome, {profile.full_name || profile.email || profile.phone}. Pick a {group.unitLabel.toLowerCase()} to
            enter. You can switch later from the top bar.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {schools.map((s) => (
            <form key={s.id} action={setSchool} className="contents">
              <input type="hidden" name="school_id" value={s.id} />
              <input type="hidden" name="next" value={target} />
              <button
                type="submit"
                className="card text-left p-5 hover:border-[color:var(--color-accent)] hover:shadow-sm transition group"
              >
                <div className="text-xs uppercase tracking-wide text-stone-400 group-hover:text-[color:var(--color-accent)]">
                  {s.code}
                </div>
                <div className="mt-1 text-base font-semibold">{s.name}</div>
                <div className="text-sm text-stone-600">{s.location}</div>
                {s.boardCode && (
                  <div className="mt-2 text-xs text-stone-500">
                    {s.board} · School Code {s.boardCode}
                  </div>
                )}
                {s.parentNote && (
                  <div className="mt-2 text-xs italic text-stone-500">{s.parentNote}</div>
                )}
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-accent)]">
                  Enter →
                </div>
              </button>
            </form>
          ))}
        </div>

        {schools.length === 0 && (
          <p className="mt-6 text-center text-sm text-red-600">
            Your account has no school access configured. Contact an administrator.
          </p>
        )}
      </div>
    </div>
  );
}
