import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <HeaderSkeleton />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="mt-6 h-80 w-full" />
    </div>
  );
}
