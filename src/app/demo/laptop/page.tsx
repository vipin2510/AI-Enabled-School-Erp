import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import LaptopFrame from "@/components/laptop-frame";
import FrameBuster from "@/components/frame-buster";

export const dynamic = "force-dynamic";

// Bare page (no app shell) that hosts the demo app inside a MacBook frame. Only
// reachable in a demo session; a real user gets sent home.
export default async function DemoLaptopPage() {
  const profile = await requireProfile();
  if (!profile.is_demo) redirect("/");
  return (
    <>
      <FrameBuster />
      <LaptopFrame />
    </>
  );
}
