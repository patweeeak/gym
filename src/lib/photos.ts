/*
 * Progress photos. Online: the file goes to the private `progress-photos` bucket under the member's own
 * folder (only they can read it) and the record holds its path. Offline demo: a small JPEG data URL.
 */
import { supabase } from './supabase';

const BUCKET = 'progress-photos';

/** Shrinks a picked image to at most `max` px on its long side, as JPEG. */
export async function shrinkImage(file: File, max: number, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the image.'))), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b); });

/** Stores a photo; returns what the record should keep (`path` online, `dataUrl` offline). */
export async function savePhoto(userId: string, photoId: string, file: File): Promise<{ path?: string; dataUrl?: string }> {
  if (!supabase) return { dataUrl: await toDataUrl(await shrinkImage(file, 480, 0.7)) };
  const path = `${userId}/${photoId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, await shrinkImage(file, 1280), { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return { path };
}

export async function deletePhotoFile(path?: string) {
  if (supabase && path) await supabase.storage.from(BUCKET).remove([path]);
}

const urlCache = new Map<string, { url: string; until: number }>();
/** A short-lived link to view a private photo. */
export async function photoUrl(p: { path?: string; dataUrl?: string }) {
  if (p.dataUrl) return p.dataUrl;
  if (!supabase || !p.path) return '';
  const hit = urlCache.get(p.path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p.path, 3600);
  if (data?.signedUrl) urlCache.set(p.path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data?.signedUrl ?? '';
}
