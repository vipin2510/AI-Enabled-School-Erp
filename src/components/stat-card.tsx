import Link from "next/link";

export type StatTone = "slate" | "emerald" | "amber" | "rose" | "violet" | "sky";

const TONES: Record<StatTone, { ring: string; icon: string; value: string }> = {
  slate: { ring: "border-slate-200", icon: "bg-slate-100 text-slate-700", value: "text-slate-900" },
  emerald: { ring: "border-emerald-200", icon: "bg-emerald-100 text-emerald-700", value: "text-emerald-700" },
  amber: { ring: "border-amber-200", icon: "bg-amber-100 text-amber-700", value: "text-amber-700" },
  rose: { ring: "border-rose-200", icon: "bg-rose-100 text-rose-700", value: "text-rose-700" },
  violet: { ring: "border-violet-200", icon: "bg-violet-100 text-violet-700", value: "text-violet-700" },
  sky: { ring: "border-sky-200", icon: "bg-sky-100 text-sky-700", value: "text-sky-700" },
};

export default function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "slate",
  href,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: string;
  tone?: StatTone;
  href?: string;
}) {
  const t = TONES[tone];
  const inner = (
    <div className={`card h-full border ${t.ring} p-5 transition ${href ? "hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{title}</div>
        {icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base ${t.icon}`}>
            {icon}
          </span>
        )}
      </div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${t.value}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
