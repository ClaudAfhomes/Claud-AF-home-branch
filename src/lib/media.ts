import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export type MediaKind = "image" | "video";

export interface LocalMedia { id: string; name: string; src: string; created: number; kind: MediaKind }
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const mediaMaxBytes = hasSupabaseConfig ? MAX_VIDEO_BYTES : 1024 * 1024;
export const mediaMaxLabel = hasSupabaseConfig ? "25 MB" : "1 MB";

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("afhomes-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Image storage is unavailable in this browser."));
  });
}

function detectKind(file: File): MediaKind {
  return file.type.startsWith("video/") ? "video" : "image";
}

function assertMedia(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Choose an image or video file: JPEG, PNG, WebP, GIF, MP4, WebM, or MOV.");
  const limit = detectKind(file) === "video" ? MAX_VIDEO_BYTES : mediaMaxBytes;
  if (file.size > limit) throw new Error(`Files must be ${detectKind(file) === "video" ? "25 MB" : mediaMaxLabel} or smaller.`);
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/quicktime") return "mov";
  return "jpg";
}

export async function listMedia(page: number): Promise<LocalMedia[]> {
  if (supabase) {
    const client = supabase;
    const { data, error } = await client.storage.from("cms-media").list("", {
      limit: 24,
      offset: page * 24,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((item) => Boolean(item.name) && item.name !== ".emptyFolderPlaceholder")
      .map((item) => {
        const name = item.name;
        const type = name.toLowerCase().endsWith(".mp4") || name.toLowerCase().endsWith(".webm") || name.toLowerCase().endsWith(".mov") ? "video" : "image";
        return {
          id: item.id ?? name,
          name,
          src: client.storage.from("cms-media").getPublicUrl(name).data.publicUrl,
          created: item.created_at ? Date.parse(item.created_at) : 0,
          kind: type,
        };
      });
  }

  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("images").objectStore("images").getAll();
      request.onsuccess = () => resolve((request.result as LocalMedia[]).sort((a, b) => b.created - a.created).slice(page * 24, page * 24 + 24));
      request.onerror = () => reject(new Error("Unable to read the image library."));
    });
  } finally { db.close(); }
}

export async function uploadMedia(file: File): Promise<string> {
  assertMedia(file);
  const kind = detectKind(file);

  if (supabase) {
    const client = supabase;
    const path = `${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error } = await client.storage.from("cms-media").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return client.storage.from("cms-media").getPublicUrl(path).data.publicUrl;
  }

  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Unable to read this ${kind}.`));
    if (kind === "video") {
      reader.readAsDataURL(file);
      return;
    }
    reader.readAsDataURL(file);
  });
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      transaction.objectStore("images").add({ id: crypto.randomUUID(), name: file.name, src, created: Date.now(), kind });
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("Media storage is full or unavailable."));
    });
  } finally { db.close(); }
  return src;
}

export async function uploadImage(file: File): Promise<string> {
  if (detectKind(file) === "video") {
    throw new Error("Use the upload media action for videos.");
  }
  return uploadMedia(file);
}
