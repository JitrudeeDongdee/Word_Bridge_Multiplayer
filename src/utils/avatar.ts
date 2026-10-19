/** Avatar edge in pixels: small enough to keep in the database (~10 KB as JPEG). */
export const AVATAR_SIZE = 128;

/** Center-crop and scale a picked image to a square JPEG data URL. */
export async function resizeToAvatar(file: File, size = AVATAR_SIZE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Initials for the placeholder avatar ("Word Bridge" → "WB"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}
