

import { db, getAllChannels } from './firebase';
import { collection, query, where, getDocs, QueryDocumentSnapshot, DocumentData, doc, updateDoc } from 'firebase/firestore';
import type { Channel, Video } from '@/types';
import { formatDuration } from './utils';
import { subHours, isAfter, isToday } from 'date-fns';

// ====== Config YouTube (usa variables de entorno si es posible) ======
const YOUTUBE_API_KEY = (process.env.NEXT_PUBLIC_YT_API_KEY || process.env.YT_API_KEY) ?? "AIzaSyC-KHsZOz99OID7Bf-ez3LD_DhIgI7j6CM";
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


// ====== YouTube: detalles del video ======
async function getVideoDetails(videoId: string): Promise<Omit<Video, 'channelInfo' | 'order'> | null> {
  if (!videoId) return null;

  const url = new URL(`${YOUTUBE_API_ENDPOINT}/videos`);
  url.searchParams.set('part', 'snippet,contentDetails,liveStreamingDetails');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', YOUTUBE_API_KEY as string);

  try {
    // Cache más fresco (1 h). Si necesitas aún más inmediatez, bájalo.
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!response.ok) {
      if (response.status === 403 || response.status === 404) {
        console.log(`Could not fetch details for video ${videoId} (status: ${response.status}). It might be private or deleted.`);
      } else {
        console.error(`YouTube API video details error for video ${videoId}: ${response.statusText}`);
      }
      return null;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    const durationISO = item.contentDetails?.duration as string | undefined;
    const duration = durationISO ? formatDuration(durationISO) : "En vivo";

    return {
      id: item.id,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt,
      duration: duration,
    };
  } catch (error) {
    console.error(`Failed to fetch details for video ${videoId}:`, error);
    return null;
  }
}

// ====== Firestore: actualización robusta del doc del canal ======
async function updateChannelVideoDetailsRobust(channel: Channel, videoDetails: Partial<Video>) {
  if (!channel || !videoDetails) return;

  // Primero intentamos con channel.id asumiendo que es el docId real:
  const tryByDocId = async () => {
    const ref = doc(db, "Misascanales", String(channel.id));
    await updateDoc(ref, {
      ultimoVideoId: videoDetails.id,
      ultimoVideoTitulo: videoDetails.title,
      ultimoVideoUrl: videoDetails.url,
      ultimoVideoThumbnail: videoDetails.thumbnail,
      ultimoVideoFechaPublicacion: videoDetails.publishedAt,
      ultimoVideoDuracion: videoDetails.duration,
    });
    console.log(`Document ${channel.id} updated successfully with video details.`);
  };

  // Fallback: buscar por campo de ID de canal (IDCanal o channelId)
  const tryByQuery = async () => {
    // Ajusta el nombre del campo según tu schema real
    const fieldNames = ["IDCanal", "channelId", "idCanal"];
    for (const field of fieldNames) {
      const q = query(collection(db, "Misascanales"), where(field, "==", channel.channelId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Usa el primer match
        const ref = snap.docs[0].ref;
        await updateDoc(ref, {
          ultimoVideoId: videoDetails.id,
          ultimoVideoTitulo: videoDetails.title,
          ultimoVideoUrl: videoDetails.url,
          ultimoVideoThumbnail: videoDetails.thumbnail,
          ultimoVideoFechaPublicacion: videoDetails.publishedAt,
          ultimoVideoDuracion: videoDetails.duration,
        });
        console.log(`Document (${field} match) updated successfully with video details.`);
        return true;
      }
    }
    return false;
  };

  try {
    await tryByDocId();
  } catch (e) {
    console.warn(`Update by docId failed for channel ${channel.channelId}. Trying by query...`, e);
    const ok = await tryByQuery();
    if (!ok) {
      console.error(`Failed to update any document for channel ${channel.channelId}. Verify schema/IDs.`);
    }
  }
}

// ====== Orquestación: actualizar todos los canales ======
export async function updateAllChannels(): Promise<string> {
  const channels = await getAllChannels();
  let updatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const jobs = channels.map(async (channel) => {
    try {
      // Se eliminó la optimización para consultar siempre el video más reciente del día.
      const channelVideos = await getChannelUploadsPlaylistItems(channel.channelId, { pageMax: 1, pageSize: 20 });
      if (channelVideos.length === 0) {
        skippedCount++;
        return;
      }

      // Filtra por keywords en título o descripción
      const candidate = filterVideoLocallyPlus(channelVideos, KEYWORDS);

      if (candidate && candidate.id) {
        // Solo actualizar si el video es diferente al que ya está guardado
        if(channel.ultimoVideoId !== candidate.id) {
            const details = await getVideoDetails(candidate.id);
            if (details) {
              await updateChannelVideoDetailsRobust(channel, details);
              updatedCount++;
            } else {
              failedCount++;
            }
        } else {
            skippedCount++;
        }
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error processing channel ${channel.channelId}:`, error);
      failedCount++;
    }
  });

  await Promise.all(jobs);

  return `Actualización: ${updatedCount} nuevos, ${skippedCount} omitidos (sin cambios), ${failedCount} fallidos.`;
}


// ====== Lectura: videos de misa del día de hoy desde Firestore ======
export async function getMassVideos(): Promise<Video[]> {
  const channels = await getAllChannels();
  const allVideos: Video[] = [];

  for (const channel of channels) {
    if (channel.ultimoVideoFechaPublicacion && channel.ultimoVideoId) {
      const publishedDate = new Date(channel.ultimoVideoFechaPublicacion);
      
      // Filtra por videos publicados hoy (día de calendario)
      if (isToday(publishedDate)) {
        const title = (channel.ultimoVideoTitulo || '').toLowerCase();
        const hasKeyword = hasAnyKeyword(title, KEYWORDS);

        if (hasKeyword) {
          allVideos.push({
            id: channel.ultimoVideoId,
            title: channel.ultimoVideoTitulo || 'Sin título',
            url: channel.ultimoVideoUrl || '',
            thumbnail: channel.ultimoVideoThumbnail || 'https://placehold.co/600x400.png',
            publishedAt: channel.ultimoVideoFechaPublicacion,
            duration: channel.ultimoVideoDuracion || 'N/D',
            order: channel.order,
            channelInfo: {
              country: channel.country,
              language: channel.language,
            },
          });
        }
      }
    }
  }

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

    
