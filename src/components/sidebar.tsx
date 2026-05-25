"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/access";

export type NavGroup = { label?: string; items: NavItem[] };

export default function Sidebar({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6">
      <Link href="/" className="flex items-center gap-3 mb-8 px-2">
        <Image src="/letterhead/aps-logo.jpeg" alt="APS" width={40} height={40} className="rounded-full" />
        <div>
          <div className="text-sm font-semibold leading-tight">Pathshala</div>
          <div className="text-xs text-stone-500 leading-tight">Adeshwar Public School</div>
        </div>
      </Link>
      <nav className="flex flex-col gap-4">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className="flex flex-col gap-1">
            {group.label && (
              <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                {group.label}
              </div>
            )}
            {group.items.map((n) => {
              const active =
                path === n.href || (n.href !== "/" && path.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm transition",
                    active
                      ? "bg-stone-900 text-stone-50"
                      : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
