import { HeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-5xl">
      <HeaderSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
