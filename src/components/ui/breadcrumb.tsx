import Link from "next/link";

export type Crumb = { label: string; href?: string };

// Simple breadcrumb trail. The last item renders as the current page (bold, no
// link); earlier items link if they carry an href. Server component — safe to
// use directly in pages.
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-stone-500"
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {it.href && !last ? (
              <Link href={it.href} className="hover:text-stone-900 hover:underline">
                {it.label}
              </Link>
            ) : (
              <span
                className={last ? "font-medium text-stone-800" : undefined}
                aria-current={last ? "page" : undefined}
              >
                {it.label}
              </span>
            )}
            {!last && <span className="text-stone-300">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
