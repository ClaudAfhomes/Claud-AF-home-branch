import { useEffect } from "react";
import { siteConfig } from "@/data/mock/site";

const DEFAULT_DESCRIPTION =
  "AFhomes — Amazing & Fun. Your Home Away From Home. Hospitality, wellness, dining, nature and experiences in Laguna, Philippines.";

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

interface SeoProps {
  title: string;
  description?: string;
  /** Absolute path (starting with /) used for canonical + og:url. */
  path?: string;
}

/**
 * Lightweight SEO manager — sets the document title, canonical URL, and core
 * Open Graph / Twitter metadata for each route.
 */
export function Seo({ title, description = DEFAULT_DESCRIPTION, path = "/" }: SeoProps) {
  useEffect(() => {
    document.title = `${title} — AFhomes`;
    setMeta("name", "description", description);
    setMeta("property", "og:url", `${siteConfig.siteUrl}${path}`);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setCanonical(`${siteConfig.siteUrl}${path}`);
  }, [title, description, path]);

  return null;
}