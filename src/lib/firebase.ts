
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import type { Channel } from '@/types';

// WARNING: It is strongly recommended to use environment variables for your Firebase config.
// Hardcoding credentials is not secure.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAXalpYqfPd0RSDq0suAvfSbka6AEVY_LI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "canalestv-7a89a.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "canalestv-7a89a",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "canalestv-7a89a.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "440090852573",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:440090852573:web:82c845a934dab773e7af34",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-JS1JCTW73C"
};

let app;
// Prevent reinitialization on hot reloads
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

export async function getAllChannels(): Promise<Channel[]> {
  try {
    const channelsCollection = collection(db, "Misascanales");
    const snapshot = await getDocs(channelsCollection);
    if (snapshot.empty) {
      console.log("No channels found in 'Misascanales' collection.");
      return [];
    }
    const channels: Channel[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        channelId: data.IDCanal || '',
        name: data.Nombre,
        continent: data.continente,
        language: data.idioma,
        country: data.pais,
        order: data.Orden || 999,
        ultimoVideoId: data.ultimoVideoId,
        ultimoVideoTitulo: data.ultimoVideoTitulo,
        ultimoVideoUrl: data.ultimoVideoUrl,
        ultimoVideoThumbnail: data.ultimoVideoThumbnail,
        ultimoVideoFechaPublicacion: data.ultimoVideoFechaPublicacion,
        ultimoVideoDuracion: data.ultimoVideoDuracion,
      };
    });
    return channels;
  } catch (error) {
    console.error("Error fetching channels from Firebase:", error);
    return [];
  }
}

export { db };
