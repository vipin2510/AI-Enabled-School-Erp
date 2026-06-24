import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getTemplate } from "../../actions";
import TemplateEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "manager");
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="-mx-6 -my-6 md:-mx-10">
      <header className="border-b border-stone-200 bg-white px-6 py-3 md:px-10">
        <Link
          href="/results/templates"
          className="text-xs text-stone-500 hover:underline"
        >
          ← All templates
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">{template.name}</h1>
      </header>
      <TemplateEditor template={template} />
    </div>
  );
}
