import type { SiteConfig } from "@/types/site";

export const siteConfig: SiteConfig = {
  siteUrl: "https://www.afhomes.com.ph",
  brand: {
    name: "AFhomes",
    tagline: "Amazing & Fun. Your Home Away From Home.",
    mantra: "A new way to experience hospitality.",
  },
  email: "info@afhomes.com.ph",
  phone: "+639604316867",
  phoneDisplay: "+63 960-431-6867",
  offices: [
    {
      name: "AFhomes ALM Operations",
      role: "Satellite Office",
      lines: [
        "Alaminos Commercial Complex, Maharlika Road,",
        "Brgy. San Juan, Alaminos, Laguna.",
        "Units 106F and 201–207",
        "Landmark: Puregold, Alaminos",
      ],
    },
    {
      name: "AFhomes Hotspring & Ecofarm Resort Corp.",
      role: "Head Office",
      lines: ["Brgy. Perez, Calauan, Laguna", "4012"],
    },
  ],
  nav: {
    main: [
      { label: "Home", path: "/" },
      { label: "Experiences", path: "/experiences" },
      { label: "VIP Privilege", path: "/vip" },
      { label: "About", path: "/about" },
      { label: "Stories & Insights", path: "/stories" },
      { label: "FAQ", path: "/faq" },
      { label: "Contact", path: "/contact" },
    ],
    experiences: [
      {
        label: "Smart Wellness Hotel",
        path: "/experiences/smart-wellness-hotel",
        description: "Grand Opening — November 2026",
      },
      {
        label: "ALM Japanese Restaurant",
        path: "/experiences/alm-japanese-restaurant",
        description: "Now Open",
      },
      {
        label: "Hotspring & Ecofarm Resort",
        path: "/experiences/hotspring-ecofarm-resort",
        description: "In Development",
      },
    ],
  },
};