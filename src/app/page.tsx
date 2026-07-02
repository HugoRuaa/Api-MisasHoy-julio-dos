import { Suspense } from 'react';
import Header from '@/components/header';
import VideoList from '@/components/video-list';
import VideoListSkeleton from '@/components/video-list-skeleton';
import { getMassVideos } from '@/lib/youtube';
import { isToday } from 'date-fns';

export const revalidate = 0; // Revalidate on every request

export default async function Home() {
  const videos = await getMassVideos();
  
  // Filtra los vídeos para contar solo los de hoy
  const todayVideosCount = videos.filter(video => 
    isToday(new Date(video.publishedAt))
  ).length;

  const totalVideosCount = videos.length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header todayCount={todayVideosCount} totalCount={totalVideosCount} />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Suspense fallback={<VideoListSkeleton />}>
          <VideoList videos={videos} />
        </Suspense>
      </main>
    </div>
  );
}
