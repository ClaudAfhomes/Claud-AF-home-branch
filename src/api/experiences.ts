import { apiClient, isApiEnabled } from "./client";
import { mockRead } from "@/lib/mock";
import type { Experience } from "@/types/experience";
import { experiences, getExperienceBySlug } from "@/data/mock/experiences";

/**
 * Experience API — conceptual contract:
 *   GET /api/experiences
 *   GET /api/experiences/:slug
 * When VITE_API_BASE_URL is set, requests go to the live API. Otherwise the
 * local mock repository is used.
 */
export const experiencesApi = {
  getExperiences(): Promise<Experience[]> {
    if (isApiEnabled) return apiClient.get<Experience[]>("/api/experiences");
    return mockRead(() => [...experiences]);
  },
  getExperienceBySlug(slug: string): Promise<Experience | undefined> {
    if (isApiEnabled) return apiClient.get<Experience>(`/api/experiences/${slug}`);
    return mockRead(() => getExperienceBySlug(slug), 250);
  },
};