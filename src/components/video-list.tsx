import VideoCard from './video-card';
import type { Video } from '@/types';

interface VideoListProps {
  videos: Video[];
}

export default function VideoList({ videos }: VideoListProps) {
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-3xl font-headline font-bold">No se encontraron misas para hoy</h2>
        <p className="text-muted-foreground mt-3 text-lg">Por favor, intente de nuevo más tarde o verifique mañana.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
