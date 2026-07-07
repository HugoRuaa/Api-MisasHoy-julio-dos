

import { db, getAllChannels } from './firebase';
import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';
import type { Channel, Video } from '@/types';
import { formatDuration } from './utils';
import { subHours, isAfter, startOfDay, endOfDay } from 'date-fns';

// ====== Config YouTube (usa variables de entorno si es posible) ======
const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YT_API_KEY || process.env.YT_API_KEY;
const YOUTUBE_API_ENDPOINT = "https://www.googleapis.com/youtube/v3";
const KEYWORDS = ["misa", "eucaristía", "eucaristia", "mass", "masstoday", "masse", "massa", "messe", "missa", "messa"];

// ====== Utilidades de texto y filtrado ======
function normalizeText(s: string): string {
  return (s || "")
    .normalize('NFD')
    // @ts-ignore - Unicode property escapes
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  const T = normalizeText(text);
  return keywords.some(k => T.includes(normalizeText(k)));
}

// Devuelve el primer video cuyo título o descripción contenga alguna keyword
function filterVideoLocallyPlus(
  videos: Array<{ title: string; desc?: string }>,
  keywords: string[]
): any | null {
  for (const v of videos) {
    if (hasAnyKeyword(v.title, keywords) || hasAnyKeyword(v.desc || '', keywords)) {
      return v;
    }
  }
  return null;
}


// ====== YouTube: búsqueda eficiente con playlistItems.list ======
type PlaylistItem = {
  id: string;
  title: string;
  desc?: string;
  url: string;
  publishedAt: string;
};

async function getChannelUploadsPlaylistItems(channelId: string, { pageMax = 1, pageSize = 20 }: { pageMax?: number; pageSize?: number } = {}): Promise<PlaylistItem[]> {
  const trimmedChannelId = channelId?.trim();
  if (!trimmedChannelId || !trimmedChannelId.startsWith('UC')) return [];

  // Deriva el ID de la playlist de subidas. Reemplaza 'UC' por 'UU'.
  const uploadsPlaylistId = 'UU' + trimmedChannelId.substring(2);

  const base = new URL(`${YOUTUBE_API_ENDPOINT}/playlistItems`);
  base.searchParams.set('part', 'snippet');
  base.searchParams.set('playlistId', uploadsPlaylistId);
  base.searchParams.set('key', YOUTUBE_API_KEY as string);
  base.searchParams.set('maxResults', String(Math.min(pageSize, 50)));

  const allItems: PlaylistItem[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  
  // Define un límite de tiempo para solo considerar videos recientes
  const twentyFourHoursAgo = subHours(new Date(), 24);

  try {
    while (pages < pageMax) {
      const url = new URL(base.toString());
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await fetch(url.toString(), { next: { revalidate: 300 } }); // 5 min cache
      if (!response.ok) {
        // Si la playlist no se encuentra, es probable que la convención UC->UU no funcione para este canal.
        // Se registra el error y se devuelve un array vacío para no detener todo el proceso.
        if (response.status === 404) {
            console.warn(`Playlist for channel ID ${channelId} (derived as ${uploadsPlaylistId}) not found. The UC -> UU convention may not apply.`);
            return [];
        }
        const errorBody = await response.text();
        console.error(
          `YouTube API playlistItems error for playlist ${uploadsPlaylistId}: ${response.status} ${response.statusText}`,
          errorBody
        );
        break;
      }

      const data = await response.json();
      const items = (data.items || [])
        .map((item: any) => ({
            id: item.snippet?.resourceId?.videoId,
            title: item.snippet?.title ?? '',
            desc: item.snippet?.description ?? '',
            url: `https://www.youtube.com/watch?v=${item.snippet?.resourceId?.videoId}`,
            publishedAt: item.snippet?.publishedAt ?? '',
        }))
        .filter((it: any) => {
            // Filtra por videos publicados en las últimas 24 horas.
            if (!it.id || !it.publishedAt) return false;
            const publishedDate = new Date(it.publishedAt);
            return isAfter(publishedDate, twentyFourHoursAgo);
        });

      allItems.push(...items);
      
      // Si el último video de la página ya es más antiguo que 24h, no tiene sentido seguir.
      if (items.length < (data.pageInfo?.resultsPerPage || pageSize)) {
          break;
      }

      pageToken = data.nextPageToken;
      pages += 1;

      if (!pageToken) break;
    }
  } catch (error) {
    console.error(`Failed to fetch playlist items for playlist ${uploadsPlaylistId}:`, error);
  }

  return allItems;
}


// ====== YouTube: detalles de videos en lote ======
async function getVideosDetailsBatch(
  videoIds: string[]
): Promise<Map<string, Omit<Video, 'channelInfo' | 'order'>>> {
  const resultMap = new Map<string, Omit<Video, 'channelInfo' | 'order'>>();
  const uniqueIds = Array.from(new Set(videoIds)).filter(Boolean);
  if (uniqueIds.length === 0) return resultMap;

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 50) {
    chunks.push(uniqueIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const idsString = chunk.join(',');
    const url = new URL(`${YOUTUBE_API_ENDPOINT}/videos`);
    url.searchParams.set('part', 'snippet,contentDetails,liveStreamingDetails');
    url.searchParams.set('id', idsString);
    if (YOUTUBE_API_KEY) {
      url.searchParams.set('key', YOUTUBE_API_KEY);
    }

    try {
      const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!response.ok) {
        console.error(`YouTube API batch video details error: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const items = data.items || [];
      for (const item of items) {
        const durationISO = item.contentDetails?.duration as string | undefined;
        const duration = durationISO ? formatDuration(durationISO) : "En vivo";
        resultMap.set(item.id, {
          id: item.id,
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          thumbnail:
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.default?.url ||
            'https://placehold.co/600x400.png',
          publishedAt: item.snippet.publishedAt,
          duration: duration,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch batch details for videos:`, error);
    }
  }

  return resultMap;
}

// ====== Orquestación: actualizar todos los canales ======
export async function updateAllChannels(): Promise<string> {
  const channels = await getAllChannels();
  let updatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const CHUNK_SIZE = 10;
  const candidates: Array<{ channel: Channel; candidate: any }> = [];

  // Paso 1: Obtener playlists de canales con concurrencia controlada
  for (let i = 0; i < channels.length; i += CHUNK_SIZE) {
    const chunk = channels.slice(i, i + CHUNK_SIZE);
    const chunkJobs = chunk.map(async (channel) => {
      try {
        const channelVideos = await getChannelUploadsPlaylistItems(channel.channelId, { pageMax: 1, pageSize: 20 });
        if (channelVideos.length > 0) {
          const candidate = filterVideoLocallyPlus(channelVideos, KEYWORDS);
          if (candidate && candidate.id && channel.ultimoVideoId !== candidate.id) {
            candidates.push({ channel, candidate });
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing playlist for channel ${channel.channelId}:`, error);
        failedCount++;
      }
    });
    await Promise.all(chunkJobs);
  }

  // Paso 2: Consultar detalles en lote desde YouTube
  if (candidates.length > 0) {
    const candidateVideoIds = candidates.map(c => c.candidate.id);
    const detailsMap = await getVideosDetailsBatch(candidateVideoIds);

    // Paso 3: Actualizar Firestore en un lote (batch) de escritura único
    const batch = writeBatch(db);
    let batchWriteCount = 0;

    for (const { channel, candidate } of candidates) {
      const details = detailsMap.get(candidate.id);
      if (details) {
        const ref = doc(db, "Misascanales", String(channel.id));
        batch.update(ref, {
          ultimoVideoId: details.id,
          ultimoVideoTitulo: details.title,
          ultimoVideoUrl: details.url,
          ultimoVideoThumbnail: details.thumbnail,
          ultimoVideoFechaPublicacion: details.publishedAt,
          ultimoVideoDuracion: details.duration,
        });
        batchWriteCount++;
        updatedCount++;
      } else {
        failedCount++;
      }
    }

    if (batchWriteCount > 0) {
      try {
        await batch.commit();
        console.log(`Firestore batch commit successful for ${batchWriteCount} documents.`);
      } catch (error) {
        console.error("Failed to commit Firestore write batch:", error);
        failedCount += batchWriteCount;
        updatedCount -= batchWriteCount;
      }
    }
  }

  return `Actualización: ${updatedCount} nuevos, ${skippedCount} omitidos (sin cambios), ${failedCount} fallidos.`;
}

// ====== Lectura: videos de misa del día de hoy desde Firestore ======
export async function getMassVideos(): Promise<Video[]> {
  const start = startOfDay(new Date()).toISOString();
  const end = endOfDay(new Date()).toISOString();

  const q = query(
    collection(db, "Misascanales"),
    where("ultimoVideoFechaPublicacion", ">=", start),
    where("ultimoVideoFechaPublicacion", "<=", end)
  );

  const querySnapshot = await getDocs(q);
  const allVideos: Video[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.ultimoVideoId) {
      const title = (data.ultimoVideoTitulo || '').toLowerCase();
      const hasKeyword = hasAnyKeyword(title, KEYWORDS);

      if (hasKeyword) {
        allVideos.push({
          id: data.ultimoVideoId,
          title: data.ultimoVideoTitulo || 'Sin título',
          url: data.ultimoVideoUrl || '',
          thumbnail: data.ultimoVideoThumbnail || 'https://placehold.co/600x400.png',
          publishedAt: data.ultimoVideoFechaPublicacion,
          duration: data.ultimoVideoDuracion || 'N/D',
          order: data.Orden || 999,
          channelInfo: {
            country: data.pais || '',
            language: data.idioma || '',
          },
        });
      }
    }
  });

  // Eliminar duplicados de forma robusta
  const uniqueVideos = Array.from(new Map(allVideos.map(video => [video.id, video])).values());

  // Ordenar la lista final sin duplicados
  uniqueVideos.sort((a, b) => a.order - b.order);

  return uniqueVideos;
}


// ====== Utilidad: resolver nombre del canal por ID ======
export async function getChannelNameById(channelId: string): Promise<string | null> {
  const trimmedId = channelId?.trim();
  if (!trimmedId) {
    console.log('Provided channel ID is empty.');
    return null;
  }
  console.log(`Buscando el canal con ID: ${trimmedId}`);
  try {
    const q = query(collection(db, "Misascanales"), where("IDCanal", "==", trimmedId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`No se encontró ningún canal con el ID: ${trimmedId}`);
      return null;
    }

    let channelName: string | null = null;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      channelName = (data.Nombre as string) || 'Nombre no encontrado';
    });

    console.log(`El nombre del canal es: ${channelName}`);
    return channelName;
  } catch (error) {
    console.error("Error al obtener el nombre del canal desde Firebase:", error);
    return null;
  }
}
