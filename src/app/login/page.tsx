import Image from "next/image";
import { Suspense } from "react";
import { headers } from "next/headers";
import { groupForHost } from "@/lib/access";
import { isPhone } from "@/lib/device";
import { getT } from "@/lib/i18n/server";
import LoginForm from "./login-form";
import DemoChooser from "./demo-chooser";
import FrameBuster from "@/components/frame-buster";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const group = groupForHost(host);
  const mobile = isPhone(headerStore.get("user-agent"));
  const t = await getT();

  const features = [
    { icon: "💰", title: t("Fees"), body: t("Structures, collection and instant printable receipts."), tone: "bg-emerald-50 text-emerald-700" },
    { icon: "🎓", title: t("Academics"), body: t("Students, classes, attendance and ID cards."), tone: "bg-sky-50 text-sky-700" },
    { icon: "📚", title: t("Library"), body: t("Catalogue, issue/return and book requests."), tone: "bg-violet-50 text-violet-700" },
    { icon: "📊", title: t("Results"), body: t("Enter marks and generate report cards."), tone: "bg-amber-50 text-amber-700" },
  ];

  const benefits = [
    t("Bilingual — English & हिंदी"),
    t("Print-ready receipts & report cards"),
    t("Multi-branch ready"),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-stone-100 to-stone-100 text-stone-900">
      <FrameBuster />

      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Image src={group.logoPath} alt={group.shortName} width={36} height={36} className="rounded-full object-contain" />
          <span className="font-semibold">Pathshala ERP</span>
        </div>
        <a href="#signin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-white hover:text-stone-900">
          {t("Sign in")}
        </a>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pb-10 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white/70 px-3 py-1 text-xs font-medium text-accent">
          ● {group.name}
        </span>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
          {t("Run your whole school from one place")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-stone-500 sm:text-lg">
          {t("Fees, academics, library and results — one calm, fast ERP for your institute.")}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <DemoChooser isMobile={mobile} />
          <a
            href="#signin"
            className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            {t("Sign in")}
          </a>
        </div>
        <p className="mt-3 text-xs text-stone-400">{t("No sign-up needed — the demo runs on sample data.")}</p>
      </section>

      {/* Product preview mockup */}
      <section className="mx-auto max-w-4xl px-5 pb-16">
        <DashboardMockup t={t} />
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 pb-12">
        <h2 className="mb-5 text-center text-xs font-semibold uppercase tracking-wide text-stone-400">
          {t("Everything in the demo")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${f.tone}`}>{f.icon}</div>
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-stone-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-4xl px-5 pb-16">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-stone-500">
          {benefits.map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="text-accent">✓</span> {b}
            </span>
          ))}
        </div>
      </section>

      {/* Sign in */}
      <section id="signin" className="mx-auto max-w-sm px-5 pb-16">
        <h2 className="mb-4 text-center text-lg font-semibold">{t("Sign in")}</h2>
        <div className="card p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">
          {t("No account? Ask your administrator to create one.")}
        </p>
      </section>

      <footer className="border-t border-stone-200/70 py-6 text-center text-xs text-stone-400">
        Pathshala ERP · {group.name}
      </footer>
    </div>
  );
}

// A static, on-brand preview of the dashboard — pure CSS, no data — so the
// landing shows what the product looks like at a glance.
function DashboardMockup({ t }: { t: (s: string) => string }) {
  const stats = [
    { label: t("Total Students"), value: "1,240", tone: "text-sky-700" },
    { label: t("Collected · June"), value: "₹4.2L", tone: "text-emerald-700" },
    { label: t("Present Today"), value: "92%", tone: "text-amber-700" },
  ];
  const bars = [55, 72, 48, 90, 66, 80, 60];
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-300" />
        <span className="h-3 w-3 rounded-full bg-amber-300" />
        <span className="h-3 w-3 rounded-full bg-emerald-300" />
        <span className="ml-3 rounded-md bg-white px-3 py-1 text-xs text-stone-400 ring-1 ring-stone-200">
          pathshala-erp.app
        </span>
      </div>
      {/* body */}
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-stone-100 bg-stone-50/60 p-4">
            <div className="text-xs text-stone-400">{s.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-6">
        <div className="mb-2 text-xs font-medium text-stone-400">{t("Attendance by class")}</div>
        <div className="flex h-28 items-end gap-2">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-accent/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
