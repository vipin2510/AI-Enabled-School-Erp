import Image from "next/image";
import { Suspense } from "react";
import { headers } from "next/headers";
import { groupForHost } from "@/lib/access";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Pre-login branding follows the request host so Tagore's domain shows the
  // Tagore logo/name; everything else falls back to the default group.
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const group = groupForHost(host);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image
            src={group.logoPath}
            alt={group.shortName}
            width={56}
            height={56}
            className="rounded-full object-contain"
          />
          <h1 className="mt-3 text-lg font-semibold">Pathshala ERP</h1>
          <p className="text-sm text-stone-500">{group.name}</p>
        </div>
        <div className="card p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">
          No account? Ask your administrator to create one.
        </p>
      </div>
    </div>
  );
}
