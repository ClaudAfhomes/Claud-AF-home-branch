import { apiClient, isApiEnabled } from "./client";
import { mockRead } from "@/lib/mock";
import type { VipPlan } from "@/types/vip";
import { vipPlans } from "@/data/mock/vip";

/**
 * VIP API — conceptual contract:
 *   GET /api/vip/plans
 */
export const vipApi = {
  getPlans(): Promise<VipPlan[]> {
    if (isApiEnabled) return apiClient.get<VipPlan[]>("/api/vip/plans");
    return mockRead(() => [...vipPlans]);
  },
};