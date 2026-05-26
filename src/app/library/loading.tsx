import { HeaderSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <HeaderSkeleton />
      <Skeleton className="mb-6 h-32 w-full" />
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}
