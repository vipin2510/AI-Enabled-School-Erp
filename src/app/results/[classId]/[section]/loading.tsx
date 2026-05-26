import { HeaderSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <HeaderSkeleton />
      <Skeleton className="mb-6 h-40 w-full" />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
