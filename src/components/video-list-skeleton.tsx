import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function VideoListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="bg-card">
          <CardHeader className="p-0">
            <Skeleton className="h-40 w-full rounded-t-lg" />
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
            <div className="flex items-center pt-2 gap-2">
              <Skeleton className="h-4 w-20" />
            </div>
             <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
