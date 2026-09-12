import { z } from "zod";

const text = z.string().trim().min(1, "Required").max(20000);
const optionalText = z.string().max(20000);
const link = z.string().regex(/^(?:\/(?![\/\\])[^\\\s]*|https?:\/\/[^\s]+)$/, "Use a local path or an http(s) URL");
const image = z.object({ src: z.string().regex(/^(?:|\/(?![\/\\])[^\\\s]*|https?:\/\/[^\s]+|data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/, "Upload an image or use an http(s) URL"), alt: optionalText });
const mediaSource = z.string().regex(/^(?:https?:\/\/[^\s]+|data:(?:image\/(?:png|jpeg|webp|gif)|video\/(?:mp4|webm|quicktime));base64,[A-Za-z0-9+/=]+)$/, "Upload media or use an http(s) URL");
const externalUrl = z.string().url().regex(/^https?:\/\//, "Use an http(s) URL");
const flags = { archived: z.boolean().optional(), featured: z.boolean().optional() };
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens");
const nav = z.object({ label: text, path: link, description: optionalText.optional() });
const socialLink = z.object({
  id: text,
  label: text,
  platform: z.enum(["facebook", "instagram", "youtube", "other"]),
  url: externalUrl,
  enabled: z.boolean(),
  sortOrder: z.number().int().nonnegative().max(1000),
});
const seoImage = image;
const globalSeo = z.object({
  siteTitle: text,
  titleTemplate: text,
  metaDescription: text.max(320),
  keywords: z.array(text.max(80)).max(30),
  canonicalSiteUrl: externalUrl,
  defaultSocialImage: seoImage,
  favicon: seoImage,
});
const pageSeo = z.object({
  path: z.string().regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/, "Choose a valid website page"),
  slug: optionalText,
  seoTitle: optionalText.max(200),
  metaDescription: optionalText.max(500),
  openGraphTitle: optionalText.max(200),
  openGraphDescription: optionalText.max(500),
  openGraphImage: seoImage,
});
const story = z.object({ id: text, slug, title: text, category: text, date: text, excerpt: text, content: z.array(text).min(1), cover: image, ...flags });
const experience = z.object({ id: text, slug, name: text, shortName: text, actionLabel: text, status: z.enum(["open", "opening-soon", "in-development"]), statusLabel: text, location: text, openingDate: optionalText.optional(), headline: text, summary: text, description: text, highlights: z.array(text), theme: z.enum(["culinary", "wellness", "nature"]), accent: text, image, ...flags });
const count = z.number().int().nonnegative().max(100000000);
const vip = z.object({ id: text, name: text, discountPercent: z.number().min(0).max(100), validityYears: z.number().int().min(1).max(100), pointsPerYear: count, totalPoints: count, cardholders: text, benefits: z.array(text), accentText: text, accentBg: text, image: image.optional(), ...flags });
function unique<T extends { id: string; slug?: string }>(items: T[]) {
  return new Set(items.map((item) => item.id)).size === items.length && new Set(items.map((item) => item.slug ?? item.id)).size === items.length;
}
const heading = { eyebrow: text, title: text, lede: text };
const mediaBlocks = z.array(z.object({
  id: text,
  page: z.string().regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/, "Choose a valid website page"),
  placement: z.enum(["page-background", "before-page", "after-page"]),
  kind: z.enum(["image", "video"]),
  src: mediaSource,
  alt: optionalText,
  caption: optionalText,
  width: z.enum(["content", "wide", "full"]),
  fit: z.enum(["cover", "contain"]),
  position: z.enum(["center", "top", "bottom"]).optional(),
  overlay: z.enum(["light", "medium", "strong"]).optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
})).refine(unique, "Media section IDs must be unique");
export const documentSchemas = {
  site: z.object({ siteUrl: z.string().url().regex(/^https?:\/\//), businessName: text.optional().default("AFhomes Hotspring & Ecofarm Resort Corp."), brand: z.object({ name: text, tagline: text, mantra: text }), logo: image.optional(), social: z.object({ facebookCorporate: externalUrl, facebookResort: externalUrl, youtube: externalUrl, instagram: externalUrl }).default({ facebookCorporate: "https://www.facebook.com/profile.php?id=61578604593811", facebookResort: "https://www.facebook.com/AFHomes.Hotspring.and.Ecofarm.Resort", youtube: "https://www.youtube.com/@AFHomesHotspringEcofarmResort", instagram: "https://www.instagram.com/afhomeshotspringresort/" }), socialLinks: z.array(socialLink).max(30).optional().default([{ id: "facebook-corporate", label: "Facebook", platform: "facebook", url: "https://www.facebook.com/profile.php?id=61578604593811", enabled: true, sortOrder: 0 }, { id: "facebook-resort", label: "Hotspring & Ecofarm", platform: "facebook", url: "https://www.facebook.com/AFHomes.Hotspring.and.Ecofarm.Resort", enabled: true, sortOrder: 1 }, { id: "youtube", label: "YouTube", platform: "youtube", url: "https://www.youtube.com/@AFHomesHotspringEcofarmResort", enabled: true, sortOrder: 2 }, { id: "instagram", label: "Instagram", platform: "instagram", url: "https://www.instagram.com/afhomeshotspringresort/", enabled: true, sortOrder: 3 }]), seo: globalSeo.optional().default({ siteTitle: "AFhomes — Amazing & Fun. Your Home Away From Home.", titleTemplate: "%s — AFhomes", metaDescription: "Hospitality, wellness, dining, nature and experiences in Laguna, Philippines.", keywords: ["AFhomes", "Laguna resort", "wellness hotel", "hotspring resort", "Japanese restaurant"], canonicalSiteUrl: "https://www.afhomes.com.ph", defaultSocialImage: { src: "", alt: "AFhomes hospitality and wellness experiences in Laguna" }, favicon: { src: "/logo.png", alt: "AFhomes favicon" } }), pageSeo: z.array(pageSeo).max(100).optional().default([]), email: z.string().email(), phone: text, phoneDisplay: text, footerEyebrow: text.optional().default("AFhomes"), footerTitle: text.optional().default("Amazing & Fun.\nYour Home Away From Home."), footerNoticeTitle: text.optional().default("Important Notice"), footerNoticeBody: text.optional().default("AFHOMES is a hospitality and resort developer and operator. Payments must use official channels."), footerCopyright: text.optional().default("AFhomes Group of Companies. All rights reserved."), footerExploreLabel: text.optional().default("Explore"), footerExperiencesLabel: text.optional().default("Experiences"), footerContactLabel: text.optional().default("Contact"), footerOfficesLabel: text.optional().default("Offices"), offices: z.array(z.object({ name: text, role: text, lines: z.array(text), mapUrl: externalUrl.optional() })), nav: z.object({ main: z.array(nav), experiences: z.array(nav) }) }),
  experiences: z.array(experience).refine(unique, "IDs and URL slugs must be unique"),
  vip: z.array(vip).refine(unique, "IDs must be unique"),
  faq: z.array(z.object({ id: text, label: text, archived: z.boolean().optional(), items: z.array(z.object({ question: text, answer: text, archived: z.boolean().optional() })) })).refine(unique, "IDs must be unique"),
  stories: z.array(story).refine(unique, "IDs and URL slugs must be unique"),
  mediaBlocks,
  pageContent: z.object({
    home: z.object({
      heroTitle: text,
      heroLede: text,
      heroBadge: text,
      heroPrimaryCta: text,
      heroSecondaryCta: text,
      brandTitle: text,
      brandLede: text,
      brandEyebrow: text,
      brandImage: image,
      brandHighlights: z.array(z.object({ label: text, value: text })),
      brandQuote: text,
      whyTitle: text,
      whyLede: text,
      whyPillars: z.array(z.object({ title: text, body: text })),
      ecosystemEyebrow: text,
      ecosystemTitle: text,
      ecosystemLede: text,
      smartWellnessEyebrow: text,
      smartWellnessTitle: text,
      smartWellnessLede: text,
      smartWellnessRooms: z.array(z.object({ value: text, label: text })),
      smartWellnessStatus: text,
      smartWellnessButton: text,
      smartWellnessFeatures: z.array(z.object({ title: text, line: text })),
      almEyebrow: text,
      almTitle: text,
      almLede: text,
      almStatus: text,
      almBadge: text,
      almButton: text,
      almFeatures: z.array(z.object({ label: text, note: text })),
      almImageNote: text,
      hotspringEyebrow: text,
      hotspringTitle: text,
      hotspringLede: text,
      hotspringStats: z.array(z.object({ value: z.number().int().nonnegative(), label: text, suffix: z.string().optional() })),
      hotspringFeatures: z.array(text),
      hotspringStatus: text,
      hotspringButton: text,
      journeyEyebrow: text,
      journeyTitle: text,
      journeyLede: text,
      journeyMilestones: z.array(z.object({ phase: text, name: text, note: text, ghost: text, accent: text, ring: text, text: text, line: text })),
      vipTeaserEyebrow: text,
      vipTeaserTitle: text,
      vipTeaserLede: text,
      vipTeaserButton: text,
      ctaEyebrow: text,
      ctaTitle: text,
      ctaLede: text,
      ctaPrimaryCta: text,
      ctaSecondaryCta: text,
    }),
    about: z.object({ ...heading, image, vision: text, mission: text, introEyebrow: text, introTitle: text, introLede: text, philosophyTitle: text, philosophyBody: text, stats: z.array(z.object({ value: text, label: text })), modelEyebrow: text, modelTitle: text, modelLede: text, modelBody: text, modelChapters: z.array(z.object({ number: text, title: text, body: text })), operationsEyebrow: text, operationsTitle: text, operationsCallout: text, operationsTitleSecondary: text, operationsLede: text, familyHeading: text, familyLede: text, familyButton: text }),
    compliance: z.object({ ...heading, commitmentTitle: text, commitmentLede: text, notInvestment: text, verifiedPayments: text, privacy: text, terms: text }),
    faq: z.object({ ...heading, browseTitle: text, contactPrompt: text, stillCuriousTitle: text, stillCuriousLede: text, stillCuriousButton: text }),
    contact: z.object({ ...heading, emailLabel: text, phoneLabel: text, formTitle: text, formLede: text, quickAnswerTitle: text, quickAnswerLede: text, quickAnswerButton: text }),
    experiences: z.object({ ...heading, image }), vip: z.object({ ...heading, tierEyebrow: text, tierTitle: text, tierLede: text, steps: z.array(z.object({ number: text, title: text, body: text })), includedEyebrow: text, includedTitle: text, includedLede: text, includedButton: text, includedItems: z.array(z.object({ title: text, body: text })).min(1).optional().default([{ title: "Free entrance for the cardholder", body: "Walk into the AFhomes experience with the entrance fee waived for the named cardholder." }, { title: "Priority reservation rights", body: "Book ahead with priority across AFhomes reservations." }, { title: "Annual welcome gift", body: "A small gift each year, our way of welcoming you back." }]), transparencyEyebrow: text, transparencyTitle: text, transparencyLede: text, transparencyButton: text, transparencyCards: z.array(z.object({ title: text, body: text })).min(1).optional().default([{ title: "A loyalty program, not an investment", body: "AFHOMES is a hospitality and resort developer and operator. The VIP Privilege Program grants loyalty privileges and discounts only." }, { title: "Payments & official channels", body: "Payments must be made directly to the AFhomes Finance Department through official and verified channels." }]) }), stories: z.object({ ...heading, image }),
  }),
};
export type DocumentKey = keyof typeof documentSchemas;
export const documentKeys = Object.keys(documentSchemas) as DocumentKey[];
export function validateDocument(key: DocumentKey, value: unknown) {
  const result = documentSchemas[key].safeParse(value);
  if (!result.success) throw new Error(result.error.issues.map((issue) => `${key}.${issue.path.join(".")}: ${issue.message}`).slice(0, 6).join("\n"));
  return result.data;
}
export const backupSchema = z.object({ format: z.literal("afhomes-cms"), version: z.literal(1), createdAt: z.string(), documents: z.object({ ...documentSchemas, mediaBlocks: mediaBlocks.optional().default([]) }) });
