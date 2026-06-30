import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { groupForHost } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import FrameBuster from "@/components/frame-buster";
import DevicePreview from "@/components/device-preview";

export const dynamic = "force-dynamic";

// Full-page demo selection: shows the laptop and phone demos as live previews
// side by side; clicking one opens that device's full-screen demo. Only
// reachable inside a demo session (the cookie is set by startDemo first, so the
// preview iframes can load the live app).
export default async function DemoSelectPage() {
  const profile = await requireProfile();
  if (!profile.is_demo) redirect("/");

  const t = await getT();
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const group = groupForHost(host);

  return (
    <div className="min-h-screen bg-stone-100">
      <FrameBuster />

      <header className="mx-auto flex max-w-7xl items-center gap-2.5 px-5 py-4">
        <Image
          src={group.logoPath}
          alt={group.shortName}
          width={32}
          height={32}
          className="rounded-full object-contain"
        />
        <span className="font-semibold">Pathshala ERP</span>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("Choose how to explore the demo")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          {t("Click a device to open the full demo.")}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-10 lg:flex-row lg:items-end lg:gap-16">
          <DevicePreview kind="laptop" />
          <DevicePreview kind="mobile" />
        </div>
      </main>
    </div>
  );
}
