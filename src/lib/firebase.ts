
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import type { Channel } from '@/types';

// WARNING: It is strongly recommended to use environment variables for your Firebase config.
// Hardcoding credentials is not secure.
const firebaseConfig = {
  apiKey: "AIzaSyAXalpYqfPd0RSDq0suAvfSbka6AEVY_LI",
  authDomain: "canalestv-7a89a.firebaseapp.com",
  projectId: "canalestv-7a89a",
  storageBucket: "canalestv-7a89a.appspot.com",
  messagingSenderId: "440090852573",
  appId: "1:440090852573:web:82c845a934dab773e7af34",
  measurementId: "G-JS1JCTW73C"
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
