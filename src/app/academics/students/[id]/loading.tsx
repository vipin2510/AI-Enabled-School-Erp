import { HeaderSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="aspect-[3/4] w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-44 w-full" />
          <TableSkeleton rows={4} cols={5} />
        </div>
      </div>
    </div>
  );
}
