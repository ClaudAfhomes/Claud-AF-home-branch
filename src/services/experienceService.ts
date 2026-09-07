import { experiencesApi } from "@/api/experiences";
import type { Experience } from "@/types/experience";

export const experienceService = {
  getExperiences(): Promise<Experience[]> {
    return experiencesApi.getExperiences();
  },
  getExperienceBySlug(slug: string): Promise<Experience | undefined> {
    return experiencesApi.getExperienceBySlug(slug);
  },
};