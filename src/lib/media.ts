import { cmsRepository } from "@/lib/cms";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export type MediaKind = "image" | "video";

export interface LocalMedia {
  id: string;
  name: string;
  storagePath: string;
  src: string;
  created: number;
  kind: MediaKind;
  altText: string;
  category: string;
  sizeBytes?: number;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const mediaMaxBytes = hasSupabaseConfig ? MAX_VIDEO_BYTES : 1024 * 1024;
export const mediaMaxLabel = hasSupabaseConfig ? "25 MB" : "1 MB";

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("afhomes-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Media storage is unavailable in this browser."));
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

function normalizeLocal(item: Partial<LocalMedia> & Pick<LocalMedia, "id" | "name" | "src" | "created" | "kind">): LocalMedia {
  return { ...item, storagePath: item.storagePath ?? item.name, altText: item.altText ?? "", category: item.category ?? "general" };
}

export async function listMedia(page: number): Promise<LocalMedia[]> {
  if (supabase) {
    const client = supabase;
    const { data: assets, error: assetError } = await client
      .from("cms_media_assets")
      .select("id,storage_path,public_url,name,media_type,alt_text,category,size_bytes,created_at")
      .order("created_at", { ascending: false })
      .range(page * 24, page * 24 + 23);
    if (!assetError) {
      return (assets ?? []).map((item) => ({
        id: String(item.id),
        name: item.name,
        storagePath: item.storage_path,
        src: item.public_url,
        created: item.created_at ? Date.parse(item.created_at) : 0,
        kind: item.media_type as MediaKind,
        altText: item.alt_text ?? "",
        category: item.category ?? "general",
        sizeBytes: item.size_bytes ?? undefined,
      }));
    }
    if (assetError.code !== "42P01" && assetError.code !== "42703") throw new Error(assetError.message);

    const { data, error } = await client.storage.from("cms-media").list("", { limit: 24, offset: page * 24, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((item) => Boolean(item.name) && item.name !== ".emptyFolderPlaceholder")
      .map((item) => {
        const name = item.name;
        const kind = /\.(?:mp4|webm|mov)$/i.test(name) ? "video" : "image";
        return { id: item.id ?? name, name, storagePath: name, src: client.storage.from("cms-media").getPublicUrl(name).data.publicUrl, created: item.created_at ? Date.parse(item.created_at) : 0, kind, altText: "", category: "general" };
      });
  }

  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("images").objectStore("images").getAll();
      request.onsuccess = () => resolve((request.result as LocalMedia[]).map(normalizeLocal).sort((a, b) => b.created - a.created).slice(page * 24, page * 24 + 24));
      request.onerror = () => reject(new Error("Unable to read the media library."));
    });
  } finally { db.close(); }
}

export async function uploadMedia(file: File, metadata: { category?: string; altText?: string } = {}): Promise<string> {
  assertMedia(file);
  const kind = detectKind(file);
  if (supabase) {
    const client = supabase;
    const path = `${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error } = await client.storage.from("cms-media").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    const publicUrl = client.storage.from("cms-media").getPublicUrl(path).data.publicUrl;
    let assetResult = await client.from("cms_media_assets").insert({ storage_path: path, public_url: publicUrl, name: file.name, media_type: kind, size_bytes: file.size, alt_text: metadata.altText ?? "", category: metadata.category ?? "general" });
    if (assetResult.error?.code === "PGRST204" || assetResult.error?.code === "42703") assetResult = await client.from("cms_media_assets").insert({ storage_path: path, public_url: publicUrl, name: file.name, media_type: kind, size_bytes: file.size, alt_text: metadata.altText ?? "" });
    const assetError = assetResult.error;
    if (assetError && assetError.code !== "42P01") {
      await client.storage.from("cms-media").remove([path]);
      throw new Error(assetError.message);
    }
    return publicUrl;
  }

  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Unable to read this ${kind}.`));
    reader.readAsDataURL(file);
  });
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      transaction.objectStore("images").add({ id: crypto.randomUUID(), name: file.name, storagePath: file.name, src, created: Date.now(), kind, altText: metadata.altText ?? "", category: metadata.category ?? "general", sizeBytes: file.size });
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("Media storage is full or unavailable."));
    });
  } finally { db.close(); }
  return src;
}

export async function uploadImage(file: File): Promise<string> {
  if (detectKind(file) === "video") throw new Error("Use the upload media action for videos.");
  return uploadMedia(file);
}

function containsMedia(value: unknown, src: string): boolean {
  if (value === src) return true;
  if (Array.isArray(value)) return value.some((item) => containsMedia(item, src));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsMedia(item, src));
  return false;
}

export async function mediaUsage(file: Pick<LocalMedia, "src">): Promise<string[]> {
  const usages: string[] = [];
  const documents: Array<[string, unknown]> = [
    ["Site settings", cmsRepository.getSiteConfig()],
    ["Website page content", cmsRepository.getPageContent()],
    ["Rooms / experiences", cmsRepository.getAllExperiences()],
    ["VIP plans", cmsRepository.getAllVipPlans()],
    ["Stories", cmsRepository.getAllStories()],
    ["Page media", cmsRepository.getMediaBlocks()],
  ];
  for (const [label, value] of documents) if (containsMedia(value, file.src)) usages.push(label);
  if (supabase) {
    const { data: sections, error } = await supabase.from("cms_page_sections").select("page_id,content");
    if (!error && sections) {
      const pageIds = [...new Set(sections.filter((section) => containsMedia(section.content, file.src)).map((section) => section.page_id))];
      if (pageIds.length) {
        const { data: pages } = await supabase.from("cms_pages").select("id,title").in("id", pageIds);
        for (const page of pages ?? []) usages.push(`Page: ${page.title}`);
      }
    }
  }
  return [...new Set(usages)];
}

export async function updateMediaMetadata(file: Pick<LocalMedia, "id">, metadata: { altText: string; category: string }): Promise<void> {
  if (supabase) {
    let result = await supabase.from("cms_media_assets").update({ alt_text: metadata.altText, category: metadata.category, updated_at: new Date().toISOString() }).eq("id", file.id);
    if (result.error?.code === "PGRST204" || result.error?.code === "42703") result = await supabase.from("cms_media_assets").update({ alt_text: metadata.altText, updated_at: new Date().toISOString() }).eq("id", file.id);
    const { error } = result;
    if (error) throw new Error(error.message);
    return;
  }
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");
      const request = store.get(file.id);
      request.onsuccess = () => { if (request.result) store.put({ ...request.result, ...metadata }); };
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("Unable to update media details."));
    });
  } finally { db.close(); }
}

export async function deleteMedia(file: Pick<LocalMedia, "id" | "name" | "storagePath" | "src">): Promise<void> {
  const usages = await mediaUsage(file);
  if (usages.length) throw new Error(`This file is still used in ${usages.join(", ")}. Replace it there before deleting it.`);
  if (supabase) {
    const { error } = await supabase.storage.from("cms-media").remove([file.storagePath]);
    if (error) throw new Error(error.message);
    const { error: assetError } = await supabase.from("cms_media_assets").delete().eq("storage_path", file.storagePath);
    if (assetError && assetError.code !== "42P01") throw new Error(`File deleted, but its library record could not be removed: ${assetError.message}`);
    return;
  }
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      transaction.objectStore("images").delete(file.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("Unable to delete this media file."));
    });
  } finally { db.close(); }
}
