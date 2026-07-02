
export interface Channel {
  id: string;
  channelId: string;
  name?: string;
  continent: string;
  language: string;
  country: string;
  order: number;
  ultimoVideoId?: string;
  ultimoVideoTitulo?: string;
  ultimoVideoUrl?: string;
  ultimoVideoThumbnail?: string;
  ultimoVideoFechaPublicacion?: string;
  ultimoVideoDuracion?: string;
}

export interface Video {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  order: number;
  channelInfo?: {
    country: string;
    language: string;
  };
}

    