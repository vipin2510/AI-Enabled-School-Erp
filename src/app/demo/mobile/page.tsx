import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import PhoneFrame from "@/components/phone-frame";
import FrameBuster from "@/components/frame-buster";

export const dynamic = "force-dynamic";

// Bare page (no app shell) that hosts the demo app inside a phone frame. Only
// reachable in a demo session; a real user gets sent home.
export default async function DemoMobilePage() {
  const profile = await requireProfile();
  if (!profile.is_demo) redirect("/");
  return (
    <>
      <FrameBuster />
      <PhoneFrame />
    </>
  );
}
