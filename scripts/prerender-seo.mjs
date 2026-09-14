import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = new URL("../dist/", import.meta.url);
const indexPath = new URL("index.html", outputDirectory);
const baseHtml = await readFile(indexPath, "utf8");

const defaults = {
  siteTitle: "AFhomes — Amazing & Fun. Your Home Away From Home.",
  titleTemplate: "%s — AFhomes",
  metaDescription: "Hospitality, wellness, dining, nature and experiences in Laguna, Philippines.",
  canonicalSiteUrl: "https://www.afhomes.com.ph",
  defaultSocialImage: { src: "" },
};

const routes = [
  ["/", "AFhomes", defaults.metaDescription],
  ["/about", "About AFhomes", "Learn about AFhomes and our approach to thoughtful hospitality, wellness and responsible destination development."],
  ["/experiences", "Experiences", "Explore AFhomes resort, wellness, dining and nature experiences in Laguna, Philippines."],
  ["/experiences/smart-wellness-hotel", "Smart Wellness Hotel", "Discover an upscale AFhomes stay shaped around restorative rest, wellness and thoughtful technology."],
  ["/experiences/alm-japanese-restaurant", "ALM Japanese Restaurant", "Discover refined Japanese dining and warm AFhomes hospitality at ALM Japanese Restaurant."],
  ["/experiences/hotspring-ecofarm-resort", "Hotspring & Ecofarm Resort", "Explore the vision for AFhomes Hotspring & Ecofarm Resort in Calauan, Laguna."],
  ["/vip", "VIP Privilege", "Explore AFhomes VIP Privilege membership levels, benefits and resort-wide experiences."],
  ["/stories", "Stories & Insights", "Read the latest AFhomes stories and insights about hospitality, wellness, dining and responsible development."],
  ["/faq", "Frequently Asked Questions", "Find answers about AFhomes experiences, reservations, VIP privileges, payments and development."],
  ["/compliance", "Compliance", "Review AFhomes regulatory milestones and commitment to responsible hospitality development."],
  ["/contact", "Contact AFhomes", "Contact the AFhomes team about resort, wellness, dining, VIP and reservation inquiries."],
];

async function loadCmsSite() {
  const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return undefined;
  try {
    const response = await fetch(`${url}/rest/v1/cms_documents?key=eq.site&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    return rows[0]?.value;
  } catch (error) {
    console.warn(`SEO prerender used safe defaults because CMS data was unavailable: ${error.message}`);
    return undefined;
  }
}

const site = await loadCmsSite();
const globalSeo = { ...defaults, ...(site?.seo ?? {}) };
const pageSeo = Array.isArray(site?.pageSeo) ? site.pageSeo : [];
const baseUrl = globalSeo.canonicalSiteUrl.replace(/\/$/, "");
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const absolute = (value) => value ? new URL(value, `${baseUrl}/`).href : "";
const titleFor = (title) => globalSeo.titleTemplate.includes("%s")
  ? globalSeo.titleTemplate.replace("%s", title)
  : `${title} — ${globalSeo.siteTitle}`;

function replaceTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

for (const [path, fallbackTitle, fallbackDescription] of routes) {
  const saved = pageSeo.find((item) => item.path === path);
  const title = path === "/" && !saved?.seoTitle ? globalSeo.siteTitle : titleFor(saved?.seoTitle || fallbackTitle);
  const description = saved?.metaDescription || fallbackDescription || globalSeo.metaDescription;
  const canonical = `${baseUrl}${path === "/" ? "/" : path}`;
  const socialTitle = saved?.openGraphTitle || title;
  const socialDescription = saved?.openGraphDescription || description;
  const socialImage = absolute(saved?.openGraphImage?.src || globalSeo.defaultSocialImage?.src);
  let html = baseHtml;
  html = replaceTag(html, /<title>[^<]*<\/title>/i, `<title>${escape(title)}</title>`);
  html = replaceTag(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escape(description)}" />`);
  html = replaceTag(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escape(socialTitle)}" />`);
  html = replaceTag(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escape(socialDescription)}" />`);
  html = replaceTag(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escape(canonical)}" />`);
  html = replaceTag(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escape(canonical)}" />`);
  html = replaceTag(html, /<meta\s+name="twitter:card"[^>]*>/i, `<meta name="twitter:card" content="${socialImage ? "summary_large_image" : "summary"}" />`);
  html = replaceTag(html, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escape(socialTitle)}" />`);
  html = replaceTag(html, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escape(socialDescription)}" />`);
  if (socialImage) {
    html = replaceTag(html, /<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${escape(socialImage)}" />`);
    html = replaceTag(html, /<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${escape(socialImage)}" />`);
  }
  const destination = path === "/" ? indexPath : new URL(`.${path}/index.html`, outputDirectory);
  await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
  await writeFile(destination, html);
}

console.log(`Prerendered SEO metadata for ${routes.length} public routes.`);
