
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Calendar, Clock, Globe, Languages, ListOrdered } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Video } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';

interface VideoCardProps {
  video: Video;
}

export default function VideoCard({ video }: VideoCardProps) {
  const [formattedDate, setFormattedDate] = useState<string | null>(null);

  useEffect(() => {
    if (video.publishedAt) {
      // Corrige la fecha para compensar la zona horaria del cliente y mostrar la fecha UTC correcta.
      const utcDate = new Date(video.publishedAt);
      const correctedDate = new Date(utcDate.valueOf() + utcDate.getTimezoneOffset() * 60 * 1000);
      setFormattedDate(format(correctedDate, 'PPP', { locale: es }));
    }
  }, [video.publishedAt]);
  
  const embedUrl = `https://www.youtube.com/embed/${video.id}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="group cursor-pointer">
          <Card className="h-full flex flex-col transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:-translate-y-1 bg-card">
            <CardHeader className="p-0">
              <div className="relative aspect-video w-full">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover rounded-t-lg"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  data-ai-hint="religious broadcast"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-grow p-4">
              <div className="font-headline text-lg leading-tight mb-2 group-hover:text-primary">
                {video.title}
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  {formattedDate ? (
                    <span>{formattedDate}</span>
                  ) : (
                    <Skeleton className="h-4 w-24" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  <span>{video.duration}</span>
                </div>
              </div>
            </CardContent>
            {(video.order !== 999 || video.channelInfo) && (
              <CardFooter className="p-4 pt-0 flex flex-wrap gap-2 items-center">
                {video.order !== 999 && (
                    <Badge variant="secondary" className="flex items-center gap-1.5">
                        <ListOrdered className="h-3 w-3" />
                        {video.order}
                    </Badge>
                )}
                {video.channelInfo && (
                  <>
                    <Badge variant="outline" className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3" />
                      {video.channelInfo.country}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1.5">
                      <Languages className="h-3 w-3" />
                      {video.channelInfo.language}
                    </Badge>
                  </>
                )}
              </CardFooter>
            )}
          </Card>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader>
          <DialogTitle className="sr-only">{video.title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video">
          <iframe
            src={embedUrl}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full rounded-lg"
          ></iframe>
        </div>
      </DialogContent>
    </Dialog>
  );
}
