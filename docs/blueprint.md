# **App Name**: Misa del Día

## Core Features:

- Firebase Connection: Connect to Firebase with the provided API key and configuration details.
- Access Firebase Collection: Access the 'Misascanales' collection within the Firebase database.
- Fetch Channel IDs: For each document, use the 'IDCanal' field (YouTube channel ID) to query the YouTube API.
- YouTube API Connection: Connect to YouTube with the provided API key. Then construct the url using the endpoint 'https://www.googleapis.com/youtube/v3/search'.
- Filter Today's Videos: Use a tool to fetch videos uploaded today that contain keywords like 'misa', 'eucaristía', 'mass', etc. and filter for the first relevant video.
- Video Information Display: Display the URL, title, upload date, and duration of the filtered video.

## Style Guidelines:

- Primary color: A warm, inviting gold (#FFD700) to represent the sacred nature of the content.
- Background color: A light, desaturated beige (#F5F5DC) to provide a calm viewing experience.
- Accent color: A deep, calming blue (#4682B4) to add contrast and visual interest.
- Headline font: 'Alegreya', a serif (if available) for a contemporary, elegant feel.
- Body font: 'PT Sans', a sans-serif to provide good readability.
- Use simple, elegant icons to represent video details like duration and upload date.
- Clean and focused layout that directs the user’s attention to video content.