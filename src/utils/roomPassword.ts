/**
 * Room join passwords (soft lock): only a salted SHA-256 hash is stored on the room.
 * Rooms are readable by anyone, so this stops people joining through the game UI,
 * not someone writing to the database directly.
 */

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newPasswordSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export async function hashRoomPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

export async function checkRoomPassword(password: string, salt: string, hash: string): Promise<boolean> {
  return (await hashRoomPassword(password, salt)) === hash;
}
