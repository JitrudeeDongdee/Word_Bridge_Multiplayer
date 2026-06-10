/**
 * One-time cleanup script: deletes all rooms without lastActiveAt
 * Run: node scripts/cleanup-rooms.mjs
 */
import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, remove } from 'firebase/database';

// Load .env manually (no Vite here)
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      return [line.slice(0, idx).trim(), val];
    }),
);

console.log('Firebase DB URL:', env.VITE_FIREBASE_DATABASE_URL);

console.log('Firebase DB URL:', env.VITE_FIREBASE_DATABASE_URL);

try {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });

  const db = getDatabase(app);

  console.log('Fetching rooms...');
  const snapshot = await get(ref(db, 'rooms'));
  if (!snapshot.exists()) {
    console.log('No rooms found.');
    process.exit(0);
  }

  const rooms = Object.values(snapshot.val());
  const toDelete = rooms.filter((r) => r.lastActiveAt == null);

  if (toDelete.length === 0) {
    console.log('No rooms without lastActiveAt found.');
    process.exit(0);
  }

  console.log(`Found ${toDelete.length} room(s) without lastActiveAt — deleting...`);
  await Promise.all(toDelete.map((r) => remove(ref(db, `rooms/${r.id}`))));
  console.log('Done.');
} catch (err) {
  console.error('Error:', err);
}
process.exit(0);
