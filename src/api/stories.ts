import { apiClient, isApiEnabled } from "./client";
import { mockRead } from "@/lib/mock";
import type { Story } from "@/types/story";
import { stories, getStoryBySlug, getStoryCategories } from "@/data/mock/stories";

/**
 * Stories API — conceptual contract:
 *   GET /api/stories
 *   GET /api/stories/:slug
 * Search and category filtering are performed client-side in the UI.
 */
export const storiesApi = {
  getStories(): Promise<Story[]> {
    if (isApiEnabled) return apiClient.get<Story[]>("/api/stories");
    return mockRead(() => [...stories]);
  },
  getStoryBySlug(slug: string): Promise<Story | undefined> {
    if (isApiEnabled) return apiClient.get<Story>(`/api/stories/${slug}`);
    return mockRead(() => getStoryBySlug(slug), 250);
  },
  getCategories(): Promise<string[]> {
    if (isApiEnabled) return apiClient.get<string[]>("/api/stories/categories");
    return mockRead(() => getStoryCategories(), 150);
  },
};