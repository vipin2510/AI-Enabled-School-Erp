// A dependency-free vertical bar chart for attendance rates. Pure server
// component: it just renders sized divs. Each bar shows a percentage 0–100.

export type Bar = {
  label: string;
  /** 0–100 */
  value: number;
  /** small caption under the percentage, e.g. "42/45" */
  caption?: string;
};

function barColor(value: number): string {
  if (value >= 90) return "bg-emerald-500";
  if (value >= 75) return "bg-sky-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export default function BarChart({ bars, empty }: { bars: Bar[]; empty?: string }) {
  if (!bars.length) {
    return (
      <div className="card p-8 text-center text-sm text-stone-500">
        {empty ?? "No attendance recorded for this range yet."}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ minHeight: 220 }}>
        {bars.map((b) => (
          <div key={b.label} className="flex min-w-[44px] flex-1 flex-col items-center gap-2">
            <div className="text-xs font-semibold text-stone-700">{Math.round(b.value)}%</div>
            <div className="flex h-40 w-full items-end">
              <div
                className={`w-full rounded-t-md ${barColor(b.value)} transition-all`}
                style={{ height: `${Math.max(b.value, 1)}%` }}
                title={`${b.label}: ${Math.round(b.value)}%`}
              />
            </div>
            <div className="text-center text-[11px] font-medium leading-tight text-stone-600">
              {b.label}
            </div>
            {b.caption && <div className="text-[10px] text-stone-400">{b.caption}</div>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
        <Legend className="bg-emerald-500" label="≥90%" />
        <Legend className="bg-sky-500" label="75–89%" />
        <Legend className="bg-amber-500" label="50–74%" />
        <Legend className="bg-rose-500" label="<50%" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
