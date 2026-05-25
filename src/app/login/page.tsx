import Image from "next/image";
import { Suspense } from "react";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/letterhead/aps-logo.jpeg"
            alt="APS"
            width={56}
            height={56}
            className="rounded-full"
          />
          <h1 className="mt-3 text-lg font-semibold">Pathshala ERP</h1>
          <p className="text-sm text-stone-500">Adeshwar Public School</p>
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
