import type { SiteConfig } from "@/types/site";

export const siteConfig: SiteConfig = {
  siteUrl: "https://www.afhomes.com.ph",
  brand: {
    name: "AFhomes",
    tagline: "Amazing & Fun. Your Home Away From Home.",
    mantra: "A new way to experience hospitality.",
  },
  email: "claudmarsjimenez.afhomes@gmail.com",
  phone: "+639604316867",
  phoneDisplay: "+63 960-431-6867",
  footerEyebrow: "AFhomes",
  footerTitle: "Amazing & Fun.\nYour Home Away From Home.",
  footerNoticeTitle: "Important Notice",
  footerNoticeBody: "AFHOMES is a hospitality and resort developer and operator. It does not offer real estate investments, timeshares, club shares, or securities. Payments must be made directly to the AFhomes Finance Department through official and verified channels.",
  footerCopyright: "AFhomes Group of Companies. All rights reserved.",
  footerExploreLabel: "Explore",
  footerExperiencesLabel: "Experiences",
  footerContactLabel: "Contact",
  footerOfficesLabel: "Offices",
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
