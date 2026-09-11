import type { Story } from "@/types/story";

export function isStoryBackup(value: unknown): value is Story[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const slugs = new Set<string>();
  return value.every((item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const story = item as Record<string, unknown>;
    for (const key of ["id", "slug", "title", "category", "date", "excerpt"]) {
      if (typeof story[key] !== "string") return false;
    }
    const id = story.id as string;
    const slug = story.slug as string;
    if (!id.trim() || !slug.trim() || ids.has(id) || slugs.has(slug)) return false;
    ids.add(id);
    slugs.add(slug);
    if (!Array.isArray(story.content) || !story.content.every((text: unknown) => typeof text === "string")) return false;
    if (!story.cover || typeof story.cover !== "object") return false;
    const cover = story.cover as Record<string, unknown>;
    if (typeof cover.src !== "string" || typeof cover.alt !== "string") return false;
    return ["featured", "archived"].every((key) => story[key] === undefined || typeof story[key] === "boolean");
  });
}
