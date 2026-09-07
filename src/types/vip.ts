export type VipTierId = "gold" | "silver" | "bronze";

export interface VipPlan {
  id: VipTierId;
  name: string;
  discountPercent: number;
  validityYears: number;
  pointsPerYear: number;
  totalPoints: number;
  cardholders: string;
  benefits: string[];
  accentText: string;
  accentBg: string;
  featured?: boolean;
}