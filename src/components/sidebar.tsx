"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/access";
import { useShellNav } from "@/components/shell-nav";

export type NavGroup = { label?: string; items: NavItem[] };

export default function Sidebar({
  groups,
  brandName = "Pathshala",
  brandSub = "Adeshwar Public School",
  logoSrc = "/letterhead/aps-logo.jpeg",
}: {
  groups: NavGroup[];
  brandName?: string;
  brandSub?: string;
  logoSrc?: string;
}) {
  const path = usePathname();
  const { open, setOpen } = useShellNav();
  const close = () => setOpen(false);
  return (
    <>
      {/* Dim backdrop behind the mobile drawer; tap to dismiss. */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={close}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "w-60 shrink-0 border-r border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6",
          // Mobile: off-canvas drawer that slides in. Desktop: normal column.
          "fixed inset-y-0 left-0 z-40 overflow-y-auto transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
      <Link href="/" onClick={close} className="flex items-center gap-3 mb-8 px-2">
        <Image src={logoSrc} alt={brandName} width={40} height={40} className="rounded-full object-contain" />
        <div>
          <div className="text-sm font-semibold leading-tight">{brandName}</div>
          <div className="text-xs text-stone-500 leading-tight">{brandSub}</div>
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
                  onClick={close}
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
    </>
  );
}
